import { create } from 'zustand';
import axios from 'axios';
import { API_BASE_URL, setAuthToken } from '@/utils/api';

export interface AuthUser {
  id: number;
  email: string;
  name?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await axios.post<{ token: string; user: AuthUser }>(
        `${API_BASE_URL}/api/auth/login`,
        { email, password },
      );
      setAuthToken(data.token);
      set({ user: data.user, loading: false });
    } catch {
      set({ loading: false, error: 'Invalid email or password.' });
      throw new Error('login failed');
    }
  },

  register: async (email, password, name = '') => {
    set({ loading: true, error: null });
    try {
      const { data } = await axios.post<{ token: string; user: AuthUser }>(
        `${API_BASE_URL}/api/auth/register`,
        { email, password, name },
      );
      setAuthToken(data.token);
      set({ user: data.user, loading: false });
    } catch {
      set({ loading: false, error: 'Could not create account. Email may already exist.' });
      throw new Error('register failed');
    }
  },

  logout: () => {
    setAuthToken(null);
    set({ user: null, error: null });
  },

  hydrate: async () => {
    const token = localStorage.getItem('vectra-auth-token');
    if (!token) return;
    try {
      const { data } = await axios.get<AuthUser>(`${API_BASE_URL}/api/auth/me`);
      set({ user: data });
    } catch {
      setAuthToken(null);
      set({ user: null });
    }
  },
}));
