import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import type { NewsItem } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

interface NewsPanelProps {
  ticker: string;
  companyName?: string;
  sentimentByHeadline?: Record<string, NewsItem['sentiment']>;
}

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

function relevanceLabel(relevance?: string): string {
  switch ((relevance || 'company').toLowerCase()) {
    case 'sector':
      return 'Sector';
    case 'market':
      return 'Market';
    case 'competitor':
      return 'Competitor';
    case 'etf':
      return 'ETF/Broad Market';
    default:
      return 'Company';
  }
}

function NewsList({
  items,
  sentimentByHeadline,
  emptyMessage,
}: {
  items: NewsItem[];
  sentimentByHeadline: Record<string, NewsItem['sentiment']>;
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-4" aria-live="polite">
      {items.map((item, index) => {
        const sentiment =
          sentimentByHeadline[item.headline] ?? item.sentiment;

        return (
          <li key={`${item.url}-${item.publishedAt}-${index}`}>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="-mx-1 block rounded-lg p-1 transition hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${sentimentClass(sentiment)}`}
                >
                  {sentiment}
                </span>
                <span className="rounded px-2 py-0.5 text-[11px] font-medium tracking-wide bg-muted text-muted-foreground">
                  {relevanceLabel(item.relevance)}
                  {typeof item.relevanceScore === 'number'
                    ? ` · ${item.relevanceScore}`
                    : ''}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.source}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatPublishedAt(item.publishedAt)}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium leading-snug text-foreground">
                {item.headline}
              </p>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export default function NewsPanel({
  ticker,
  companyName,
  sentimentByHeadline = {},
}: NewsPanelProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    /* eslint-disable react-hooks/set-state-in-effect -- fetch reset before async load */
    setItems([]);
    setError(null);
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    async function load() {
      const currentRequest = ++requestId;
      try {
        const { data } = await axios.get<NewsItem[]>(
          `${API_BASE_URL}/api/news/${encodeURIComponent(ticker)}`,
          { params: { limit: 12 } },
        );
        if (cancelled || currentRequest !== requestId) return;
        setItems(data);
        setError(null);
      } catch (err) {
        if (cancelled || currentRequest !== requestId) return;
        setError(formatApiError(err, `Failed to load news for ${ticker}`));
        setItems([]);
      } finally {
        if (!cancelled && currentRequest === requestId) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const { companyNews, marketNews } = useMemo(() => {
    const company: NewsItem[] = [];
    const market: NewsItem[] = [];
    for (const item of items) {
      if ((item.section || 'company') === 'company') company.push(item);
      else market.push(item);
    }
    return { companyNews: company, marketNews: market };
  }, [items]);

  const newest = items[0]?.publishedAt
    ? formatPublishedAt(items[0].publishedAt)
    : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">News</h3>
          {newest ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Last updated: {newest}
            </p>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground">
          {companyName ? `${ticker} · ${companyName}` : ticker}
        </span>
      </div>

      {loading && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading news">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse space-y-2">
              <div className="h-4 w-[80%] rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-bearish" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              Company News
            </h4>
            <NewsList
              items={companyNews}
              sentimentByHeadline={sentimentByHeadline}
              emptyMessage="No recent company-specific news found."
            />
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold text-foreground">
              Market & Sector News
            </h4>
            <NewsList
              items={marketNews}
              sentimentByHeadline={sentimentByHeadline}
              emptyMessage="No recent market or sector headlines in this feed."
            />
          </div>
        </div>
      )}
    </section>
  );
}
