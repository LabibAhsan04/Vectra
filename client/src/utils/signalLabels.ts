/** Display helpers for research signals (not trade commands). */
import type { ResearchSignal } from '@/types/stock.types';

export interface SignalMeta {
  code: ResearchSignal;
  label: string;
  short: string;
  tone: 'bullish' | 'neutral' | 'bearish';
}

const BY_CODE: Record<string, SignalMeta> = {
  strong_bullish: {
    code: 'strong_bullish',
    label: 'Strong Bullish',
    short: 'Strong Bullish',
    tone: 'bullish',
  },
  bullish: {
    code: 'bullish',
    label: 'Bullish Signal',
    short: 'Bullish',
    tone: 'bullish',
  },
  neutral: {
    code: 'neutral',
    label: 'Neutral Signal',
    short: 'Neutral',
    tone: 'neutral',
  },
  bearish: {
    code: 'bearish',
    label: 'Bearish Signal',
    short: 'Bearish',
    tone: 'bearish',
  },
  strong_bearish: {
    code: 'strong_bearish',
    label: 'Strong Bearish',
    short: 'Strong Bearish',
    tone: 'bearish',
  },
  // Legacy codes from earlier API versions
  strong_buy: {
    code: 'strong_bullish',
    label: 'Strong Bullish',
    short: 'Strong Bullish',
    tone: 'bullish',
  },
  buy: {
    code: 'bullish',
    label: 'Bullish Signal',
    short: 'Bullish',
    tone: 'bullish',
  },
  hold: {
    code: 'neutral',
    label: 'Neutral Signal',
    short: 'Neutral',
    tone: 'neutral',
  },
  sell: {
    code: 'bearish',
    label: 'Bearish Signal',
    short: 'Bearish',
    tone: 'bearish',
  },
  strong_sell: {
    code: 'strong_bearish',
    label: 'Strong Bearish',
    short: 'Strong Bearish',
    tone: 'bearish',
  },
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

export const SCORE_WEIGHTS: Record<string, number> = {
  momentum: 0.25,
  technical: 0.25,
  sentiment: 0.2,
  fundamentals: 0.15,
  growth: 0.15,
};

export function factorDisplayName(key: string): string {
  if (key === 'fundamentals') return 'Fundamentals/Data Quality';
  return key.charAt(0).toUpperCase() + key.slice(1);
}
