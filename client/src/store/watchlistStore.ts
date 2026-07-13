import { create } from 'zustand';
import axios from 'axios';
import { API_BASE_URL, WATCHLIST_LIMIT } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

export interface WatchlistEntry {
  ticker: string;
  companyName?: string | null;
  exchange?: string | null;
  assetType?: string | null;
  addedAt: string;
}

export interface SymbolSearchHit {
  symbol: string;
  companyName: string;
  exchange: string;
  assetType: string;
}

interface WatchlistState {
  entries: WatchlistEntry[];
  tickers: string[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  fetchWatchlist: () => Promise<void>;
  addTicker: (payload: {
    ticker: string;
    companyName?: string;
    exchange?: string;
    assetType?: string;
  }) => Promise<void>;
  removeTicker: (ticker: string) => Promise<void>;
  searchSymbols: (query: string) => Promise<SymbolSearchHit[]>;
}

export const useWatchlistStore = create<WatchlistState>((set, get) => ({
  entries: [],
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
        entries: data,
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

  addTicker: async (payload) => {
    const symbol = payload.ticker.trim().toUpperCase();
    if (!symbol) return;

    if (get().tickers.includes(symbol)) {
      const msg = 'This ticker is already in your watchlist.';
      set({ error: msg });
      throw new Error(msg);
    }
    if (get().tickers.length >= WATCHLIST_LIMIT) {
      const msg =
        'Watchlist limit reached. Remove a ticker before adding another.';
      set({ error: msg });
      throw new Error(msg);
    }

    set({ error: null });
    try {
      const { data } = await axios.post<WatchlistEntry>(
        `${API_BASE_URL}/api/watchlist`,
        {
          ticker: symbol,
          companyName: payload.companyName,
          exchange: payload.exchange,
          assetType: payload.assetType,
        },
      );
      set((state) => {
        if (state.tickers.includes(data.ticker)) return state;
        const entries = [...state.entries, data];
        return {
          entries,
          tickers: entries.map((e) => e.ticker),
          error: null,
        };
      });
    } catch (err) {
      set({
        error: formatApiError(
          err,
          'Ticker not found or not supported by current data provider.',
        ),
      });
      throw err;
    }
  },

  removeTicker: async (ticker: string) => {
    const symbol = ticker.trim().toUpperCase();
    set({ error: null });
    const previousEntries = get().entries;
    const previousTickers = get().tickers;
    set({
      entries: previousEntries.filter((e) => e.ticker !== symbol),
      tickers: previousTickers.filter((t) => t !== symbol),
    });
    try {
      await axios.delete(
        `${API_BASE_URL}/api/watchlist/${encodeURIComponent(symbol)}`,
      );
    } catch (err) {
      set({
        entries: previousEntries,
        tickers: previousTickers,
        error: formatApiError(err, `Failed to remove ${symbol}`),
      });
      throw err;
    }
  },

  searchSymbols: async (query: string) => {
    const q = query.trim();
    if (q.length < 2) return [];
    try {
      const { data } = await axios.get<SymbolSearchHit[]>(
        `${API_BASE_URL}/api/watchlist/search`,
        { params: { q } },
      );
      return data;
    } catch (err) {
      set({
        error: formatApiError(err, 'Failed to search tickers'),
      });
      throw err;
    }
  },
}));
