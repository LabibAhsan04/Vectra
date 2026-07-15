import type { AIAnalysis } from '@/types/stock.types';
import { getSignalMeta } from '@/utils/signalLabels';

interface QuickStatsProps {
  analysis: AIAnalysis | null;
  lastUpdated?: string | null;
  loading?: boolean;
}

function stat(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function yesNo(value: boolean | null | undefined): string {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return '—';
}

export default function QuickStats({
  analysis,
  lastUpdated,
  loading,
}: QuickStatsProps) {
  if (loading && !analysis) {
    return (
      <div
        className="animate-pulse rounded-xl border border-border bg-card-secondary px-4 py-3"
        aria-busy="true"
      >
        <div className="h-4 w-full rounded bg-muted" />
      </div>
    );
  }

  const qs = analysis?.quickStats;
  const signal = analysis
    ? getSignalMeta(analysis.signal, analysis.overallScore).internal
    : '—';
  const dataQuality = analysis?.dataQuality ?? '—';

  const parts = [
    `RSI ${stat(qs?.rsi != null ? Math.round(qs.rsi) : null)}`,
    `Rel Vol ${stat(qs?.relativeVolume != null ? `${qs.relativeVolume.toFixed(1)}x` : null)}`,
    `Above MA20 ${yesNo(qs?.aboveMa20)}`,
    `Above MA50 ${yesNo(qs?.aboveMa50)}`,
    `Signal ${signal}`,
    `Data Quality ${dataQuality}`,
    lastUpdated ? `Updated ${lastUpdated}` : null,
  ].filter(Boolean);

  return (
    <section className="rounded-xl border border-border bg-card-secondary px-3 py-2.5 sm:px-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Quick stats
      </p>
      <p className="mt-1 text-xs leading-relaxed text-foreground">
        {parts.join(' · ')}
      </p>
    </section>
  );
}
