import { useEffect, useState } from 'react';
import axios from 'axios';
import type { StockQuote } from '@/types/stock.types';
import { API_BASE_URL, REFRESH_INTERVAL_MS } from '@/utils/constants';

interface UseStockDataResult {
  data: StockQuote | null;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Bug fix: falsy ticker must clear loading or the skeleton never ends
    if (!ticker) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Bug fix: reset synchronously before any async work so old quote can't flash
    setData(null);
    setError(null);
    setLoading(true);

    let cancelled = false;
    let requestId = 0;
    let inFlight = false;
    let hasLoadedData = false;

    async function fetchQuote() {
      // Bug fix: skip if a request is already running (prevents out-of-order races)
      if (inFlight) return;
      inFlight = true;

      const currentRequest = ++requestId;

      try {
        const response = await axios.get<StockQuote>(
          `${API_BASE_URL}/api/stock/${ticker}`,
        );
        // Bug fix: ignore outdated responses
        if (cancelled || currentRequest !== requestId) return;
        setData(response.data);
        setError(null);
        hasLoadedData = true;
      } catch (err) {
        if (cancelled || currentRequest !== requestId) return;
        const message =
          axios.isAxiosError(err) && err.response?.data?.detail
            ? String(err.response.data.detail)
            : `Failed to load ${ticker}`;

        // Bug fix: only surface error / clear data on first failure.
        // Later poll failures keep the last good quote and do not toggle loading.
        if (!hasLoadedData) {
          setError(message);
          setData(null);
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

  return { data, loading, error };
}
