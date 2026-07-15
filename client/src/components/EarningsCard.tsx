import { useEffect, useState } from 'react';
import axios from 'axios';
import type { EarningsEvent } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

interface EarningsCardProps {
  ticker: string;
}

function formatExactDate(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatSession(hour: string | undefined): string {
  const key = (hour || '').trim().toLowerCase();
  if (key === 'bmo') return 'Before market open';
  if (key === 'amc') return 'After market close';
  if (key === 'dmh') return 'During market hours';
  if (!key) return 'Report time TBD';
  return hour!;
}

export default function EarningsCard({ ticker }: EarningsCardProps) {
  const [nextEvent, setNextEvent] = useState<EarningsEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data } = await axios.get<EarningsEvent[]>(
          `${API_BASE_URL}/api/earnings/${encodeURIComponent(ticker)}`,
        );
        if (!cancelled) {
          setNextEvent(data.length > 0 ? data[0] : null);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setNextEvent(null);
          setError(formatApiError(err, 'Earnings date unavailable.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (loading) {
    return (
      <div
        className="h-14 animate-pulse rounded-xl border border-border bg-card"
        aria-busy="true"
        aria-label="Loading earnings date"
      />
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">{error}</p>
      </section>
    );
  }

  if (!nextEvent) {
    return (
      <section className="rounded-xl border border-border bg-card px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Upcoming earnings report
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          No earnings date scheduled in the next 45 days.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Upcoming earnings report
      </p>
      <p className="mt-1 text-base font-semibold text-foreground">
        {formatExactDate(nextEvent.date)}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {formatSession(nextEvent.hour)} · {ticker}
        {nextEvent.epsEstimate != null
          ? ` · EPS est. ${nextEvent.epsEstimate}`
          : ''}
      </p>
    </section>
  );
}
