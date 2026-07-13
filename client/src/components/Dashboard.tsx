import { useMemo, useState } from 'react';
import TickerBar from './TickerBar';
import StockCard from './StockCard';
import PriceChart from './PriceChart';
import NewsPanel from './NewsPanel';
import AIAnalysisPanel from './AIAnalysis';
import WatchList from './WatchList';
import AlertsPanel from './AlertsPanel';
import SignalHistoryChart from './SignalHistoryChart';
import BacktestingPanel from './BacktestingPanel';
import { useStockStore } from '@/store/stockStore';
import { useStockData } from '@/hooks/useStockData';
import type { AIAnalysis, NewsItem } from '@/types/stock.types';

export default function Dashboard() {
  const activeTicker = useStockStore((s) => s.activeTicker);
  const { data, loading, error } = useStockData(activeTicker);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const sentimentByHeadline = useMemo(() => {
    const map: Record<string, NewsItem['sentiment']> = {};
    for (const item of analysis?.newsItems ?? []) {
      map[item.headline] = item.sentiment;
    }
    return map;
  }, [analysis]);

  const lastUpdated = useMemo(() => {
    const stamp = data?.timestamp || analysis?.generatedAt;
    if (!stamp) return null;
    const date = new Date(stamp);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [data?.timestamp, analysis?.generatedAt]);

  function handleAnalysis(next: AIAnalysis | null) {
    setAnalysis(next);
    if (next) setHistoryRefresh((n) => n + 1);
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Vectra
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Evidence-based stock signal intelligence
            </p>
          </div>
          {lastUpdated ? (
            <p className="text-xs text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          ) : null}
        </div>
      </header>

      <TickerBar />

      <main className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="order-2 space-y-6 lg:order-1">
          <StockCard
            quote={data}
            loading={loading}
            error={error}
            lastUpdated={lastUpdated}
          />
          <PriceChart key={activeTicker} ticker={activeTicker} />
          <AIAnalysisPanel
            key={`ai-${activeTicker}`}
            ticker={activeTicker}
            onAnalysis={handleAnalysis}
          />
          <SignalHistoryChart
            key={`hist-${activeTicker}`}
            ticker={activeTicker}
            refreshKey={historyRefresh}
          />
          <BacktestingPanel
            key={`bt-${activeTicker}`}
            ticker={activeTicker}
            refreshKey={historyRefresh}
          />
        </div>
        <div className="order-1 space-y-6 lg:order-2">
          <WatchList analysis={analysis} />
          <AlertsPanel
            key={`alerts-${activeTicker}`}
            ticker={activeTicker}
            refreshKey={historyRefresh}
          />
          <NewsPanel
            key={`news-${activeTicker}`}
            ticker={activeTicker}
            companyName={data?.companyName}
            sentimentByHeadline={sentimentByHeadline}
          />
        </div>
      </main>

      <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">
        <p>Vectra — Evidence-based stock signal intelligence.</p>
        <p className="mt-1">
          For educational and research purposes only. Not financial advice. Does not
          execute trades.
        </p>
      </footer>
    </div>
  );
}
