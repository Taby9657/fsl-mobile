import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../services/api';

interface User {
  id: string;
  email: string;
  player?: any;
  referee?: any;
  manager?: any[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:    null,
  token:   null,
  loading: true,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('fsl_token', token);
    set({ token, user, loading: false });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('fsl_token');
    set({ token: null, user: null, loading: false });
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('fsl_token');
      if (!token) { set({ loading: false }); return; }
      set({ token });
      const res = await authApi.me();
      set({ user: res.data.user, loading: false });
    } catch {
      await SecureStore.deleteItemAsync('fsl_token');
      set({ token: null, user: null, loading: false });
    }
  },

  refreshUser: async () => {
    try {
      const res = await authApi.me();
      set({ user: res.data.user });
    } catch {}
  },
}));

// Pomocné selektory
export const useIsManager = () =>
  useAuthStore(s => (s.user?.manager?.length ?? 0) > 0);

export const useIsReferee = () =>
  useAuthStore(s => !!s.user?.referee);

export const useIsSupervisor = () =>
  useAuthStore(s => s.user?.player?.isSupervisor === true);

export const useMyTeamId = () =>
  useAuthStore(s => s.user?.manager?.[0]?.teamId ?? s.user?.player?.teamId ?? null);
