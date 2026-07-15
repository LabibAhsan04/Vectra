import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'vectra-theme';

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

interface ThemeState {
  theme: ThemeMode;
  hydrated: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  hydrate: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'dark',
  hydrated: false,

  hydrate: () => {
    const theme = readStoredTheme();
    applyTheme(theme);
    set({ theme, hydrated: true });
  },

  setTheme: (mode) => {
    applyTheme(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    set({ theme: mode });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },
}));

export function initTheme() {
  const theme = readStoredTheme();
  applyTheme(theme);
}
