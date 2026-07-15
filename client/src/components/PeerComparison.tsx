import { useEffect, useState } from 'react';
import axios from 'axios';
import type { PeerComparison } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import { formatChangePct, formatMarketCap, formatPrice } from '@/utils/formatters';
import { internalCircleLabel } from '@/utils/signalLabels';

interface PeerComparisonProps {
  ticker: string;
}

export default function PeerComparison({ ticker }: PeerComparisonProps) {
  const [data, setData] = useState<PeerComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data: payload } = await axios.get<PeerComparison>(
          `${API_BASE_URL}/api/peers/${encodeURIComponent(ticker)}`,
        );
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, 'Peer comparison unavailable.'));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Peer Comparison</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {ticker} vs sector peers and SPY benchmark
      </p>

      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-3">
          {data.vsSector != null ? (
            <p className="text-sm text-foreground">
              vs sector avg:{' '}
              <span className={data.vsSector >= 0 ? 'text-bullish' : 'text-bearish'}>
                {formatChangePct(data.vsSector)}
              </span>
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-3">Ticker</th>
                  <th className="pb-2 pr-3">Price</th>
                  <th className="pb-2 pr-3">Change</th>
                  <th className="pb-2 pr-3">P/E</th>
                  <th className="pb-2 pr-3">Mkt Cap</th>
                  <th className="pb-2">Signal</th>
                </tr>
              </thead>
              <tbody>
                {data.peers.map((row) => (
                  <tr
                    key={row.ticker}
                    className={`border-t border-border/60 ${row.isTarget ? 'bg-primary/5' : ''}`}
                  >
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
                      {formatMarketCap(row.marketCap)}
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
          </div>
        </div>
      ) : null}
    </section>
  );
}
