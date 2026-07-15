import type { StockQuote } from '@/types/stock.types';
import { formatChangePct, formatMarketCap, formatPrice } from '@/utils/formatters';

interface StockCardProps {
  quote: StockQuote | null;
  loading?: boolean;
  error?: string | null;
  lastUpdated?: string | null;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={`truncate text-sm font-medium tabular-nums ${
          tone === 'up' ? 'text-bullish' : tone === 'down' ? 'text-bearish' : 'text-foreground'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function StockCard({
  quote,
  loading,
  error,
  lastUpdated,
}: StockCardProps) {
  if (loading) {
    return (
      <div
        className="animate-pulse rounded-xl border border-border bg-card px-4 py-3"
        aria-busy="true"
        aria-label="Loading quote"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-7 w-32 rounded bg-muted" />
          </div>
          <div className="hidden h-8 flex-1 gap-6 sm:flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-16 rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-xl border border-bearish/40 bg-card px-4 py-3 text-sm text-bearish"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Select a ticker to view quote details.
      </div>
    );
  }

  const positive = quote.changePct >= 0;

  return (
    <article className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: identity + price */}
        <div className="min-w-0 shrink-0">
          <p className="truncate text-xs text-muted-foreground">{quote.companyName}</p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-xl font-semibold tracking-wide text-foreground">
              {quote.ticker}
            </h2>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {formatPrice(quote.price)}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                positive ? 'bg-bullish/15 text-bullish' : 'bg-bearish/15 text-bearish'
              }`}
            >
              {formatChangePct(quote.changePct)}
            </span>
          </div>
        </div>

        {/* Right: compact stats row */}
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 sm:flex sm:flex-wrap sm:items-end sm:justify-end sm:gap-x-5 sm:gap-y-1">
          <Stat
            label="Change"
            value={`${positive ? '+' : ''}${formatPrice(quote.change)}`}
            tone={positive ? 'up' : 'down'}
          />
          <Stat
            label="Volume"
            value={Number.isFinite(quote.volume) ? quote.volume.toLocaleString() : '—'}
          />
          <Stat
            label="Mkt Cap"
            value={Number.isFinite(quote.marketCap) ? formatMarketCap(quote.marketCap) : '—'}
          />
          <Stat
            label="52W High"
            value={Number.isFinite(quote.weekHigh52) ? formatPrice(quote.weekHigh52) : '—'}
          />
          <Stat
            label="52W Low"
            value={Number.isFinite(quote.weekLow52) ? formatPrice(quote.weekLow52) : '—'}
          />
        </dl>
      </div>

      {lastUpdated ? (
        <p className="mt-2 text-[11px] text-muted-foreground">Updated {lastUpdated}</p>
      ) : null}
    </article>
  );
}
