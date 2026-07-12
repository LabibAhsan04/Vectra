import { create } from 'zustand';

interface WatchlistState {
  tickers: string[];
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
}

export const useWatchlistStore = create<WatchlistState>((set) => ({
  tickers: ['NVDA', 'MSFT', 'GOOGL'],
  addTicker: (ticker) =>
    set((state) => ({
      tickers: state.tickers.includes(ticker)
        ? state.tickers
        : [...state.tickers, ticker],
    })),
  removeTicker: (ticker) =>
    set((state) => ({
      tickers: state.tickers.filter((t) => t !== ticker),
    })),
}));
