import { useEffect, useState } from 'react';
import axios from 'axios';
import type { EarningsEvent } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

interface EarningsCardProps {
  ticker: string;
}

export default function EarningsCard({ ticker }: EarningsCardProps) {
  const [events, setEvents] = useState<EarningsEvent[]>([]);
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
          setEvents(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setEvents([]);
          setError(formatApiError(err, 'Earnings calendar unavailable.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Upcoming Catalysts</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Earnings and key dates</p>

      {loading ? (
        <div className="mt-3 h-12 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : null}
      {!loading && error ? (
        <p className="mt-3 text-sm text-muted-foreground">{error}</p>
      ) : null}
      {!loading && !error && events.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No upcoming earnings dates found in the next 45 days.
        </p>
      ) : null}
      {!loading && events.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {events.slice(0, 4).map((event) => (
            <li
              key={`${event.date}-${event.label}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card-secondary px-3 py-2 text-sm"
            >
              <span className="text-foreground">{event.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{event.date}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
