import { useEffect, useId, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartRange, PriceHistory, PricePoint } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatPrice } from '@/utils/formatters';

const RANGES: ChartRange[] = ['1M', '3M', '6M', '1Y', '5Y'];

interface PriceChartProps {
  ticker: string;
}

function errorMessage(err: unknown, ticker: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') {
      // Prefer short provider messages; strip huge connection dumps.
      if (detail.length > 220) {
        if (/429|rate limit/i.test(detail)) {
          return `Market data rate limit hit for ${ticker}. Wait a bit and retry.`;
        }
        if (/403|don't have access/i.test(detail)) {
          return `History unavailable for ${ticker} from current API plans. Try again shortly.`;
        }
        return `Unable to load chart for ${ticker}. Providers are temporarily unavailable.`;
      }
      return detail;
    }
    if (!err.response) {
      return `Cannot reach API at ${API_BASE_URL}. Is the backend running?`;
    }
  }
  return `Failed to load chart for ${ticker}`;
}

function formatAxisDate(value: string, range: ChartRange): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  if (range === '1M' || range === '3M') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: PricePoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-foreground">{point.date}</div>
      <div className="space-y-0.5 text-muted-foreground">
        <div>O {formatPrice(point.open)}</div>
        <div>H {formatPrice(point.high)}</div>
        <div>L {formatPrice(point.low)}</div>
        <div className="text-foreground">C {formatPrice(point.close)}</div>
      </div>
    </div>
  );
}

function yDomain(points: PricePoint[]): [number, number] {
  const values = points.map((p) => p.close).filter((v) => Number.isFinite(v));
  if (!values.length) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.02, 1);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.06;
  return [min - pad, max + pad];
}

export default function PriceChart({ ticker }: PriceChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const [range, setRange] = useState<ChartRange>('3M');
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const prevTickerRef = useRef(ticker);

  useEffect(() => {
    if (!ticker) {
      requestIdRef.current += 1;
      setPoints([]);
      setError(null);
      setLoading(false);
      prevTickerRef.current = ticker;
      return;
    }

    const tickerChanged = prevTickerRef.current !== ticker;
    prevTickerRef.current = ticker;

    const requestId = ++requestIdRef.current;
    let cancelled = false;

    // Avoid flashing the previous ticker's series when switching symbols.
    if (tickerChanged) {
      setPoints([]);
    }
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const { data } = await axios.get<PriceHistory>(
          `${API_BASE_URL}/api/stock/${encodeURIComponent(ticker)}/history`,
          { params: { range } },
        );
        if (cancelled || requestId !== requestIdRef.current) return;
        setPoints(data.points ?? []);
        setError(null);
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setError(errorMessage(err, ticker));
        if (tickerChanged) {
          setPoints([]);
        }
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker, range]);

  const trendUp = useMemo(() => {
    if (points.length < 2) return true;
    return points[points.length - 1].close >= points[0].close;
  }, [points]);

  const stroke = trendUp ? 'var(--color-bullish)' : 'var(--color-bearish)';
  const fillId = `price-fill-${gradientId}`;
  const domain = useMemo(() => yDomain(points), [points]);
  const showChart = points.length > 0;
  const showSkeleton = loading && !showChart;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">
          Price Chart
          {ticker ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {ticker}
            </span>
          ) : null}
        </h3>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                range === option
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {showSkeleton && (
        <div className="flex h-64 items-center justify-center">
          <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {!loading && error && !showChart && (
        <p className="flex h-64 items-center justify-center text-sm text-bearish">
          {error}
        </p>
      )}

      {!loading && !error && !showChart && (
        <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          No price history available.
        </p>
      )}

      {error && showChart && (
        <p className="mb-2 text-xs text-bearish">{error}</p>
      )}

      {showChart && (
        <div className={`h-64 w-full min-w-0 ${loading ? 'opacity-60' : ''}`}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={points}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) => formatAxisDate(value, range)}
                minTickGap={28}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                width={56}
                tickFormatter={(value: number) =>
                  value >= 1000
                    ? `$${(value / 1000).toFixed(1)}k`
                    : `$${value.toFixed(0)}`
                }
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="close"
                stroke={stroke}
                fill={`url(#${fillId})`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={!loading}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
