import { FormEvent, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

interface AuthPanelProps {
  onClose?: () => void;
}

export default function AuthPanel({ onClose }: AuthPanelProps) {
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const authError = useAuthStore((s) => s.error);
  const loading = useAuthStore((s) => s.loading);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name);
      onClose?.();
    } catch {
      /* store sets error */
    }
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-muted-foreground/40"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:border-muted-foreground/40">
        Sign in
      </summary>
      <form
        onSubmit={onSubmit}
        className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-lg"
      >
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`text-xs font-medium ${mode === 'login' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`text-xs font-medium ${mode === 'register' ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            Register
          </button>
        </div>
        {mode === 'register' ? (
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        ) : null}
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
        {authError ? (
          <p className="mb-2 text-xs text-bearish" role="alert">
            {authError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary/15 px-3 py-1.5 text-sm font-medium text-foreground disabled:opacity-60"
        >
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </details>
  );
}
