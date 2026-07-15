import { useEffect, useRef, useState } from 'react';
import type { StockQuote } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';

interface LiveQuotePatch {
  price: number;
  change: number;
  changePct: number;
  timestamp: string;
}

/** WebSocket-backed live quote updates (server pushes every ~15s). */
export function useLiveQuote(
  ticker: string,
  base: StockQuote | null,
  onUpdate?: (patch: LiveQuotePatch) => void,
) {
  const [live, setLive] = useState<LiveQuotePatch | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!ticker) {
      setLive(null);
      return;
    }
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const socket = new WebSocket(`${wsBase}/api/ws/quotes/${encodeURIComponent(ticker)}`);
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as LiveQuotePatch & { error?: string };
        if (data.error) return;
        setLive(data);
        onUpdateRef.current?.(data);
      } catch {
        /* ignore malformed frames */
      }
    };
    return () => socket.close();
  }, [ticker]);

  if (!base) return { quote: null as StockQuote | null, live };
  if (!live) return { quote: base, live: null };
  return {
    quote: { ...base, ...live },
    live,
  };
}
