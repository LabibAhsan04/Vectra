import { create } from 'zustand';
import axios from 'axios';
import { API_BASE_URL, WATCHLIST_LIMIT } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

const WATCHLIST_STORAGE_KEY = 'vectra-watchlist-tickers';

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

function readLocalTickers(): string[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    return [];
  }
}

function writeLocalTickers(tickers: string[]) {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(tickers));
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
      const tickers = data.map((item) => item.ticker);
      writeLocalTickers(tickers);
      set({
        entries: data,
        tickers,
        loading: false,
        hydrated: true,
        error: null,
      });
    } catch (err) {
      const cached = readLocalTickers();
      set({
        entries: cached.map((ticker) => ({ ticker, addedAt: new Date().toISOString() })),
        tickers: cached,
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
        const tickers = entries.map((e) => e.ticker);
        writeLocalTickers(tickers);
        return { entries, tickers, error: null };
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
    const nextTickers = previousTickers.filter((t) => t !== symbol);
    set({
      entries: previousEntries.filter((e) => e.ticker !== symbol),
      tickers: nextTickers,
    });
    writeLocalTickers(nextTickers);
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
      writeLocalTickers(previousTickers);
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
