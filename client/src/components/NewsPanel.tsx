import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import type { NewsItem } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

interface NewsPanelProps {
  ticker: string;
  companyName?: string;
  sentimentByHeadline?: Record<string, NewsItem['sentiment']>;
  compact?: boolean;
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

function sentimentLabel(sentiment: NewsItem['sentiment']): string {
  if (sentiment === 'bullish') return 'Bullish';
  if (sentiment === 'bearish') return 'Bearish';
  return 'Neutral';
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
      return 'ETF';
    default:
      return 'Company';
  }
}

function NewsList({
  items,
  sentimentByHeadline,
  emptyMessage,
  compact,
}: {
  items: NewsItem[];
  sentimentByHeadline: Record<string, NewsItem['sentiment']>;
  emptyMessage: string;
  compact?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className={compact ? 'space-y-2' : 'space-y-3'} aria-live="polite">
      {items.map((item, index) => {
        const sentiment =
          sentimentByHeadline[item.headline] ?? item.sentiment;

        return (
          <li key={`${item.url}-${item.publishedAt}-${index}`}>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md px-1 py-1 transition hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide ${sentimentClass(sentiment)}`}
                >
                  {sentimentLabel(sentiment)}
                </span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide bg-muted text-muted-foreground">
                  {relevanceLabel(item.relevance)}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {item.source}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatPublishedAt(item.publishedAt)}
                </span>
              </div>
              <p
                className={`mt-0.5 font-medium leading-snug text-foreground ${
                  compact ? 'line-clamp-2 text-xs' : 'text-sm'
                }`}
              >
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
  compact = false,
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
          { params: { limit: compact ? 8 : 12 } },
        );
        if (cancelled || currentRequest !== requestId) return;
        setItems(data);
        setError(null);
      } catch (err) {
        if (cancelled || currentRequest !== requestId) return;
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (status === 429) {
          setError(
            'Data provider rate limit reached. Showing cached results when available.',
          );
        } else {
          setError(
            formatApiError(err, 'No recent news found for this ticker.'),
          );
        }
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
  }, [ticker, compact]);

  const { companyNews, marketNews } = useMemo(() => {
    const company: NewsItem[] = [];
    const market: NewsItem[] = [];
    for (const item of items) {
      const isCompany =
        (item.relevance || '').toLowerCase() === 'company' ||
        (item.section || '') === 'company';
      if (isCompany) company.push(item);
      else market.push(item);
    }
    const companyLimit = compact ? 4 : 8;
    const marketLimit = compact ? 3 : 6;
    return {
      companyNews: company.slice(0, companyLimit),
      marketNews: market.slice(0, marketLimit),
    };
  }, [items, compact]);

  const newest = items[0]?.publishedAt
    ? formatPublishedAt(items[0].publishedAt)
    : null;

  return (
    <section
      className={`rounded-xl border border-border bg-card ${
        compact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3
            className={`font-semibold text-foreground ${
              compact ? 'text-base' : 'text-lg'
            }`}
          >
            News
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {companyName ? `${ticker} · ${companyName}` : ticker}
            {newest ? ` · ${newest}` : ''}
          </p>
        </div>
      </div>

      {loading && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading news">
          {Array.from({ length: compact ? 3 : 4 }).map((_, index) => (
            <div key={index} className="animate-pulse space-y-1.5">
              <div className="h-3 w-[85%] rounded bg-muted" />
              <div className="h-2.5 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-xs text-bearish" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div
          className={`space-y-4 ${
            compact ? 'max-h-[22rem] overflow-y-auto pr-1' : ''
          }`}
        >
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Company
            </h4>
            <NewsList
              items={companyNews}
              sentimentByHeadline={sentimentByHeadline}
              emptyMessage="No recent company-specific news found for this ticker."
              compact={compact}
            />
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Market &amp; sector
            </h4>
            <NewsList
              items={marketNews}
              sentimentByHeadline={sentimentByHeadline}
              emptyMessage="No recent market or sector headlines in this feed."
              compact={compact}
            />
          </div>
        </div>
      )}
    </section>
  );
}
