import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { AIAnalysis } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import ScoreGauge from './ScoreGauge';

interface AIAnalysisProps {
  ticker: string;
  onAnalysis?: (analysis: AIAnalysis | null) => void;
}

function signalClass(signal: AIAnalysis['signal']): string {
  if (signal === 'buy') return 'bg-bullish/15 text-bullish';
  if (signal === 'sell') return 'bg-bearish/15 text-bearish';
  return 'bg-muted text-muted-foreground';
}

function factorBarColor(value: number): string {
  if (value >= 65) return 'bg-bullish';
  if (value <= 40) return 'bg-bearish';
  return 'bg-neutral';
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
      // Keep the last successful analysis on refresh failure.
      if (!hadAnalysis) {
        onAnalysisRef.current?.(null);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">AI Analysis</h3>
        <button
          type="button"
          onClick={() => void runAnalysis(Boolean(analysis))}
          disabled={loading || !ticker}
          aria-busy={loading}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : analysis ? 'Refresh Analysis' : 'Run Analysis'}
        </button>
      </div>

      {loading && !analysis && (
        <div
          className="animate-pulse space-y-3"
          aria-busy="true"
          aria-label="Running analysis"
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
          Run analysis to generate a model-based recommendation for {ticker}.
        </p>
      )}

      {analysis && (
        <div
          className={`space-y-4 ${loading ? 'opacity-60' : ''}`}
          aria-live="polite"
        >
          <div className="flex flex-wrap items-center gap-6">
            <ScoreGauge score={analysis.overallScore} signal={analysis.signal} />
            <div className="min-w-0 flex-1 space-y-2">
              <span
                className={`inline-block rounded-md px-2.5 py-1 text-sm font-semibold uppercase tracking-wide ${signalClass(analysis.signal)}`}
              >
                {analysis.signal}
              </span>
              <p className="text-sm leading-relaxed text-foreground">
                {analysis.analysisText}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {Object.entries(analysis.scores ?? {}).map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{key}</span>
                  <span className="tabular-nums">{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${factorBarColor(value)}`}
                    style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {((analysis.keyCatalysts?.length ?? 0) > 0 ||
            (analysis.keyRisks?.length ?? 0) > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(analysis.keyCatalysts?.length ?? 0) > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Catalysts
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
                    Risks
                  </h4>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                    {(analysis.keyRisks ?? []).map((item, index) => (
                      <li key={`risk-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
