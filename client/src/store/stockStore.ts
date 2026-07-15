import { create } from 'zustand';

export type SelectedView = 'home' | 'ticker' | 'compare';

interface StockState {
  selectedView: SelectedView;
  selectedTicker: string | null;
  /** Convenience alias used across ticker-mode components. */
  activeTicker: string;
  goHome: () => void;
  goCompare: () => void;
  selectTicker: (ticker: string) => void;
  /** @deprecated Prefer selectTicker — kept for older call sites. */
  setActiveTicker: (ticker: string) => void;
}

export const useStockStore = create<StockState>((set) => ({
  selectedView: 'home',
  selectedTicker: null,
  activeTicker: '',

  goHome: () =>
    set({
      selectedView: 'home',
      selectedTicker: null,
      activeTicker: '',
    }),

  goCompare: () =>
    set({
      selectedView: 'compare',
      selectedTicker: null,
      activeTicker: '',
    }),

  selectTicker: (ticker: string) => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    set({
      selectedView: 'ticker',
      selectedTicker: symbol,
      activeTicker: symbol,
    });
  },

  setActiveTicker: (ticker: string) => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    set({
      selectedView: 'ticker',
      selectedTicker: symbol,
      activeTicker: symbol,
    });
  },
}));
