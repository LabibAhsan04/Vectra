import { create } from 'zustand';
import axios from 'axios';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

export interface WatchlistEntry {
  ticker: string;
  addedAt: string;
}

interface WatchlistState {
  tickers: string[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  fetchWatchlist: () => Promise<void>;
  addTicker: (ticker: string) => Promise<void>;
  removeTicker: (ticker: string) => Promise<void>;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  tickers: [],
  loading: false,
  error: null,
  hydrated: false,

  fetchWatchlist: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await axios.get<WatchlistEntry[]>(
        `${API_BASE_URL}/api/watchlist`,
      );
      set({
        tickers: data.map((item) => item.ticker),
        loading: false,
        hydrated: true,
        error: null,
      });
    } catch (err) {
      set({
        loading: false,
        hydrated: true,
        error: formatApiError(err, 'Failed to load watchlist'),
      });
    }
  },

  addTicker: async (ticker: string) => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    if (get().tickers.includes(symbol)) {
      set({ error: `${symbol} is already on your watchlist` });
      throw new Error(`${symbol} is already on your watchlist`);
    }

    set({ error: null });
    try {
      const { data } = await axios.post<WatchlistEntry>(
        `${API_BASE_URL}/api/watchlist`,
        { ticker: symbol },
      );
      set((state) => ({
        tickers: state.tickers.includes(data.ticker)
          ? state.tickers
          : [...state.tickers, data.ticker],
        error: null,
      }));
    } catch (err) {
      set({ error: formatApiError(err, `Failed to add ${symbol}`) });
      throw err;
    }
  },

  removeTicker: async (ticker: string) => {
    const symbol = ticker.trim().toUpperCase();
    set({ error: null });
    const previous = get().tickers;
    set({ tickers: previous.filter((t) => t !== symbol) });
    try {
      await axios.delete(
        `${API_BASE_URL}/api/watchlist/${encodeURIComponent(symbol)}`,
      );
    } catch (err) {
      set({
        tickers: previous,
        error: formatApiError(err, `Failed to remove ${symbol}`),
      });
      throw err;
    }
  },
}));
