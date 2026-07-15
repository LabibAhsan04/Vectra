import { useEffect, useId, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartRange, PriceHistory, PricePoint } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import { formatPrice } from '@/utils/formatters';

const RANGES: ChartRange[] = ['1M', '3M', '6M', '1Y', '5Y'];

const RANGE_LABELS: Record<ChartRange, string> = {
  '1M': '1 month',
  '3M': '3 months',
  '6M': '6 months',
  '1Y': '1 year',
  '5Y': '5 years',
};

interface PriceChartProps {
  ticker: string;
}

type ChartRow = PricePoint & {
  ma20?: number | null;
  ma50?: number | null;
  bbUpper?: number | null;
  bbLower?: number | null;
  macd?: number | null;
};

function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i += 1) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function withIndicators(points: PricePoint[]): ChartRow[] {
  const closes = points.map((p) => p.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  return points.map((point, index) => {
    const ma20Window = points.slice(Math.max(0, index - 19), index + 1);
    const ma50Window = points.slice(Math.max(0, index - 49), index + 1);
    const bbWindow = points.slice(Math.max(0, index - 19), index + 1);
    const bbMean =
      bbWindow.length >= 20
        ? bbWindow.reduce((sum, p) => sum + p.close, 0) / bbWindow.length
        : null;
    let bbUpper: number | null = null;
    let bbLower: number | null = null;
    if (bbMean != null && bbWindow.length >= 20) {
      const variance =
        bbWindow.reduce((sum, p) => sum + (p.close - bbMean) ** 2, 0) / bbWindow.length;
      const std = Math.sqrt(variance);
      bbUpper = bbMean + 2 * std;
      bbLower = bbMean - 2 * std;
    }
    const macd =
      ema12[index] != null && ema26[index] != null ? ema12[index] - ema26[index] : null;
    return {
      ...point,
      ma20:
        ma20Window.length >= 20
          ? ma20Window.reduce((sum, p) => sum + p.close, 0) / ma20Window.length
          : null,
      ma50:
        ma50Window.length >= 50
          ? ma50Window.reduce((sum, p) => sum + p.close, 0) / ma50Window.length
          : null,
      bbUpper,
      bbLower,
      macd,
    };
  });
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

function PriceChartBody({ ticker }: { ticker: string }) {
  const gradientId = useId().replace(/:/g, '');
  const [range, setRange] = useState<ChartRange>('3M');
  // Axis labels follow the range that produced `points`, not a failed selection.
  const [loadedRange, setLoadedRange] = useState<ChartRange>('3M');
  const [reloadKey, setReloadKey] = useState(0);
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMa20Toggle, setShowMa20Toggle] = useState(true);
  const [showMa50Toggle, setShowMa50Toggle] = useState(true);
  const [showBbToggle, setShowBbToggle] = useState(false);
  const [showMacdToggle, setShowMacdToggle] = useState(false);
  const [showVolumeToggle, setShowVolumeToggle] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let cancelled = false;
    const hadPoints = points.length > 0;

    // Fetch lifecycle: reset UI then load. Sync resets are intentional for ticker/range changes.
    /* eslint-disable react-hooks/set-state-in-effect -- data-fetch reset before async request */
    setLoading(true);
    setError(null);
    /* eslint-enable react-hooks/set-state-in-effect */

    async function load() {
      try {
        const { data } = await axios.get<PriceHistory>(
          `${API_BASE_URL}/api/stock/${encodeURIComponent(ticker)}/history`,
          { params: { range } },
        );
        if (cancelled || requestId !== requestIdRef.current) return;
        setPoints(data.points ?? []);
        setLoadedRange(range);
        setError(null);
        setLastUpdated(
          new Date().toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        );
      } catch (err) {
        if (cancelled || requestId !== requestIdRef.current) return;
        setError(
          formatApiError(err, `Failed to load chart for ${ticker}`, {
            short: true,
          }),
        );
        if (!hadPoints) {
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
    // `points.length` is sampled once per request to keep stale series on range failure.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit points
  }, [ticker, range, reloadKey]);

  const trendUp = useMemo(() => {
    if (points.length < 2) return true;
    return points[points.length - 1].close >= points[0].close;
  }, [points]);

  const stroke = trendUp ? 'var(--color-bullish)' : 'var(--color-bearish)';
  const fillId = `price-fill-${gradientId}`;
  const domain = useMemo(() => yDomain(points), [points]);
  const chartRows = useMemo(() => withIndicators(points), [points]);
  const showChart = points.length > 0;
  const showSkeleton = loading && !showChart;
  const pendingRange = showChart && range !== loadedRange;
  const hasMa20 = chartRows.some((p) => p.ma20 != null);
  const hasMa50 = chartRows.some((p) => p.ma50 != null);
  const hasBb = chartRows.some((p) => p.bbUpper != null);
  const hasMacd = chartRows.some((p) => p.macd != null);
  const showMa20 = hasMa20 && showMa20Toggle;
  const showMa50 = hasMa50 && showMa50Toggle;
  const showBb = hasBb && showBbToggle;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {ticker} price trend
          </h3>
          <p className="text-sm text-muted-foreground">
            {RANGE_LABELS[loadedRange] ?? loadedRange}
          </p>
          {lastUpdated ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Chart range">
            {RANGES.map((option) => {
              const isLoaded = loadedRange === option && showChart;
              const isPending = range === option && loading;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRange(option)}
                  aria-pressed={isLoaded}
                  aria-busy={isPending || undefined}
                  disabled={loading}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-60 ${
                    isLoaded
                      ? 'bg-primary/15 text-primary'
                      : isPending
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Moving averages">
            <button
              type="button"
              onClick={() => setShowMa20Toggle((v) => !v)}
              aria-pressed={showMa20Toggle}
              disabled={!hasMa20}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                showMa20Toggle
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              MA20
            </button>
            <button
              type="button"
              onClick={() => setShowMa50Toggle((v) => !v)}
              aria-pressed={showMa50Toggle}
              disabled={!hasMa50}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                showMa50Toggle
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              MA50
            </button>
            <button
              type="button"
              onClick={() => setShowBbToggle((v) => !v)}
              aria-pressed={showBbToggle}
              disabled={!hasBb}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                showBbToggle
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              BB
            </button>
            <button
              type="button"
              onClick={() => setShowMacdToggle((v) => !v)}
              aria-pressed={showMacdToggle}
              disabled={!hasMacd}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40 ${
                showMacdToggle
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              MACD
            </button>
            <button
              type="button"
              onClick={() => setShowVolumeToggle((v) => !v)}
              aria-pressed={showVolumeToggle}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                showVolumeToggle
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Vol
            </button>
          </div>
        </div>
      </div>

      {showSkeleton && (
        <div
          className="flex h-56 items-center justify-center sm:h-64"
          aria-busy="true"
          aria-label="Loading chart"
        >
          <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
        </div>
      )}

      {!loading && error && !showChart && (
        <div
          className="flex h-56 flex-col items-center justify-center gap-3 text-center sm:h-64"
          role="alert"
        >
          <p className="text-sm text-bearish">{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-muted-foreground/50"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && !showChart && (
        <p className="flex h-56 items-center justify-center text-sm text-muted-foreground sm:h-64">
          No price history available.
        </p>
      )}

      {error && showChart && (
        <p className="mb-2 text-xs text-bearish" role="status">
          {pendingRange
            ? `Couldn’t load ${range}. Showing ${loadedRange} instead. ${error}`
            : error}{' '}
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Retry
          </button>
        </p>
      )}

      {showChart && (
        <div
          className={`h-56 w-full min-w-0 sm:h-64 ${loading ? 'opacity-60' : ''}`}
          aria-live="polite"
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
            <AreaChart
              data={chartRows}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--vectra-chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value: string) =>
                  formatAxisDate(value, loadedRange)
                }
                minTickGap={28}
                tick={{ fill: 'var(--vectra-muted-text)', fontSize: 11 }}
                axisLine={{ stroke: 'var(--vectra-border)' }}
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
                tick={{ fill: 'var(--vectra-muted-text)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                verticalAlign="top"
                height={24}
                wrapperStyle={{ fontSize: 11, color: 'var(--vectra-muted-text)' }}
              />
              <Area
                type="monotone"
                dataKey="close"
                name="Close"
                stroke={stroke}
                fill={`url(#${fillId})`}
                strokeWidth={2}
                dot={false}
                isAnimationActive={!loading}
                animationDuration={500}
              />
              {showMa20 ? (
                <Line
                  type="monotone"
                  dataKey="ma20"
                  name="MA20"
                  stroke="var(--color-muted-foreground)"
                  strokeWidth={1.25}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ) : null}
              {showMa50 ? (
                <Line
                  type="monotone"
                  dataKey="ma50"
                  name="MA50"
                  stroke="#a1a1aa"
                  strokeDasharray="4 4"
                  strokeWidth={1.25}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ) : null}
              {showBb ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="bbUpper"
                    name="BB Upper"
                    stroke="#71717a"
                    strokeWidth={1}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="bbLower"
                    name="BB Lower"
                    stroke="#71717a"
                    strokeWidth={1}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </>
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {showChart && showVolumeToggle ? (
        <div className="mt-3 h-16 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={chartRows} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" hide />
              <YAxis hide width={0} />
              <Bar dataKey="volume" fill="var(--color-muted-foreground)" opacity={0.45} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {showChart && showMacdToggle ? (
        <div className="mt-3 h-16 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={chartRows} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="date" hide />
              <YAxis hide width={0} />
              <Line
                type="monotone"
                dataKey="macd"
                stroke="#60a5fa"
                strokeWidth={1.25}
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  );
}

export default function PriceChart({ ticker }: PriceChartProps) {
  if (!ticker) {
    return (
      <section className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground sm:p-6">
        Select a ticker to view price history.
      </section>
    );
  }

  return <PriceChartBody ticker={ticker} />;
}
