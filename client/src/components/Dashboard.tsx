import { useMemo, useState } from 'react';
import TickerBar from './TickerBar';
import StockCard from './StockCard';
import PriceChart from './PriceChart';
import NewsPanel from './NewsPanel';
import AIAnalysisPanel from './AIAnalysis';
import WatchList from './WatchList';
import { useStockStore } from '@/store/stockStore';
import { useStockData } from '@/hooks/useStockData';
import type { AIAnalysis, NewsItem } from '@/types/stock.types';

export default function Dashboard() {
  const activeTicker = useStockStore((s) => s.activeTicker);
  const { data, loading, error } = useStockData(activeTicker);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);

  const sentimentByHeadline = useMemo(() => {
    const map: Record<string, NewsItem['sentiment']> = {};
    for (const item of analysis?.newsItems ?? []) {
      map[item.headline] = item.sentiment;
    }
    return map;
  }, [analysis]);

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
        <div className="order-2 space-y-6 lg:order-1">
          <StockCard quote={data} loading={loading} error={error} />
          <PriceChart key={activeTicker} ticker={activeTicker} />
          <AIAnalysisPanel
            key={`ai-${activeTicker}`}
            ticker={activeTicker}
            onAnalysis={setAnalysis}
          />
        </div>
        <div className="order-1 space-y-6 lg:order-2">
          <WatchList />
          <NewsPanel
            ticker={activeTicker}
            sentimentByHeadline={sentimentByHeadline}
          />
        </div>
      </main>
    </div>
  );
}
