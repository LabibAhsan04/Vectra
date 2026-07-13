import { useEffect, useRef, useState } from 'react';

interface ScoreGaugeProps {
  score: number;
  signal?: 'buy' | 'hold' | 'sell';
  size?: number;
  className?: string;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreColor(score: number): string {
  if (score >= 65) return 'var(--color-bullish)';
  if (score <= 40) return 'var(--color-bearish)';
  return 'var(--color-neutral)';
}

function signalLabel(signal: ScoreGaugeProps['signal'], score: number): string {
  if (signal === 'buy' || signal === 'hold' || signal === 'sell') {
    return signal.toUpperCase();
  }
  if (score >= 65) return 'BUY';
  if (score <= 40) return 'SELL';
  return 'HOLD';
}

export default function ScoreGauge({
  score,
  signal,
  size = 148,
  className = '',
}: ScoreGaugeProps) {
  const target = clampScore(score);
  const [display, setDisplay] = useState(target);
  const displayRef = useRef(display);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const from = displayRef.current;
    if (reduceMotion || from === target) {
      displayRef.current = target;
      frame = requestAnimationFrame(() => {
        if (!cancelled) setDisplay(target);
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }

    const durationMs = 700;
    const start = performance.now();

    const tick = (now: number) => {
      if (cancelled) return;
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (target - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [target]);

  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - display / 100);
  const color = scoreColor(target);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Score ${target} out of 100, ${signalLabel(signal, target)}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke 200ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums text-foreground">
          {display}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {signalLabel(signal, target)}
        </span>
      </div>
    </div>
  );
}
