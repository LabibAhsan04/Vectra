import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import type { NewsItem } from '@/types/stock.types';
import { useRefreshTick } from '@/hooks/useRefreshTick';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import NewsFeed from './NewsFeed';

interface NewsPanelProps {
  ticker: string;
  companyName?: string;
  sentimentByHeadline?: Record<string, NewsItem['sentiment']>;
}

export default function NewsPanel({
  ticker,
  companyName,
  sentimentByHeadline = {},
}: NewsPanelProps) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasNewsRef = useRef(false);
  const refreshTick = useRefreshTick([ticker]);

  useEffect(() => {
    hasNewsRef.current = false;
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;
    let requestId = 0;

    if (!hasNewsRef.current) {
      setItems([]);
      setError(null);
      setLoading(true);
    }

    async function load() {
      const currentRequest = ++requestId;
      try {
        const { data } = await axios.get<NewsItem[]>(
          `${API_BASE_URL}/api/news/${encodeURIComponent(ticker)}`,
          { params: { limit: 20 } },
        );
        if (cancelled || currentRequest !== requestId) return;
        setItems(data);
        hasNewsRef.current = true;
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
  }, [ticker, refreshTick]);

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
    return { companyNews: company, marketNews: market };
  }, [items]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">News</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {companyName ? `${ticker} · ${companyName}` : ticker}
        </p>
      </div>

      {loading && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading news">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse space-y-1.5">
              <div className="h-3 w-[85%] rounded bg-muted" />
              <div className="h-2.5 w-1/3 rounded bg-muted" />
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
            <h4 className="mb-2 text-sm font-semibold text-foreground">
              Company News
            </h4>
            <NewsFeed
              items={companyNews}
              sentimentByHeadline={sentimentByHeadline}
              emptyMessage="No recent company-specific news found for this ticker."
            />
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-foreground">
              Market &amp; Sector News
            </h4>
            <NewsFeed
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
