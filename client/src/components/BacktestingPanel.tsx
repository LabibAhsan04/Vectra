import { useEffect, useState } from 'react';
import axios from 'axios';
import type { BacktestResult } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

interface BacktestingPanelProps {
  ticker: string;
  refreshKey?: number;
}

function fmt(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export default function BacktestingPanel({
  ticker,
  refreshKey = 0,
}: BacktestingPanelProps) {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data } = await axios.get<BacktestResult>(
          `${API_BASE_URL}/api/backtest/${encodeURIComponent(ticker)}`,
        );
        if (!cancelled) {
          setResult(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, 'Failed to load backtest'));
          setResult(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, refreshKey]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-foreground">Backtesting-Lite</h3>
        <p className="text-xs text-muted-foreground">
          Historical follow-through of saved {ticker} signals (1D / 5D / 20D)
        </p>
      </div>

      {loading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : null}

      {error ? (
        <p className="text-sm text-bearish" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && result && result.signalsTested === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Backtesting will populate after Vectra saves enough signal history and forward
            price data. Signals need at least 1D, 5D, or 20D follow-through data before
            results can be calculated.
          </p>
          <p className="text-xs text-muted-foreground">
            Backtesting is historical analysis only and does not guarantee future
            performance.
          </p>
        </div>
      ) : null}

      {!loading && !error && result && result.signalsTested > 0 ? (
        <div className="space-y-4">
          {result.message ? (
            <p className="text-sm text-muted-foreground">{result.message}</p>
          ) : null}
          <p className="text-sm text-foreground">
            Signals tested: <span className="font-semibold">{result.signalsTested}</span>
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Signal Label</th>
                  <th className="pb-2 pr-3 font-medium">Count</th>
                  <th className="pb-2 pr-3 font-medium">Avg 1D</th>
                  <th className="pb-2 pr-3 font-medium">Avg 5D</th>
                  <th className="pb-2 pr-3 font-medium">Avg 20D</th>
                  <th className="pb-2 font-medium">Win Rate 5D</th>
                </tr>
              </thead>
              <tbody>
                {(result.byLabel ?? []).map((row) => (
                  <tr key={row.signalLabel} className="border-t border-border/60">
                    <td className="py-2 pr-3 text-foreground">{row.signalLabel}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.count}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmt(row.avg1dReturn)}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmt(row.avg5dReturn)}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmt(row.avg20dReturn)}</td>
                    <td className="py-2 tabular-nums">
                      {row.winRate5d == null ? '—' : `${row.winRate5d}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Average return by score bucket
            </h4>
            <table className="w-full min-w-[360px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3 font-medium">Bucket</th>
                  <th className="pb-2 pr-3 font-medium">Count</th>
                  <th className="pb-2 font-medium">Avg 5D Return</th>
                </tr>
              </thead>
              <tbody>
                {(result.byBucket ?? []).map((row) => (
                  <tr key={row.bucket} className="border-t border-border/60">
                    <td className="py-2 pr-3 text-foreground">{row.bucket}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.count}</td>
                    <td className="py-2 tabular-nums">{fmt(row.avg5dReturn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            {result.disclaimer ||
              'Backtesting is historical analysis only and does not guarantee future performance.'}
          </p>
        </div>
      ) : null}
    </section>
  );
}
