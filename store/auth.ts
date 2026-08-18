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

export type ActiveRole = 'all' | 'player' | 'manager' | 'referee' | 'supervisor';

interface AuthState {
  user: User | null;
  token: string | null;
  isGuest: boolean;
  loading: boolean;
  activeRole: ActiveRole;
  setAuth: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  loginAsGuest: () => void;
  loginAsTester: () => void;
  loadFromStorage: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setActiveRole: (role: ActiveRole) => void;
}

// SEC-01: TESTER_USER je dostupný pouze v development buildu
const TESTER_USER: User | null = __DEV__ ? {
  id: 'tester-001',
  email: 'tester@fsl.cz',
  player: {
    id: 'tester-player',
    firstName: 'FSL',
    lastName: 'Tester',
    isSupervisor: true,
    teamId: 'tester-team',
    number: 99,
    position: 'F',
  },
  referee: {
    id: 'tester-referee',
    firstName: 'FSL',
    lastName: 'Tester',
    level: 2,
  },
  manager: [
    {
      teamId: 'tester-team',
      team: { id: 'tester-team', name: 'Testovací tým', abbr: 'TST', color: '#00C851' },
    },
  ],
} : null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user:       null,
  token:      null,
  isGuest:    false,
  loading:    true,
  activeRole: 'all',

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync('fsl_token', token);
    set({ token, user, isGuest: false, loading: false });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('fsl_token');
    set({ token: null, user: null, isGuest: false, loading: false });
  },

  loginAsGuest: () => {
    set({ token: null, user: null, isGuest: true, loading: false });
  },

  loginAsTester: () => {
    if (!__DEV__ || !TESTER_USER) return; // SEC-01: blokováno v produkci
    set({ token: 'TESTER_TOKEN', user: TESTER_USER, isGuest: false, loading: false });
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('fsl_token');
      if (!token) { set({ loading: false }); return; }
      // Tester token – nevytahuj z API (pouze __DEV__)
      if (token === 'TESTER_TOKEN') {
        if (__DEV__ && TESTER_USER) {
          set({ token, user: TESTER_USER, loading: false });
        } else {
          // Produkce: tester token není platný → odhlásit
          await SecureStore.deleteItemAsync('fsl_token');
          set({ token: null, user: null, loading: false });
        }
        return;
      }
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
      if (get().token === 'TESTER_TOKEN') return;
      const res = await authApi.me();
      set({ user: res.data.user });
    } catch {}
  },

  setActiveRole: (role) => set({ activeRole: role }),
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
