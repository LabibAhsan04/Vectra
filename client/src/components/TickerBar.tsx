import { useEffect, useState } from 'react';
import axios from 'axios';
import type { WatchlistSnapshotItem } from '@/types/stock.types';
import { useStockStore } from '@/store/stockStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { API_BASE_URL } from '@/utils/constants';
import { formatChangePct } from '@/utils/formatters';
import { getSignalMeta, toneClass } from '@/utils/signalLabels';
import ManageWatchlistModal from './ManageWatchlistModal';

function formatSignalChange(stamp: string | null): string | null {
  if (!stamp) return null;
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric' });
}

export default function TickerBar() {
  const selectedView = useStockStore((s) => s.selectedView);
  const selectedTicker = useStockStore((s) => s.selectedTicker);
  const selectTicker = useStockStore((s) => s.selectTicker);
  const tickers = useWatchlistStore((s) => s.tickers);
  const hydrated = useWatchlistStore((s) => s.hydrated);
  const fetchWatchlist = useWatchlistStore((s) => s.fetchWatchlist);

  const [snapshot, setSnapshot] = useState<WatchlistSnapshotItem[]>([]);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      void fetchWatchlist();
    }
  }, [hydrated, fetchWatchlist]);

  useEffect(() => {
    if (!tickers.length) {
      setSnapshot([]);
      return;
    }
    let cancelled = false;
    setLoadingSnapshot(true);
    void (async () => {
      try {
        const { data } = await axios.get<WatchlistSnapshotItem[]>(
          `${API_BASE_URL}/api/watchlist/snapshot`,
          { params: { tickers: tickers.join(',') } },
        );
        if (!cancelled) {
          setSnapshot(data);
          setLoadingSnapshot(false);
        }
      } catch {
        if (!cancelled) {
          setSnapshot([]);
          setLoadingSnapshot(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tickers]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if (typing) return;
      if (event.key === '/') {
        event.preventDefault();
        setManageOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const snapshotByTicker = Object.fromEntries(snapshot.map((item) => [item.ticker, item]));

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
                const item = snapshotByTicker[ticker];
                const quote = item?.quote;
                const signal = item?.latestSignal;
                const positive = (quote?.changePct ?? 0) >= 0;
                const isActive =
                  selectedView === 'ticker' && selectedTicker === ticker;
                const signalMeta = getSignalMeta(
                  signal?.finalLabel,
                  signal?.finalScore,
                );
                const changedAt = formatSignalChange(item?.signalChangedAt ?? null);

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
                    <div className="flex items-center gap-1.5">
                      {loadingSnapshot && !signal ? (
                        <span className="h-4 w-9 animate-pulse rounded bg-muted" />
                      ) : (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${toneClass(signalMeta.tone)}`}
                        >
                          {signalMeta.internal}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-foreground">
                        {ticker}
                      </span>
                    </div>
                    {loadingSnapshot && !quote ? (
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
                    {changedAt ? (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        Signal {changedAt}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setManageOpen(true)}
            title="Add ticker (press /)"
            aria-label="Add ticker"
            className="inline-flex min-h-[58px] w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xl font-medium text-foreground transition hover:border-muted-foreground/40"
          >
            +
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Press / to search tickers</p>
      </div>

      <ManageWatchlistModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </>
  );
}
