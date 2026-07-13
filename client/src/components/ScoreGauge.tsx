import { useEffect, useRef, useState } from 'react';
import { getSignalMeta, internalCircleLabel } from '@/utils/signalLabels';

interface ScoreGaugeProps {
  score: number;
  signal?: string;
  size?: number;
  className?: string;
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreColor(tone: 'bullish' | 'neutral' | 'bearish'): string {
  if (tone === 'bullish') return 'var(--color-bullish)';
  if (tone === 'bearish') return 'var(--color-bearish)';
  return 'var(--color-neutral)';
}

export default function ScoreGauge({
  score,
  signal,
  size = 148,
  className = '',
}: ScoreGaugeProps) {
  const target = clampScore(score);
  const meta = getSignalMeta(signal, target);
  const internal = internalCircleLabel(signal, target);
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
  const color = scoreColor(meta.tone);

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size }}
        role="img"
        aria-label={`Score ${target} out of 100. Internal signal ${internal}. Public research label ${meta.label}.`}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
          <span className="text-3xl font-semibold tabular-nums text-foreground">
            {display}
          </span>
          <span
            className={`text-[11px] font-bold tracking-wide ${
              meta.tone === 'bullish'
                ? 'text-bullish'
                : meta.tone === 'bearish'
                  ? 'text-bearish'
                  : 'text-muted-foreground'
            }`}
          >
            {internal}
          </span>
          <span className="text-[10px] tracking-wide text-muted-foreground">
            Internal Signal
          </span>
        </div>
      </div>
      <p className="mt-2 max-w-[11rem] text-center text-[10px] leading-snug text-muted-foreground">
        Internal interpretation only — not financial advice.
      </p>
    </div>
  );
}
