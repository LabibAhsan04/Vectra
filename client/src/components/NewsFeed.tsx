import { useMemo, useState } from 'react';
import type { NewsItem } from '@/types/stock.types';

export type NewsFilter =
  | 'all'
  | 'company'
  | 'market'
  | 'sector'
  | 'competitor'
  | 'bullish'
  | 'bearish';

const DEFAULT_VISIBLE = 6;

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

function matchesFilter(item: NewsItem, filter: NewsFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'bullish') return item.sentiment === 'bullish';
  if (filter === 'bearish') return item.sentiment === 'bearish';
  const rel = (item.relevance || 'market').toLowerCase();
  if (filter === 'company') return rel === 'company';
  if (filter === 'sector') return rel === 'sector';
  if (filter === 'competitor') return rel === 'competitor';
  if (filter === 'market') return rel === 'market' || rel === 'etf';
  return true;
}

const FILTER_CHIPS: { id: NewsFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'company', label: 'Company' },
  { id: 'market', label: 'Market' },
  { id: 'sector', label: 'Sector' },
  { id: 'competitor', label: 'Competitor' },
  { id: 'bullish', label: 'Bullish' },
  { id: 'bearish', label: 'Bearish' },
];

interface NewsFeedProps {
  items: NewsItem[];
  emptyMessage: string;
  showTicker?: boolean;
  sentimentByHeadline?: Record<string, NewsItem['sentiment']>;
  showFilters?: boolean;
}

export default function NewsFeed({
  items,
  emptyMessage,
  showTicker = false,
  sentimentByHeadline = {},
  showFilters = true,
}: NewsFeedProps) {
  const [filter, setFilter] = useState<NewsFilter>('all');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [items, filter],
  );

  const visible = expanded ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
  const hasMore = filtered.length > DEFAULT_VISIBLE;

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div>
      {showFilters ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setFilter(chip.id);
                setExpanded(false);
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                filter === chip.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground">No headlines match this filter.</p>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {visible.map((item, index) => {
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
                    {showTicker && item.relatedTicker ? (
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide bg-primary/15 text-primary">
                        {item.relatedTicker}
                      </span>
                    ) : null}
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
                  <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-foreground">
                    {item.headline}
                  </p>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}
