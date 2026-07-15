import { useEffect, useState } from 'react';
import axios from 'axios';
import type { StockQuote } from '@/types/stock.types';
import { API_BASE_URL, REFRESH_INTERVAL_MS } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

interface UseStockDataResult {
  data: StockQuote | null;
  fetchedAt: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches a stock quote and polls for updates.
 *
 * Handles:
 * - Empty ticker → clear state, no infinite loading skeleton
 * - Ticker change → sync reset so previous quote doesn't flash
 * - Overlapping polls → in-flight lock + request id (ignore stale responses)
 * - Failed refresh → keep last good quote; no loading flicker on retries
 */
export function useStockData(ticker: string): UseStockDataResult {
  const [data, setData] = useState<StockQuote | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ticker) {
      setData(null);
      setFetchedAt(null);
      setError(null);
      setLoading(false);
      return;
    }

    setData(null);
    setFetchedAt(null);
    setError(null);
    setLoading(true);

    let cancelled = false;
    let requestId = 0;
    let inFlight = false;
    let hasLoadedData = false;

    async function fetchQuote() {
      if (inFlight) return;
      inFlight = true;

      const currentRequest = ++requestId;

      try {
        const response = await axios.get<StockQuote>(
          `${API_BASE_URL}/api/stock/${ticker}`,
        );
        if (cancelled || currentRequest !== requestId) return;
        setData(response.data);
        setFetchedAt(new Date().toISOString());
        setError(null);
        hasLoadedData = true;
      } catch (err) {
        if (cancelled || currentRequest !== requestId) return;
        const message = formatApiError(err, `Failed to load ${ticker}`);

        if (!hasLoadedData) {
          setError(message);
          setData(null);
          setFetchedAt(null);
        }
      } finally {
        inFlight = false;
        if (!cancelled && currentRequest === requestId) {
          setLoading(false);
        }
      }
    }

    void fetchQuote();
    const intervalId = window.setInterval(
      () => void fetchQuote(),
      REFRESH_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [ticker]);

  return { data, fetchedAt, loading, error };
}
