import { useEffect, useState } from 'react';
import axios from 'axios';
import type { CompareRow } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import { formatChangePct, formatPrice } from '@/utils/formatters';
import { internalCircleLabel } from '@/utils/signalLabels';
import { useWatchlistStore } from '@/store/watchlistStore';

export default function CompareView() {
  const tickers = useWatchlistStore((s) => s.tickers);
  const [selected, setSelected] = useState<string[]>([]);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tickers.length >= 2 && selected.length === 0) {
      setSelected(tickers.slice(0, Math.min(3, tickers.length)));
    }
  }, [tickers, selected.length]);

  useEffect(() => {
    if (selected.length < 2) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data } = await axios.get<{ tickers: CompareRow[] }>(
          `${API_BASE_URL}/api/compare`,
          { params: { tickers: selected.join(',') } },
        );
        if (!cancelled) {
          setRows(data.tickers);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, 'Comparison unavailable.'));
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  function toggle(ticker: string) {
    setSelected((prev) => {
      if (prev.includes(ticker)) {
        return prev.filter((t) => t !== ticker);
      }
      if (prev.length >= 5) return prev;
      return [...prev, ticker];
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Compare Tickers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select 2–5 watchlist symbols for a side-by-side view.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {tickers.map((ticker) => {
            const active = selected.includes(ticker);
            return (
              <button
                key={ticker}
                type="button"
                onClick={() => toggle(ticker)}
                aria-pressed={active}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {ticker}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="h-32 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : null}
      {error ? (
        <p className="text-sm text-bearish" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && rows.length >= 2 ? (
        <section className="overflow-x-auto rounded-xl border border-border bg-card p-4 sm:p-6">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3">Ticker</th>
                <th className="pb-2 pr-3">Price</th>
                <th className="pb-2 pr-3">Change</th>
                <th className="pb-2 pr-3">P/E</th>
                <th className="pb-2 pr-3">RSI</th>
                <th className="pb-2 pr-3">Rel Vol</th>
                <th className="pb-2">Signal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ticker} className="border-t border-border/60">
                  <td className="py-2 pr-3 font-medium">{row.ticker}</td>
                  <td className="py-2 pr-3 tabular-nums">{formatPrice(row.price)}</td>
                  <td
                    className={`py-2 pr-3 tabular-nums ${
                      row.changePct >= 0 ? 'text-bullish' : 'text-bearish'
                    }`}
                  >
                    {formatChangePct(row.changePct)}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {row.peRatio > 0 ? row.peRatio.toFixed(1) : '—'}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {row.rsi != null ? row.rsi.toFixed(0) : '—'}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">
                    {row.relativeVolume != null ? `${row.relativeVolume.toFixed(2)}×` : '—'}
                  </td>
                  <td className="py-2 tabular-nums">
                    {row.finalScore != null
                      ? `${internalCircleLabel(row.finalLabel ?? '', row.finalScore)} (${row.finalScore})`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
