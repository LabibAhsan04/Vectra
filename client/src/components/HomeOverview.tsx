import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import type { NewsItem, SignalHistoryPoint, StockQuote } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import { formatChangePct } from '@/utils/formatters';
import { internalCircleLabel } from '@/utils/signalLabels';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useStockStore } from '@/store/stockStore';
import NewsFeed from './NewsFeed';

function formatUpdated(): string {
  return new Date().toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function HomeOverview() {
  const tickers = useWatchlistStore((s) => s.tickers);
  const selectTicker = useStockStore((s) => s.selectTicker);

  const [quotes, setQuotes] = useState<Record<string, StockQuote | null>>({});
  const [signals, setSignals] = useState<Record<string, SignalHistoryPoint | null>>({});
  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [watchlistNews, setWatchlistNews] = useState<NewsItem[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    if (!tickers.length) {
      setQuotes({});
      setSignals({});
      return;
    }
    let cancelled = false;
    setLoadingQuotes(true);
    void (async () => {
      const results = await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const { data } = await axios.get<StockQuote>(
              `${API_BASE_URL}/api/stock/${encodeURIComponent(ticker)}`,
            );
            return [ticker, data] as const;
          } catch {
            return [ticker, null] as const;
          }
        }),
      );
      if (!cancelled) {
        setQuotes(Object.fromEntries(results));
        setLoadingQuotes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tickers]);

  useEffect(() => {
    if (!tickers.length) {
      setSignals({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const results = await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const { data } = await axios.get<SignalHistoryPoint[]>(
              `${API_BASE_URL}/api/signals/${encodeURIComponent(ticker)}/history`,
            );
            const latest = data.length ? data[data.length - 1] : null;
            return [ticker, latest] as const;
          } catch {
            return [ticker, null] as const;
          }
        }),
      );
      if (!cancelled) {
        setSignals(Object.fromEntries(results));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tickers]);

  useEffect(() => {
    let cancelled = false;
    setNewsLoading(true);
    void (async () => {
      try {
        const { data } = await axios.get<NewsItem[]>(
          `${API_BASE_URL}/api/news/market`,
          { params: { limit: 20 } },
        );
        if (!cancelled) {
          setMarketNews(data);
          setMarketError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setMarketNews([]);
          setMarketError(
            formatApiError(err, 'Market news temporarily unavailable.'),
          );
        }
      }

      if (tickers.length === 0) {
        if (!cancelled) {
          setWatchlistNews([]);
          setWatchError(null);
          setNewsLoading(false);
        }
        return;
      }

      try {
        const { data } = await axios.get<NewsItem[]>(
          `${API_BASE_URL}/api/news/watchlist`,
          { params: { tickers: tickers.join(','), limit: 20 } },
        );
        if (!cancelled) {
          setWatchlistNews(data);
          setWatchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setWatchlistNews([]);
          setWatchError(
            formatApiError(err, 'Watchlist news temporarily unavailable.'),
          );
        }
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tickers]);

  const snapshot = useMemo(() => {
    const rows = tickers
      .map((ticker) => {
        const quote = quotes[ticker];
        if (!quote) return null;
        return { ticker, changePct: quote.changePct };
      })
      .filter(Boolean) as Array<{ ticker: string; changePct: number }>;

    const avgChange =
      rows.length > 0
        ? rows.reduce((sum, r) => sum + r.changePct, 0) / rows.length
        : null;

    let buy = 0;
    let hold = 0;
    let sell = 0;
    for (const ticker of tickers) {
      const point = signals[ticker];
      if (!point) continue;
      const label = internalCircleLabel(point.finalLabel, point.finalScore);
      if (label === 'BUY') buy += 1;
      else if (label === 'SELL') sell += 1;
      else hold += 1;
    }

    const sorted = [...rows].sort((a, b) => b.changePct - a.changePct);
    return {
      avgChange,
      buy,
      hold,
      sell,
      gainer: sorted[0] ?? null,
      loser: sorted[sorted.length - 1] ?? null,
    };
  }, [tickers, quotes, signals]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Market Snapshot</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              What&apos;s happening in the market today?
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Last updated: {formatUpdated()}
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-card-secondary px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Watchlist avg
            </p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
              {snapshot.avgChange != null ? (
                <span
                  className={
                    snapshot.avgChange >= 0 ? 'text-bullish' : 'text-bearish'
                  }
                >
                  {formatChangePct(snapshot.avgChange)}
                </span>
              ) : (
                '—'
              )}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card-secondary px-3 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Signal counts
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              <span className="text-bullish">BUY: {snapshot.buy}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-muted-foreground">HOLD: {snapshot.hold}</span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-bearish">SELL: {snapshot.sell}</span>
            </p>
          </div>
          {snapshot.gainer ? (
            <button
              type="button"
              onClick={() => selectTicker(snapshot.gainer!.ticker)}
              className="rounded-lg border border-border bg-card-secondary px-3 py-3 text-left transition hover:border-muted-foreground/40"
            >
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Top gainer
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {snapshot.gainer.ticker}{' '}
                <span className="text-bullish">
                  {formatChangePct(snapshot.gainer.changePct)}
                </span>
              </p>
            </button>
          ) : null}
          {snapshot.loser && snapshot.loser.ticker !== snapshot.gainer?.ticker ? (
            <button
              type="button"
              onClick={() => selectTicker(snapshot.loser!.ticker)}
              className="rounded-lg border border-border bg-card-secondary px-3 py-3 text-left transition hover:border-muted-foreground/40"
            >
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Top loser
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {snapshot.loser.ticker}{' '}
                <span className="text-bearish">
                  {formatChangePct(snapshot.loser.changePct)}
                </span>
              </p>
            </button>
          ) : null}
        </div>

        {loadingQuotes && tickers.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Refreshing watchlist quotes…</p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-3 text-lg font-semibold text-foreground">Market News</h3>
          {newsLoading && marketNews.length === 0 ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy="true" />
          ) : marketError ? (
            <p className="text-sm text-muted-foreground" role="status">
              {marketError}
            </p>
          ) : (
            <NewsFeed
              items={marketNews}
              emptyMessage="Market news temporarily unavailable."
              showTicker
            />
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h3 className="mb-3 text-lg font-semibold text-foreground">Watchlist News</h3>
          {tickers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add tickers with + to see combined watchlist headlines here.
            </p>
          ) : newsLoading && watchlistNews.length === 0 ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy="true" />
          ) : watchError ? (
            <p className="text-sm text-muted-foreground" role="status">
              {watchError}
            </p>
          ) : (
            <NewsFeed
              items={watchlistNews}
              emptyMessage="No recent watchlist news found."
              showTicker
            />
          )}
        </section>
      </div>
    </div>
  );
}
