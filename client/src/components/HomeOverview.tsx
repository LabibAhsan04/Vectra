import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import type { NewsItem, StockQuote } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import { formatChangePct } from '@/utils/formatters';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useStockStore } from '@/store/stockStore';

function formatPublishedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sentimentClass(sentiment: NewsItem['sentiment']): string {
  if (sentiment === 'bullish') return 'bg-bullish/15 text-bullish';
  if (sentiment === 'bearish') return 'bg-bearish/15 text-bearish';
  return 'bg-muted text-muted-foreground';
}

function sentimentLabel(sentiment: NewsItem['sentiment']): string {
  if (sentiment === 'bullish') return 'Bullish';
  if (sentiment === 'bearish') return 'Bearish';
  return 'Neutral';
}

function relevanceLabel(relevance?: string): string {
  switch ((relevance || 'market').toLowerCase()) {
    case 'company':
      return 'Company';
    case 'sector':
      return 'Sector';
    case 'competitor':
      return 'Competitor';
    case 'etf':
      return 'ETF';
    default:
      return 'Market';
  }
}

function NewsList({
  items,
  emptyMessage,
  showTicker = false,
}: {
  items: NewsItem[];
  emptyMessage: string;
  showTicker?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((item, index) => (
        <li key={`${item.url}-${item.publishedAt}-${index}`}>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="-mx-1 block rounded-lg p-1 transition hover:bg-muted/40"
          >
            <div className="flex flex-wrap items-center gap-2">
              {showTicker && item.relatedTicker ? (
                <span className="rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide bg-primary/15 text-primary">
                  {item.relatedTicker}
                </span>
              ) : null}
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-medium tracking-wide ${sentimentClass(item.sentiment)}`}
              >
                {sentimentLabel(item.sentiment)}
              </span>
              <span className="rounded px-2 py-0.5 text-[11px] font-medium tracking-wide bg-muted text-muted-foreground">
                {relevanceLabel(item.relevance)}
              </span>
              <span className="text-xs text-muted-foreground">{item.source}</span>
              <span className="text-xs text-muted-foreground">
                {formatPublishedAt(item.publishedAt)}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium leading-snug text-foreground">
              {item.headline}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function HomeOverview() {
  const tickers = useWatchlistStore((s) => s.tickers);
  const selectTicker = useStockStore((s) => s.selectTicker);

  const [quotes, setQuotes] = useState<Record<string, StockQuote | null>>({});
  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [watchlistNews, setWatchlistNews] = useState<NewsItem[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);

  useEffect(() => {
    if (!tickers.length) {
      setQuotes({});
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

  const movers = useMemo(() => {
    const rows = tickers
      .map((ticker) => {
        const quote = quotes[ticker];
        if (!quote) return null;
        return { ticker, changePct: quote.changePct, price: quote.price };
      })
      .filter(Boolean) as Array<{ ticker: string; changePct: number; price: number }>;
    if (!rows.length) return { gainer: null, loser: null };
    const sorted = [...rows].sort((a, b) => b.changePct - a.changePct);
    return { gainer: sorted[0], loser: sorted[sorted.length - 1] };
  }, [tickers, quotes]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Market overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What&apos;s happening in the market today across your watchlist and broader
          tech/AI headlines.
        </p>

        {(movers.gainer || movers.loser) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {movers.gainer ? (
              <button
                type="button"
                onClick={() => selectTicker(movers.gainer!.ticker)}
                className="rounded-lg border border-border bg-background px-3 py-3 text-left transition hover:border-muted-foreground/40"
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Top gainer
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {movers.gainer.ticker}{' '}
                  <span className="text-bullish">
                    {formatChangePct(movers.gainer.changePct)}
                  </span>
                </p>
              </button>
            ) : null}
            {movers.loser && movers.loser.ticker !== movers.gainer?.ticker ? (
              <button
                type="button"
                onClick={() => selectTicker(movers.loser!.ticker)}
                className="rounded-lg border border-border bg-background px-3 py-3 text-left transition hover:border-muted-foreground/40"
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Top loser
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {movers.loser.ticker}{' '}
                  <span className="text-bearish">
                    {formatChangePct(movers.loser.changePct)}
                  </span>
                </p>
              </button>
            ) : null}
          </div>
        )}

        {loadingQuotes && tickers.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Refreshing watchlist quotes…</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <h3 className="mb-3 text-lg font-semibold text-foreground">Market News</h3>
        {newsLoading && marketNews.length === 0 ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy="true" />
        ) : marketError ? (
          <p className="text-sm text-muted-foreground" role="status">
            {marketError}
          </p>
        ) : (
          <NewsList
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
          <NewsList
            items={watchlistNews}
            emptyMessage="No recent watchlist news found."
            showTicker
          />
        )}
      </section>
    </div>
  );
}
