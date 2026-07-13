/** Display helpers for research signals (not trade commands). */
import type { ResearchSignal } from '@/types/stock.types';

export interface SignalMeta {
  code: ResearchSignal;
  label: string;
  short: string;
  tone: 'bullish' | 'neutral' | 'bearish';
}

const BY_CODE: Record<ResearchSignal, SignalMeta> = {
  strong_buy: {
    code: 'strong_buy',
    label: 'Strong Bullish (STRONG BUY)',
    short: 'Strong Bullish',
    tone: 'bullish',
  },
  buy: {
    code: 'buy',
    label: 'Bullish Signal (BUY)',
    short: 'Bullish',
    tone: 'bullish',
  },
  hold: {
    code: 'hold',
    label: 'Neutral Signal',
    short: 'Neutral',
    tone: 'neutral',
  },
  sell: {
    code: 'sell',
    label: 'Bearish Signal (SELL)',
    short: 'Bearish',
    tone: 'bearish',
  },
  strong_sell: {
    code: 'strong_sell',
    label: 'Strong Bearish (STRONG SELL)',
    short: 'Strong Bearish',
    tone: 'bearish',
  },
};

export function signalFromScore(score: number): ResearchSignal {
  if (score >= 80) return 'strong_buy';
  if (score >= 65) return 'buy';
  if (score <= 20) return 'strong_sell';
  if (score <= 40) return 'sell';
  return 'hold';
}

export function getSignalMeta(
  signal?: string | null,
  score?: number,
): SignalMeta {
  if (signal && signal in BY_CODE) {
    return BY_CODE[signal as ResearchSignal];
  }
  if (typeof score === 'number') {
    return BY_CODE[signalFromScore(score)];
  }
  return BY_CODE.hold;
}

export function toneClass(tone: SignalMeta['tone']): string {
  if (tone === 'bullish') return 'bg-bullish/15 text-bullish';
  if (tone === 'bearish') return 'bg-bearish/15 text-bearish';
  return 'bg-muted text-muted-foreground';
}

export const FACTOR_HELP: Record<string, string> = {
  momentum: 'Price movement and volume strength.',
  fundamentals:
    'Revenue, earnings, margins, or availability of reliable company data.',
  sentiment: 'Tone of recent company and sector news.',
  technical: 'Moving averages, RSI, and trend structure.',
  growth: 'Evidence of expansion from available data and catalysts.',
};

export function factorDisplayName(key: string): string {
  if (key === 'fundamentals') return 'Fundamentals/Data Quality';
  return key.charAt(0).toUpperCase() + key.slice(1);
}
