/** Shared API error formatting for dashboard panels. */
import axios from 'axios';
import { API_BASE_URL } from './constants';

export function formatApiError(
  err: unknown,
  fallback: string,
  options?: { short?: boolean },
): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      if (options?.short && detail.length > 180) {
        if (/429|rate limit/i.test(detail)) {
          return 'Market data rate limit hit. Wait a bit and try again.';
        }
        if (/403|don't have access/i.test(detail)) {
          return 'Data unavailable from current API plans. Try again shortly.';
        }
        return 'Providers are temporarily unavailable. Try again shortly.';
      }
      return detail;
    }
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) =>
          typeof item === 'object' && item && 'msg' in item
            ? String((item as { msg: unknown }).msg)
            : String(item),
        )
        .filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
    if (!err.response) {
      return `Cannot reach API at ${API_BASE_URL}. Is the backend running?`;
    }
    const status = err.response.status;
    if (status === 429) {
      return 'Rate limit hit. Wait a bit and try again.';
    }
    if (status === 403) {
      return 'Data unavailable from current API plans. Try again shortly.';
    }
    if (status >= 500) {
      return 'Upstream data providers are temporarily unavailable. Try again shortly.';
    }
  }
  return fallback;
}
