// Phase 3: data fetching hook for stock quotes
export function useStockData(_ticker: string) {
  return { data: null, loading: false, error: null };
}
