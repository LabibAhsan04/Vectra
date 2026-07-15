import { type FormEvent, useEffect, useState } from 'react';
import axios from 'axios';
import type { UserAlertRule } from '@/types/stock.types';
import { API_BASE_URL } from '@/utils/constants';
import { formatApiError } from '@/utils/apiError';
import { useAuthStore } from '@/store/authStore';

interface UserAlertsPanelProps {
  ticker: string;
}

const RULE_TYPES = [
  { value: 'price_above', label: 'Price above' },
  { value: 'price_below', label: 'Price below' },
  { value: 'score_above', label: 'Score above' },
  { value: 'score_below', label: 'Score below' },
] as const;

export default function UserAlertsPanel({ ticker }: UserAlertsPanelProps) {
  const user = useAuthStore((s) => s.user);
  const [rules, setRules] = useState<UserAlertRule[]>([]);
  const [ruleType, setRuleType] = useState<string>('price_above');
  const [threshold, setThreshold] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRules() {
    if (!user) return;
    try {
      const { data } = await axios.get<UserAlertRule[]>(`${API_BASE_URL}/api/user-alerts`, {
        params: { ticker },
      });
      setRules(data);
    } catch (err) {
      setError(formatApiError(err, 'Failed to load alert rules.'));
    }
  }

  useEffect(() => {
    void loadRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const value = Number(threshold);
    if (!Number.isFinite(value)) {
      setError('Enter a valid threshold.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await axios.post(`${API_BASE_URL}/api/user-alerts`, {
        ticker,
        ruleType,
        threshold: value,
      });
      setThreshold('');
      await loadRules();
    } catch (err) {
      setError(formatApiError(err, 'Could not save alert rule.'));
    } finally {
      setLoading(false);
    }
  }

  async function removeRule(id: number) {
    try {
      await axios.delete(`${API_BASE_URL}/api/user-alerts/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(formatApiError(err, 'Could not delete rule.'));
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h3 className="text-lg font-semibold text-foreground">Custom Alerts</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Price or score thresholds for {ticker}
      </p>

      {!user ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to create custom alert rules. System alerts still appear in the Alerts panel.
        </p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground">
              Rule
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value)}
                className="mt-1 block rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                {RULE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Threshold
              <input
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="mt-1 block w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md border border-border bg-primary/10 px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-60"
            >
              Add rule
            </button>
          </form>
          {error ? (
            <p className="mt-2 text-sm text-bearish" role="alert">
              {error}
            </p>
          ) : null}
          <ul className="mt-4 space-y-2">
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span>
                  {rule.ruleType.replace('_', ' ')} {rule.threshold}
                </span>
                <button
                  type="button"
                  onClick={() => void removeRule(rule.id)}
                  className="text-xs text-muted-foreground hover:text-bearish"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
