import type { StockQuote } from '@/types/stock.types';
import { formatChangePct, formatMarketCap, formatPrice } from '@/utils/formatters';

interface StockCardProps {
  quote: StockQuote | null;
  loading?: boolean;
  error?: string | null;
}

export default function StockCard({ quote, loading, error }: StockCardProps) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-border bg-card p-6">
        <div className="mb-4 h-4 w-24 rounded bg-muted" />
        <div className="mb-2 h-10 w-40 rounded bg-muted" />
        <div className="h-4 w-32 rounded bg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-bearish/40 bg-card p-6 text-bearish">
        {error}
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
        Select a ticker to view quote details.
      </div>
    );
  }

  const positive = quote.changePct >= 0;

  return (
    <article className="rounded-xl border border-border bg-card p-6">
      <div className="mb-1 text-sm text-muted-foreground">{quote.companyName}</div>
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-2xl font-semibold tracking-wide text-foreground">
          {quote.ticker}
        </h2>
        <span
          className={`rounded-md px-2 py-0.5 text-sm font-medium ${
            positive
              ? 'bg-bullish/15 text-bullish'
              : 'bg-bearish/15 text-bearish'
          }`}
        >
          {formatChangePct(quote.changePct)}
        </span>
      </div>

      <p className="mb-6 text-4xl font-semibold tabular-nums text-foreground">
        {formatPrice(quote.price)}
      </p>

      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Change</dt>
          <dd
            className={`font-medium tabular-nums ${
              positive ? 'text-bullish' : 'text-bearish'
            }`}
          >
            {positive ? '+' : ''}
            {formatPrice(quote.change)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Volume</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {quote.volume.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Market Cap</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatMarketCap(quote.marketCap)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">52W High</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatPrice(quote.weekHigh52)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">52W Low</dt>
          <dd className="font-medium tabular-nums text-foreground">
            {formatPrice(quote.weekLow52)}
          </dd>
        </div>
      </dl>
    </article>
  );
}
