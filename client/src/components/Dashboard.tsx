import { useMemo, useState } from 'react';
import TickerBar from './TickerBar';
import StockCard from './StockCard';
import PriceChart from './PriceChart';
import NewsPanel from './NewsPanel';
import AIAnalysisPanel from './AIAnalysis';
import AlertsPanel from './AlertsPanel';
import SignalHistoryChart from './SignalHistoryChart';
import BacktestingPanel from './BacktestingPanel';
import HomeOverview from './HomeOverview';
import { useStockStore } from '@/store/stockStore';
import { useStockData } from '@/hooks/useStockData';
import type { AIAnalysis, NewsItem } from '@/types/stock.types';

export default function Dashboard() {
  const selectedView = useStockStore((s) => s.selectedView);
  const selectedTicker = useStockStore((s) => s.selectedTicker);
  const goHome = useStockStore((s) => s.goHome);
  const activeTicker = selectedTicker ?? '';
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

  const homeActive = selectedView === 'home';

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Vectra
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Stock intelligence dashboard
            </p>
          </div>
          <button
            type="button"
            onClick={goHome}
            aria-pressed={homeActive}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              homeActive
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
            }`}
          >
            Home
          </button>
        </div>
      </header>

      <TickerBar />

      <main className="mx-auto mt-6 flex max-w-5xl flex-col gap-6">
        {homeActive ? (
          <HomeOverview />
        ) : activeTicker ? (
          <>
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
            <NewsPanel
              key={`news-${activeTicker}`}
              ticker={activeTicker}
              companyName={data?.companyName}
              sentimentByHeadline={sentimentByHeadline}
            />
            <AlertsPanel
              key={`alerts-${activeTicker}`}
              ticker={activeTicker}
              refreshKey={historyRefresh}
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
          </>
        ) : (
          <HomeOverview />
        )}
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
