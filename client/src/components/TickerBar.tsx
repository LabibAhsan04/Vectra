import { useEffect, useState } from 'react';
import axios from 'axios';
import type { StockQuote } from '@/types/stock.types';
import { useStockStore } from '@/store/stockStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { API_BASE_URL } from '@/utils/constants';
import { formatChangePct } from '@/utils/formatters';
import ManageWatchlistModal from './ManageWatchlistModal';

export default function TickerBar() {
  const selectedView = useStockStore((s) => s.selectedView);
  const selectedTicker = useStockStore((s) => s.selectedTicker);
  const selectTicker = useStockStore((s) => s.selectTicker);
  const tickers = useWatchlistStore((s) => s.tickers);
  const hydrated = useWatchlistStore((s) => s.hydrated);
  const fetchWatchlist = useWatchlistStore((s) => s.fetchWatchlist);

  const [quotes, setQuotes] = useState<Record<string, StockQuote | null>>({});
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      void fetchWatchlist();
    }
  }, [hydrated, fetchWatchlist]);

  useEffect(() => {
    if (!tickers.length) {
      setQuotes({});
      return;
    }
    let cancelled = false;
    setLoadingQuotes(true);

    async function load() {
      const results = await Promise.all(
        tickers.map(async (ticker) => {
          try {
            const { data } = await axios.get<StockQuote>(
              `${API_BASE_URL}/api/stock/${encodeURIComponent(ticker)}`,
            );
            return [ticker, data] as const;
          } catch {
            return [ticker, null] as const;
          }
        }),
      );
      if (!cancelled) {
        setQuotes(Object.fromEntries(results));
        setLoadingQuotes(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tickers]);

  return (
    <>
      <div className="border-b border-border pb-4">
        <div className="flex items-stretch gap-2">
          <div
            className="ticker-scroll relative min-w-0 flex-1 overflow-x-auto"
            role="group"
            aria-label="Watchlist tickers"
          >
            <div className="flex min-w-max items-stretch gap-2 pr-2">
              {hydrated && tickers.length === 0 && (
                <button
                  type="button"
                  onClick={() => setManageOpen(true)}
                  className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition hover:border-muted-foreground/40"
                >
                  Add tickers to your watchlist
                </button>
              )}

              {tickers.map((ticker) => {
                const quote = quotes[ticker];
                const positive = (quote?.changePct ?? 0) >= 0;
                const isActive =
                  selectedView === 'ticker' && selectedTicker === ticker;

                return (
                  <button
                    key={ticker}
                    type="button"
                    onClick={() => selectTicker(ticker)}
                    aria-pressed={isActive}
                    className={`min-h-[58px] rounded-lg border px-3 py-2 text-left transition ${
                      isActive
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">
                      {ticker}
                    </div>
                    {loadingQuotes && !quote ? (
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

          <button
            type="button"
            onClick={() => setManageOpen(true)}
            title="Add ticker"
            aria-label="Add ticker"
            className="inline-flex min-h-[58px] w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xl font-medium text-foreground transition hover:border-muted-foreground/40"
          >
            +
          </button>
        </div>
      </div>

      <ManageWatchlistModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </>
  );
}
