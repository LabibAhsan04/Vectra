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
    <div className="overflow-x-auto border-b border-border pb-4">
      <div className="flex min-w-max gap-2">
        {TICKER_BAR_SYMBOLS.map((ticker) => {
          const quote = quotes[ticker];
          const positive = (quote?.changePct ?? 0) >= 0;
          const isActive = activeTicker === ticker;

          return (
            <button
              key={ticker}
              type="button"
              onClick={() => setActiveTicker(ticker)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-muted-foreground/40'
              }`}
            >
              <div className="text-sm font-semibold text-foreground">{ticker}</div>
              <div
                className={`text-xs tabular-nums ${
                  loading || !quote
                    ? 'text-muted-foreground'
                    : positive
                      ? 'text-bullish'
                      : 'text-bearish'
                }`}
              >
                {loading
                  ? '…'
                  : quote
                    ? formatChangePct(quote.changePct)
                    : '—'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
