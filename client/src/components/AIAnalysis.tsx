import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { AIAnalysis } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import {
  FACTOR_HELP,
  factorDisplayName,
  getSignalMeta,
  toneClass,
} from '@/utils/signalLabels';
import ScoreGauge from './ScoreGauge';

interface AIAnalysisProps {
  ticker: string;
  onAnalysis?: (analysis: AIAnalysis | null) => void;
}

function factorBarColor(value: number, limited?: boolean): string {
  if (limited) return 'bg-muted-foreground/50';
  if (value >= 65) return 'bg-bullish';
  if (value <= 40) return 'bg-bearish';
  return 'bg-neutral';
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AIAnalysisPanel({ ticker, onAnalysis }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onAnalysisRef = useRef(onAnalysis);
  const requestIdRef = useRef(0);

  useEffect(() => {
    onAnalysisRef.current = onAnalysis;
  }, [onAnalysis]);

  useEffect(() => {
    onAnalysisRef.current?.(null);
    return () => {
      onAnalysisRef.current?.(null);
    };
  }, []);

  async function runAnalysis(force = false) {
    if (!ticker) return;

    const requestId = ++requestIdRef.current;
    const hadAnalysis = Boolean(analysis);
    setLoading(true);
    setError(null);

    try {
      const { data } = await axios.post<AIAnalysis>(`${API_BASE_URL}/api/analyze`, {
        ticker,
        force,
      });
      if (requestId !== requestIdRef.current) return;
      setAnalysis(data);
      onAnalysisRef.current?.(data);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(formatApiError(err, `Failed to analyze ${ticker}`));
      if (!hadAnalysis) {
        onAnalysisRef.current?.(null);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  // Auto-run once per ticker when the panel mounts.
  useEffect(() => {
    void runAnalysis(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/ticker only
  }, [ticker]);

  const meta = getSignalMeta(analysis?.signal, analysis?.overallScore);
  const fundamentalsLimited = analysis?.fundamentalsAvailable === false;
  const breakdown = analysis?.scoreBreakdown?.length
    ? analysis.scoreBreakdown
    : Object.entries(analysis?.scores ?? {}).map(([key, score]) => ({
        key,
        label: factorDisplayName(key),
        score,
        weight: 0,
        weightedPoints: 0,
        notes: [] as string[],
      }));

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Signal Analysis
          </h3>
          {analysis?.generatedAt ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Last updated: {formatUpdated(analysis.generatedAt)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void runAnalysis(true)}
          disabled={loading || !ticker}
          aria-busy={loading}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh Signal'}
        </button>
      </div>

      {loading && !analysis && (
        <div
          className="animate-pulse space-y-3"
          aria-busy="true"
          aria-label="Running signal analysis"
        >
          <div className="h-6 w-28 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-[83%] rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>
      )}

      {!loading && error && (
        <div className={`space-y-3 ${analysis ? 'mb-4' : ''}`} role="alert">
          <p className="text-sm text-bearish">{error}</p>
          <button
            type="button"
            onClick={() => void runAnalysis(Boolean(analysis))}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-muted-foreground/50"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && !analysis && (
        <p className="text-sm text-muted-foreground">
          Run signal analysis to generate an evidence-based research reading for{' '}
          {ticker}.
        </p>
      )}

      {analysis && (
        <div
          className={`space-y-5 ${loading ? 'opacity-60' : ''}`}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-6">
            <ScoreGauge score={analysis.overallScore} signal={analysis.signal} />
            <div className="min-w-0 flex-1 space-y-2">
              <span
                className={`inline-block rounded-md px-2.5 py-1 text-sm font-semibold tracking-wide ${toneClass(meta.tone)}`}
              >
                {analysis.signalLabel ?? meta.label}
              </span>
              <p className="text-sm leading-relaxed text-foreground">
                {analysis.analysisText}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {analysis.scoreInterpretation ??
                  `${analysis.overallScore}/100 indicates the strength of current evidence across momentum, technicals, sentiment, growth, and data quality.`}
              </p>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Why this score?
            </h4>
            {analysis.scoreFormula ? (
              <p className="mb-3 rounded-lg bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {analysis.scoreFormula}
              </p>
            ) : null}
            <div className="space-y-3">
              {breakdown.map((row) => {
                const limited = row.key === 'fundamentals' && fundamentalsLimited;
                return (
                  <div key={row.key} className="rounded-lg border border-border/70 p-3">
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <span className="font-medium text-foreground">
                        {row.label}
                        {limited ? ' (limited)' : ''}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.score}/100
                        {row.weight > 0
                          ? ` · ${(row.weight * 100).toFixed(0)}% → ${row.weightedPoints.toFixed(1)}`
                          : ''}
                      </span>
                    </div>
                    <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${factorBarColor(row.score, limited)}`}
                        style={{
                          width: `${Math.max(0, Math.min(100, row.score))}%`,
                          opacity: limited ? 0.55 : 1,
                        }}
                      />
                    </div>
                    {row.notes?.length ? (
                      <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                        {row.notes.map((note, index) => (
                          <li key={`${row.key}-note-${index}`}>{note}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/80">
                        {FACTOR_HELP[row.key]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {(analysis.whyThisSignal?.length ?? 0) > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Signal summary
              </h4>
              <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                {analysis.whyThisSignal!.map((item, index) => (
                  <li key={`why-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {(analysis.whatCouldChange?.length ?? 0) > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What could change the signal?
              </h4>
              <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                {analysis.whatCouldChange!.map((item, index) => (
                  <li key={`change-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {(analysis.keyCatalysts?.length ?? 0) > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Potential Catalysts
                </h4>
                <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                  {(analysis.keyCatalysts ?? []).map((item, index) => (
                    <li key={`catalyst-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {(analysis.keyRisks?.length ?? 0) > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Key Risks
                </h4>
                <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                  {(analysis.keyRisks ?? []).map((item, index) => (
                    <li key={`risk-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {(analysis.dataLimitations?.length ?? 0) > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Data Limitations
              </h4>
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {analysis.dataLimitations!.map((item, index) => (
                  <li key={`limit-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Fundamental data is limited in this version, so the signal relies mainly on
            price momentum, technical indicators, and recent news.
          </p>

          {(analysis.sourcesUsed?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              Sources used: {analysis.sourcesUsed!.join('; ')}.
            </p>
          )}

          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            Vectra provides evidence-based research signals only. It does not
            provide financial advice or execute trades.
          </p>
        </div>
      )}
    </section>
  );
}
