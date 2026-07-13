import { useEffect, useState } from 'react';
import axios from 'axios';
import type { StockQuote } from '@/types/stock.types';
import { useStockStore } from '@/store/stockStore';
import { API_BASE_URL, DEFAULT_TICKERS } from '@/utils/constants';
import { formatChangePct } from '@/utils/formatters';

const TICKER_BAR_SYMBOLS = DEFAULT_TICKERS.slice(0, 10);

export default function TickerBar() {
  const activeTicker = useStockStore((s) => s.activeTicker);
  const setActiveTicker = useStockStore((s) => s.setActiveTicker);
  const [quotes, setQuotes] = useState<Record<string, StockQuote | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const results = await Promise.all(
        TICKER_BAR_SYMBOLS.map(async (ticker) => {
          try {
            const { data } = await axios.get<StockQuote>(
              `${API_BASE_URL}/api/stock/${ticker}`,
            );
            return [ticker, data] as const;
          } catch {
            return [ticker, null] as const;
          }
        }),
      );
      if (!cancelled) {
        setQuotes(Object.fromEntries(results));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative border-b border-border pb-4">
      <div
        className="ticker-scroll overflow-x-auto"
        role="group"
        aria-label="Market tickers"
      >
        <div className="flex min-w-max gap-2 pr-6">
          {TICKER_BAR_SYMBOLS.map((ticker) => {
            const quote = quotes[ticker];
            const positive = (quote?.changePct ?? 0) >= 0;
            const isActive = activeTicker === ticker;

            return (
              <button
                key={ticker}
                type="button"
                onClick={() => setActiveTicker(ticker)}
                aria-pressed={isActive}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  isActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card hover:border-muted-foreground/40'
                }`}
              >
                <div className="text-sm font-semibold text-foreground">
                  {ticker}
                </div>
                {loading ? (
                  <div className="mt-1 h-3 w-12 animate-pulse rounded bg-muted" />
                ) : (
                  <div
                    className={`text-xs tabular-nums ${
                      !quote
                        ? 'text-muted-foreground'
                        : positive
                          ? 'text-bullish'
                          : 'text-bearish'
                    }`}
                  >
                    {quote ? formatChangePct(quote.changePct) : '—'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
      />
    </div>
  );
}
