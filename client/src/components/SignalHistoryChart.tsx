import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SignalHistoryPoint } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import { getSignalMeta } from '@/utils/signalLabels';

interface SignalHistoryChartProps {
  ticker: string;
  refreshKey?: number;
}

export default function SignalHistoryChart({
  ticker,
  refreshKey = 0,
}: SignalHistoryChartProps) {
  const [points, setPoints] = useState<SignalHistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await axios.get<SignalHistoryPoint[]>(
          `${API_BASE_URL}/api/signals/${encodeURIComponent(ticker)}/history`,
        );
        if (!cancelled) {
          setPoints(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err, 'Failed to load signal history'));
          setPoints([]);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, refreshKey]);

  const rows = useMemo(
    () =>
      points.map((p) => ({
        ...p,
        label: getSignalMeta(p.finalLabel, p.finalScore).label,
        t: new Date(p.timestamp).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
      })),
    [points],
  );

  const stroke = useMemo(() => {
    const last = points[points.length - 1];
    if (!last) return 'var(--color-neutral)';
    const tone = getSignalMeta(last.finalLabel, last.finalScore).tone;
    if (tone === 'bullish') return 'var(--color-bullish)';
    if (tone === 'bearish') return 'var(--color-bearish)';
    return 'var(--color-neutral)';
  }, [points]);

  const stats = useMemo(() => {
    if (!points.length) return null;
    const scores = points.map((p) => p.finalScore);
    return {
      latest: points[points.length - 1],
      count: points.length,
      high: Math.max(...scores),
      low: Math.min(...scores),
    };
  }, [points]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-foreground">Signal History</h3>
        <p className="text-xs text-muted-foreground">
          Saved final scores over time for {ticker}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-bearish" role="alert">
          {error}
        </p>
      ) : null}

      {!error && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Signal history will become more useful as Vectra tracks this ticker over time.
        </p>
      ) : null}

      {!error && stats && rows.length > 0 && rows.length < 3 ? (
        <div className="mb-3 rounded-lg border border-border bg-card-secondary px-3 py-2 text-xs text-muted-foreground">
          <p>
            Latest score:{' '}
            <span className="font-medium text-foreground">
              {stats.latest.finalScore}
            </span>
          </p>
          <p>
            Saved signals:{' '}
            <span className="font-medium text-foreground">{stats.count}</span>
            {stats.count > 0 ? (
              <>
                {' '}
                · High:{' '}
                <span className="font-medium text-foreground">{stats.high}</span> · Low:{' '}
                <span className="font-medium text-foreground">{stats.low}</span>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {!error && rows.length === 0 ? null : rows.length > 0 ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {[...rows].reverse().slice(0, 6).map((row) => (
              <span
                key={`${row.timestamp}-${row.finalScore}`}
                className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground"
              >
                {row.label} · {row.finalScore}
              </span>
            ))}
          </div>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--vectra-chart-grid)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="t"
                  tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, 100]}
                  width={36}
                  tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="finalScore"
                  name="Final score"
                  stroke={stroke}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : null}
    </section>
  );
}
