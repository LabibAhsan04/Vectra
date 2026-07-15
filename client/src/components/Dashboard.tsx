import { useMemo, useState } from 'react';
import TickerBar from './TickerBar';
import StockCard from './StockCard';
import PriceChart from './PriceChart';
import NewsPanel from './NewsPanel';
import AIAnalysisPanel from './AIAnalysis';
import QuickStats from './QuickStats';
import AlertsPanel from './AlertsPanel';
import SignalHistoryChart from './SignalHistoryChart';
import BacktestingPanel from './BacktestingPanel';
import HomeOverview from './HomeOverview';
import PeerComparison from './PeerComparison';
import EarningsCard from './EarningsCard';
import ThemeToggle from './ThemeToggle';
import { useStockStore } from '@/store/stockStore';
import { useStockData } from '@/hooks/useStockData';
import { useLiveQuote } from '@/hooks/useLiveQuote';
import type { AIAnalysis, NewsItem } from '@/types/stock.types';

export default function Dashboard() {
  const selectedView = useStockStore((s) => s.selectedView);
  const selectedTicker = useStockStore((s) => s.selectedTicker);
  const goHome = useStockStore((s) => s.goHome);
  const activeTicker = selectedTicker ?? '';
  const { data, loading, error, fetchedAt } = useStockData(activeTicker);
  const { quote: liveQuote } = useLiveQuote(activeTicker, data);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [signalsLastUpdated, setSignalsLastUpdated] = useState<string | null>(null);

  const sentimentByHeadline = useMemo(() => {
    const map: Record<string, NewsItem['sentiment']> = {};
    for (const item of analysis?.newsItems ?? []) {
      map[item.headline] = item.sentiment;
    }
    return map;
  }, [analysis]);

  const lastUpdated = useMemo(() => {
    const stamps = [liveQuote?.timestamp, fetchedAt].filter(Boolean) as string[];
    if (!stamps.length) {
      const analysisStamp = analysis?.generatedAt;
      if (!analysisStamp) return null;
      stamps.push(analysisStamp);
    }
    const latest = stamps.reduce((a, b) =>
      new Date(a).getTime() > new Date(b).getTime() ? a : b,
    );
    const date = new Date(latest);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  }, [liveQuote?.timestamp, fetchedAt, analysis?.generatedAt]);

  function handleAnalysis(next: AIAnalysis | null) {
    setAnalysis(next);
    if (next) setHistoryRefresh((n) => n + 1);
  }

  const homeActive = selectedView === 'home';

  const signalsUpdatedLabel = useMemo(() => {
    if (!signalsLastUpdated) return null;
    const date = new Date(signalsLastUpdated);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [signalsLastUpdated]);

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <img
              src="/vectra-logo.png"
              alt="Vectra"
              className="h-12 w-auto shrink-0 sm:h-14"
              width={400}
              height={310}
            />
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Vectra
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
                Evidence-based stock signal intelligence
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Real-time BUY · HOLD · SELL research signals
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggle />
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
            {signalsUpdatedLabel ? (
              <p className="text-xs text-muted-foreground">
                Signals updated {signalsUpdatedLabel}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <TickerBar onLastUpdated={setSignalsLastUpdated} />

      <main className="mx-auto mt-6 flex max-w-7xl flex-col gap-6">
        {homeActive ? (
          <HomeOverview />
        ) : activeTicker ? (
          <>
            <StockCard
              quote={liveQuote}
              loading={loading}
              error={error}
              lastUpdated={lastUpdated}
            />

            <QuickStats
              analysis={analysis}
              lastUpdated={lastUpdated}
              loading={analysisLoading && !analysis}
            />

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
              <div className="space-y-6">
                <PriceChart key={activeTicker} ticker={activeTicker} />
                <EarningsCard key={`earnings-${activeTicker}`} ticker={activeTicker} />
                <NewsPanel
                  key={`news-${activeTicker}`}
                  ticker={activeTicker}
                  companyName={liveQuote?.companyName}
                  sentimentByHeadline={sentimentByHeadline}
                />
              </div>
              <div className="space-y-6">
                <AIAnalysisPanel
                  key={`ai-${activeTicker}`}
                  ticker={activeTicker}
                  onAnalysis={handleAnalysis}
                  onLoadingChange={setAnalysisLoading}
                />
                <PeerComparison ticker={activeTicker} />
              </div>
            </div>

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
        <p className="mt-1">Research use only. Not financial advice.</p>
      </footer>
    </div>
  );
}
