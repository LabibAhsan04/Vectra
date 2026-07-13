import { useEffect, useId, useRef, useState } from 'react';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useStockStore } from '@/store/stockStore';
import { WATCHLIST_LIMIT } from '@/utils/constants';
import type { SymbolSearchHit } from '@/store/watchlistStore';

interface ManageWatchlistModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ManageWatchlistModal({
  open,
  onClose,
}: ManageWatchlistModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const entries = useWatchlistStore((s) => s.entries);
  const tickers = useWatchlistStore((s) => s.tickers);
  const error = useWatchlistStore((s) => s.error);
  const addTicker = useWatchlistStore((s) => s.addTicker);
  const removeTicker = useWatchlistStore((s) => s.removeTicker);
  const searchSymbols = useWatchlistStore((s) => s.searchSymbols);
  const selectTicker = useStockStore((s) => s.selectTicker);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SymbolSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setLocalMsg(null);
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = await searchSymbols(q);
          if (!cancelled) {
            setResults(hits);
            setLocalMsg(hits.length === 0 ? 'No matching tickers found.' : null);
          }
        } catch {
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, open, searchSymbols]);

  if (!open) return null;

  async function onAdd(hit: SymbolSearchHit) {
    if (busy) return;
    setBusy(true);
    setLocalMsg(null);
    try {
      await addTicker({
        ticker: hit.symbol,
        companyName: hit.companyName,
        exchange: hit.exchange,
        assetType: hit.assetType,
      });
      selectTicker(hit.symbol.toUpperCase());
      setLocalMsg(null);
    } catch {
      // store surfaces error
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(symbol: string) {
    if (busy) return;
    setBusy(true);
    setLocalMsg(null);
    try {
      await removeTicker(symbol);
      const remaining = useWatchlistStore.getState().tickers;
      const state = useStockStore.getState();
      if (state.selectedTicker === symbol) {
        if (remaining[0]) selectTicker(remaining[0]);
        else state.goHome();
      }
    } catch {
      // store surfaces error
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              Manage Watchlist
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Watchlist: {tickers.length} / {WATCHLIST_LIMIT}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <label className="mb-3 block">
          <span className="sr-only">Search ticker or company name</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker or company name..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-muted-foreground/60"
          />
        </label>

        {(error || localMsg) && (
          <p className="mb-3 text-xs text-bearish" role="status">
            {error || localMsg}
          </p>
        )}

        <div className="mb-4 max-h-44 space-y-2 overflow-y-auto">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Search results
          </h3>
          {searching && (
            <p className="text-xs text-muted-foreground">Searching…</p>
          )}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground">No matching tickers found.</p>
          )}
          {!searching &&
            results.map((hit) => {
              const inList = tickers.includes(hit.symbol.toUpperCase());
              return (
                <div
                  key={`${hit.symbol}-${hit.companyName}`}
                  className="flex items-center gap-2 rounded-lg border border-border/70 px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {hit.symbol}{' '}
                      <span className="font-normal text-muted-foreground">
                        — {hit.companyName}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {hit.exchange} · {hit.assetType}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy || inList || tickers.length >= WATCHLIST_LIMIT}
                    onClick={() => void onAdd(hit)}
                    className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-muted-foreground/50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {inList ? 'Added' : 'Add'}
                  </button>
                </div>
              );
            })}
          {query.trim().length < 2 && (
            <p className="text-xs text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          )}
        </div>

        <div className="max-h-52 space-y-2 overflow-y-auto border-t border-border pt-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Current watchlist
          </h3>
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Your watchlist is empty. Search above to add tickers.
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.ticker}
                className="flex items-center gap-2 rounded-lg border border-border/70 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {entry.ticker}
                    {entry.companyName ? (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        — {entry.companyName}
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onRemove(entry.ticker)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
