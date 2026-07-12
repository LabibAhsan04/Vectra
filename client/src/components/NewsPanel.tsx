import { useEffect, useState } from 'react';
import axios from 'axios';
import type { NewsItem } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';

interface NewsPanelProps {
  ticker: string;
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

function errorMessage(err: unknown, ticker: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => d.msg ?? String(d)).join(', ');
    }
  }
  return `Failed to load news for ${ticker}`;
}

export default function NewsPanel({ ticker }: NewsPanelProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let requestId = 0;

    // Reset synchronously so the previous ticker's headlines don't flash
    setItems([]);
    setError(null);
    setLoading(true);

    async function load() {
      const currentRequest = ++requestId;
      try {
        const { data } = await axios.get<NewsItem[]>(
          `${API_BASE_URL}/api/news/${encodeURIComponent(ticker)}`,
          { params: { limit: 8 } },
        );
        if (cancelled || currentRequest !== requestId) return;
        setItems(data);
        setError(null);
      } catch (err) {
        if (cancelled || currentRequest !== requestId) return;
        setError(errorMessage(err, ticker));
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

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">News</h3>
        <span className="text-xs text-muted-foreground">{ticker}</span>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse space-y-2">
              <div className="h-4 w-[80%] rounded bg-muted" />
              <div className="h-3 w-1/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-bearish">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No recent headlines for this ticker.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="space-y-4">
          {items.map((item, index) => (
            <li key={`${item.url}-${item.publishedAt}-${index}`}>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg transition hover:bg-muted/40"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${sentimentClass(item.sentiment)}`}
                  >
                    {item.sentiment}
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
          ))}
        </ul>
      )}
    </section>
  );
}
