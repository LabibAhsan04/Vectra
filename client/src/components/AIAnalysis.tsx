import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import type { AIAnalysis } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';

interface AIAnalysisProps {
  ticker: string;
  onAnalysis?: (analysis: AIAnalysis | null) => void;
}

function signalClass(signal: AIAnalysis['signal']): string {
  if (signal === 'buy') return 'bg-bullish/15 text-bullish';
  if (signal === 'sell') return 'bg-bearish/15 text-bearish';
  return 'bg-muted text-muted-foreground';
}

function errorMessage(err: unknown, ticker: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) =>
          typeof item === 'object' && item && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : String(item),
        )
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
    if (!err.response) {
      return `Cannot reach API at ${API_BASE_URL}. Is the backend running?`;
    }
  }
  return `Failed to analyze ${ticker}`;
}

export default function AIAnalysisPanel({ ticker, onAnalysis }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onAnalysisRef = useRef(onAnalysis);
  const requestIdRef = useRef(0);
  onAnalysisRef.current = onAnalysis;

  useEffect(() => {
    requestIdRef.current += 1;
    setAnalysis(null);
    setError(null);
    setLoading(false);
    onAnalysisRef.current?.(null);
  }, [ticker]);

  async function runAnalysis(force = false) {
    if (!ticker) return;

    const requestId = ++requestIdRef.current;
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
      setError(errorMessage(err, ticker));
      setAnalysis(null);
      onAnalysisRef.current?.(null);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">AI Analysis</h3>
        <button
          type="button"
          onClick={() => void runAnalysis(Boolean(analysis))}
          disabled={loading || !ticker}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : analysis ? 'Refresh Analysis' : 'Run Analysis'}
        </button>
      </div>

      {loading && (
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-28 rounded bg-muted" />
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-[83%] rounded bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
        </div>
      )}

      {!loading && error && <p className="text-sm text-bearish">{error}</p>}

      {!loading && !error && !analysis && (
        <p className="text-sm text-muted-foreground">
          Run analysis to generate a model-based recommendation for {ticker}.
        </p>
      )}

      {!loading && analysis && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-md px-2.5 py-1 text-sm font-semibold uppercase tracking-wide ${signalClass(analysis.signal)}`}
            >
              {analysis.signal}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {analysis.overallScore}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / 100
              </span>
            </span>
          </div>

          <p className="text-sm leading-relaxed text-foreground">
            {analysis.analysisText}
          </p>

          <div className="space-y-2">
            {Object.entries(analysis.scores).map(([key, value]) => (
              <div key={key}>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{key}</span>
                  <span className="tabular-nums">{value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {(analysis.keyCatalysts.length > 0 || analysis.keyRisks.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {analysis.keyCatalysts.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Catalysts
                  </h4>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                    {analysis.keyCatalysts.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.keyRisks.length > 0 && (
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Risks
                  </h4>
                  <ul className="list-disc space-y-1 pl-4 text-sm text-foreground">
                    {analysis.keyRisks.map((item) => (
                      <li key={item}>{item}</li>
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
