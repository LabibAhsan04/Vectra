import TickerBar from './TickerBar';
import StockCard from './StockCard';
import { useStockStore } from '@/store/stockStore';
import { useStockData } from '@/hooks/useStockData';

export default function Dashboard() {
  const activeTicker = useStockStore((s) => s.activeTicker);
  const { data, loading, error } = useStockData(activeTicker);

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Vectra
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stock intelligence dashboard
        </p>
      </header>

      <TickerBar />

      <main className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <StockCard quote={data} loading={loading} error={error} />
        <aside className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Charts, news, and analysis panels will appear in later phases.
          Click a ticker above to refresh the quote.
        </aside>
      </main>
    </div>
  );
}
