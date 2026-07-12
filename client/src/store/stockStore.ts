import { create } from 'zustand';

interface StockState {
  activeTicker: string;
  setActiveTicker: (ticker: string) => void;
}

export const useStockStore = create<StockState>((set) => ({
  activeTicker: 'NVDA',
  setActiveTicker: (ticker) => set({ activeTicker: ticker }),
}));
