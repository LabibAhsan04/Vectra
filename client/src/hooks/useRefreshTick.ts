import { useEffect, useState } from 'react';
import type { DependencyList } from 'react';
import { FREE_PLAN_REFRESH_MS } from '@/utils/constants';

/**
 * Increments every `intervalMs` while mounted. Resets when `deps` change so
 * consumers re-fetch immediately on ticker/watchlist changes, then on interval.
 */
export function useRefreshTick(
  deps: DependencyList,
  intervalMs: number = FREE_PLAN_REFRESH_MS,
): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setTick(0);
    const id = window.setInterval(() => {
      setTick((value) => value + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls reset keys
  }, [intervalMs, ...deps]);

  return tick;
}
