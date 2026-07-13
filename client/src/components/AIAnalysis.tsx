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

const SOURCES_LINE =
  'Sources used: Finnhub price data, company/news feeds, internal signal engine, OpenRouter explanation layer.';

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
      // Soft failure: keep prior analysis if present; avoid scary red dump when template exists.
      setError(
        hadAnalysis
          ? null
          : formatApiError(err, 'Signal temporarily unavailable. Try again in a moment.'),
      );
      if (!hadAnalysis) {
        onAnalysisRef.current?.(null);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void runAnalysis(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/ticker only
  }, [ticker]);

  const meta = getSignalMeta(analysis?.signal, analysis?.overallScore);
  const publicBadge = meta.label;
  const fundamentalsLimited = analysis?.fundamentalsAvailable === false;
  const breakdown = analysis?.scoreBreakdown?.length
    ? analysis.scoreBreakdown.map((row) => ({
        ...row,
        label: factorDisplayName(row.key),
      }))
    : Object.entries(analysis?.scores ?? {}).map(([key, score]) => ({
        key,
        label: factorDisplayName(key),
        score,
        weight: 0,
        weightedPoints: 0,
        notes: [] as string[],
      }));

  const whyBullets = breakdown.flatMap((row) => {
    if (row.notes?.length) {
      return row.notes.slice(0, 2).map((note) => `${row.label}: ${note.replace(/^[\+\-]\d+\s*/, '')}`);
    }
    return [];
  }).slice(0, 8);

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Signal Analysis</h3>
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
          {loading ? 'Refreshing…' : 'Refresh Analysis'}
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

      {!loading && error && !analysis && (
        <div className="space-y-3" role="status">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void runAnalysis(false)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-muted-foreground/50"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && !analysis && (
        <p className="text-sm text-muted-foreground">
          Loading an evidence-based research reading for {ticker}…
        </p>
      )}

      {analysis && (
        <div
          className={`space-y-5 ${loading ? 'opacity-60' : ''}`}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-start gap-6">
            <ScoreGauge score={analysis.overallScore} signal={analysis.signal} />
            <div className="min-w-0 flex-1 space-y-2">
              <span
                className={`inline-block rounded-md px-2.5 py-1 text-sm font-semibold tracking-wide ${toneClass(meta.tone)}`}
              >
                {publicBadge}
              </span>
              <p className="text-sm leading-relaxed text-foreground">
                {analysis.analysisText}
              </p>
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Score breakdown
            </h4>
            <div className="space-y-2">
              {breakdown.map((row) => {
                const limited = row.key === 'fundamentals' && fundamentalsLimited;
                return (
                  <div key={row.key}>
                    <div className="mb-1 flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {row.label}
                        {limited ? ' (limited)' : ''}
                      </span>
                      <span className="tabular-nums">{row.score}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${factorBarColor(row.score, limited)}`}
                        style={{
                          width: `${Math.max(0, Math.min(100, row.score))}%`,
                          opacity: limited ? 0.55 : 1,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Potential Catalysts
              </h4>
              <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                {(analysis.keyCatalysts?.length
                  ? analysis.keyCatalysts
                  : [
                      'Positive price momentum and increased volume',
                      'Improved technical structure if price remains above moving averages',
                    ]
                ).map((item, index) => (
                  <li key={`catalyst-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Key Risks
              </h4>
              <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                {(analysis.keyRisks?.length
                  ? analysis.keyRisks
                  : [
                      'Limited fundamental data reduces confidence',
                      'Sector volatility could increase risk',
                    ]
                ).map((item, index) => (
                  <li key={`risk-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Why this score?
            </h4>
            {analysis.scoreFormula ? (
              <p className="mb-2 rounded-lg bg-muted/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {analysis.scoreFormula}
              </p>
            ) : null}
            <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
              {(whyBullets.length
                ? whyBullets
                : analysis.whyThisSignal ?? [
                    'Composite score blends momentum, technicals, sentiment, growth, and data quality.',
                  ]
              ).map((item, index) => (
                <li key={`why-${index}`}>{item}</li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Fundamental data is limited in this version, so the signal relies mainly on
            price momentum, technical indicators, and recent news.
          </p>

          <p className="text-xs text-muted-foreground">{SOURCES_LINE}</p>

          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            Vectra provides evidence-based research signals only. It does not provide
            financial advice or execute trades.
          </p>
        </div>
      )}
    </section>
  );
}
