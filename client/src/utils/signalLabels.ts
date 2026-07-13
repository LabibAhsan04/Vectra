/** Display helpers: public research labels vs circle-only BUY/HOLD/SELL. */
import type { ResearchSignal } from '@/types/stock.types';

export interface SignalMeta {
  code: ResearchSignal;
  /** Public badge / paragraph label, e.g. "Bullish Signal" */
  label: string;
  /** Short public tone word, e.g. "Bullish" */
  short: string;
  /** Circle-only internal shorthand: BUY | HOLD | SELL */
  internal: 'BUY' | 'HOLD' | 'SELL';
  tone: 'bullish' | 'neutral' | 'bearish';
}

function entry(
  code: ResearchSignal,
  tone: SignalMeta['tone'],
  internal: SignalMeta['internal'],
): SignalMeta {
  const label =
    tone === 'bullish'
      ? 'Bullish Signal'
      : tone === 'bearish'
        ? 'Bearish Signal'
        : 'Neutral Signal';
  const short =
    tone === 'bullish' ? 'Bullish' : tone === 'bearish' ? 'Bearish' : 'Neutral';
  return { code, label, short, internal, tone };
}

const BY_CODE: Record<string, SignalMeta> = {
  strong_bullish: entry('strong_bullish', 'bullish', 'BUY'),
  bullish: entry('bullish', 'bullish', 'BUY'),
  neutral: entry('neutral', 'neutral', 'HOLD'),
  bearish: entry('bearish', 'bearish', 'SELL'),
  strong_bearish: entry('strong_bearish', 'bearish', 'SELL'),
  // Legacy API codes
  strong_buy: entry('strong_bullish', 'bullish', 'BUY'),
  buy: entry('bullish', 'bullish', 'BUY'),
  hold: entry('neutral', 'neutral', 'HOLD'),
  sell: entry('bearish', 'bearish', 'SELL'),
  strong_sell: entry('strong_bearish', 'bearish', 'SELL'),
};

export function signalFromScore(score: number): ResearchSignal {
  if (score >= 80) return 'strong_bullish';
  if (score >= 65) return 'bullish';
  if (score <= 20) return 'strong_bearish';
  if (score <= 40) return 'bearish';
  return 'neutral';
}

export function getSignalMeta(
  signal?: string | null,
  score?: number,
): SignalMeta {
  if (signal && signal in BY_CODE) {
    return BY_CODE[signal];
  }
  if (typeof score === 'number') {
    return BY_CODE[signalFromScore(score)];
  }
  return BY_CODE.neutral;
}

/** Circle-only. Do not use outside ScoreGauge. */
export function internalCircleLabel(
  signal?: string | null,
  score?: number,
): 'BUY' | 'HOLD' | 'SELL' {
  return getSignalMeta(signal, score).internal;
}

export function toneClass(tone: SignalMeta['tone']): string {
  if (tone === 'bullish') return 'bg-bullish/15 text-bullish';
  if (tone === 'bearish') return 'bg-bearish/15 text-bearish';
  return 'bg-muted text-muted-foreground';
}

export const FACTOR_HELP: Record<string, string> = {
  momentum: 'Price movement and volume strength.',
  fundamentals:
    'Availability and quality of reliable company fundamental data.',
  sentiment: 'Tone of recent company and sector news.',
  technical: 'Moving averages, RSI, and trend structure.',
  growth: 'Evidence of expansion from available headline catalysts.',
};

export function factorDisplayName(key: string): string {
  if (key === 'fundamentals') return 'Fundamentals/Data Quality';
  if (key === 'growth') return 'Growth/Catalysts';
  return key.charAt(0).toUpperCase() + key.slice(1);
}
