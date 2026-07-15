import { useEffect, useState } from 'react';
import axios from 'axios';
import type { SignalAlert } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';

interface AlertsPanelProps {
  ticker: string;
  refreshKey?: number;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AlertsPanel({ ticker, refreshKey = 0 }: AlertsPanelProps) {
  const [alerts, setAlerts] = useState<SignalAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await axios.get<SignalAlert[]>(`${API_BASE_URL}/api/alerts`, {
          params: { ticker },
        });
        if (!cancelled) {
          setAlerts(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, 'Failed to load alerts'));
          setAlerts([]);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, refreshKey]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h3 className="mb-3 text-lg font-semibold text-foreground">
        Recent Signal Alerts
      </h3>
      {error ? (
        <p className="text-sm text-bearish" role="alert">
          {error}
        </p>
      ) : null}
      {!error && alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No signal alerts yet. Alerts appear when the signal label, score, momentum,
          or sentiment changes meaningfully.
        </p>
      ) : null}
      {alerts.length > 0 ? (
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="rounded-lg border border-border/70 px-3 py-2"
            >
              <p className="text-sm text-foreground">{alert.message}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatTime(alert.timestamp)} · {alert.alertType.replaceAll('_', ' ')}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
