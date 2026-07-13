import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useStockStore } from '@/store/stockStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import type { AIAnalysis } from '@/types/stock.types';
import { getSignalMeta, toneClass } from '@/utils/signalLabels';

interface WatchListProps {
  analysis?: AIAnalysis | null;
}

export default function WatchList({ analysis = null }: WatchListProps) {
  const activeTicker = useStockStore((s) => s.activeTicker);
  const setActiveTicker = useStockStore((s) => s.setActiveTicker);
  const tickers = useWatchlistStore((s) => s.tickers);
  const loading = useWatchlistStore((s) => s.loading);
  const error = useWatchlistStore((s) => s.error);
  const hydrated = useWatchlistStore((s) => s.hydrated);
  const fetchWatchlist = useWatchlistStore((s) => s.fetchWatchlist);
  const addTicker = useWatchlistStore((s) => s.addTicker);
  const removeTicker = useWatchlistStore((s) => s.removeTicker);

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      void fetchWatchlist();
    }
  }, [hydrated, fetchWatchlist]);

  const sorted = useMemo(() => {
    const scoreMap: Record<string, number> = {};
    if (analysis?.ticker) {
      scoreMap[analysis.ticker.toUpperCase()] = analysis.overallScore;
    }
    return [...tickers].sort((a, b) => {
      const sa = scoreMap[a] ?? -1;
      const sb = scoreMap[b] ?? -1;
      if (sa === sb) return a.localeCompare(b);
      return sb - sa;
    });
  }, [tickers, analysis]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const symbol = draft.trim().toUpperCase();
    if (!symbol || busy) return;
    setBusy(true);
    try {
      await addTicker(symbol);
      setDraft('');
      setActiveTicker(symbol);
    } catch {
      // error surfaced via store
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(ticker: string) {
    if (busy) return;
    setBusy(true);
    try {
      await removeTicker(ticker);
      if (activeTicker === ticker) {
        const remaining = useWatchlistStore.getState().tickers;
        if (remaining[0]) setActiveTicker(remaining[0]);
      }
    } catch {
      // error surfaced via store
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">Watchlist</h3>
        <span className="text-xs text-muted-foreground">
          {tickers.length} symbol{tickers.length === 1 ? '' : 's'}
        </span>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="mb-4 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          placeholder="Add ticker"
          maxLength={10}
          aria-label="Ticker symbol"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-muted-foreground/60"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {error && (
        <p className="mb-3 text-sm text-bearish" role="alert">
          {error}
        </p>
      )}

      {loading && !hydrated && (
        <div
          className="animate-pulse space-y-2"
          aria-busy="true"
          aria-label="Loading watchlist"
        >
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
          <div className="h-10 rounded-lg bg-muted" />
        </div>
      )}

      {!loading && hydrated && tickers.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Your watchlist is empty. Add a ticker to start tracking it.
        </p>
      )}

      {sorted.length > 0 && (
        <ul className="space-y-2" aria-label="Watchlist symbols">
          {sorted.map((ticker) => {
            const isActive = ticker === activeTicker;
            const activeScore =
              analysis?.ticker?.toUpperCase() === ticker
                ? analysis.overallScore
                : null;
            const meta =
              activeScore != null
                ? getSignalMeta(analysis?.signal, activeScore)
                : null;
            return (
              <li key={ticker}>
                <div
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                    isActive
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTicker(ticker)}
                    aria-pressed={isActive}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-sm font-semibold tracking-wide text-foreground">
                      {ticker}
                    </span>
                    {meta && activeScore != null ? (
                      <span
                        className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${toneClass(meta.tone)}`}
                      >
                        {meta.short} · {activeScore}
                      </span>
                    ) : (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        Select to view signal
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRemove(ticker)}
                    disabled={busy}
                    aria-label={`Remove ${ticker}`}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
