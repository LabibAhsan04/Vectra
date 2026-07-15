import { API_BASE_URL } from '@/utils/constants';

interface ExportMenuProps {
  ticker?: string;
  watchlistTickers?: string[];
}

export default function ExportMenu({ ticker, watchlistTickers = [] }: ExportMenuProps) {
  const watchlistUrl =
    watchlistTickers.length > 0
      ? `${API_BASE_URL}/api/export/watchlist.csv?tickers=${encodeURIComponent(watchlistTickers.join(','))}`
      : null;
  const signalsUrl = ticker
    ? `${API_BASE_URL}/api/export/signals/${encodeURIComponent(ticker)}.csv`
    : null;
  const shareUrl = ticker
    ? `${API_BASE_URL}/api/share/${encodeURIComponent(ticker)}`
    : null;

  return (
    <div className="flex flex-wrap gap-2">
      {watchlistUrl ? (
        <a
          href={watchlistUrl}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-muted-foreground/40"
        >
          Export watchlist CSV
        </a>
      ) : null}
      {signalsUrl ? (
        <a
          href={signalsUrl}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-muted-foreground/40"
        >
          Export signals CSV
        </a>
      ) : null}
      {shareUrl ? (
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-muted-foreground/40"
        >
          Share snapshot JSON
        </a>
      ) : null}
    </div>
  );
}
