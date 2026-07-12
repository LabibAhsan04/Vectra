// Stretch goal: live price stream hook
export function useWebSocket(_ticker: string) {
  return { price: null, connected: false };
}
