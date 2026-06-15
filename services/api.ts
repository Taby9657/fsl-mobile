import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://fsl-api.railway.app/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// Přidej JWT token do každého requestu automaticky
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('fsl_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Pokud token expiroval (401), odhlásíme uživatele
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('fsl_token');
      // useAuthStore.getState().logout() – zavolej pokud použiješ Zustand
    }
    return Promise.reject(err);
  }
);

// ==================== AUTH ====================
export const authApi = {
  google: (idToken: string) => api.post('/auth/google', { idToken }),
  apple:  (identityToken: string, firstName?: string, lastName?: string, email?: string) =>
    api.post('/auth/apple', { identityToken, firstName, lastName, email }),
  me: () => api.get('/auth/me'),
};

// ==================== TÝMY ====================
export const teamsApi = {
  list:       ()         => api.get('/teams'),
  get:        (id: string) => api.get(`/teams/${id}`),
  create:     (data: any) => api.post('/teams', data),
  update:     (id: string, data: any) => api.put(`/teams/${id}`, data),
  uploadLogo: (id: string, uri: string) => {
    const form = new FormData();
    form.append('logo', { uri, name: 'logo.jpg', type: 'image/jpeg' } as any);
    return api.post(`/teams/${id}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  invite:     (id: string) => api.get(`/teams/${id}/invite`),
  join:       (code: string) => api.post(`/teams/join/${code}`),
};

// ==================== HRÁČI ====================
export const playersApi = {
  list:        (params?: any) => api.get('/players', { params }),
  get:         (id: string)   => api.get(`/players/${id}`),
  create:      (data: any)    => api.post('/players', data),
  update:      (id: string, data: any) => api.put(`/players/${id}`, data),
  uploadPhoto: (id: string, uri: string) => {
    const form = new FormData();
    form.append('photo', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
    return api.post(`/players/${id}/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ==================== ZÁPASY ====================
export const matchesApi = {
  list:    (params?: any)  => api.get('/matches', { params }),
  get:     (id: string)    => api.get(`/matches/${id}`),
  events:  (id: string)    => api.get(`/matches/${id}`),
  addEvent:(id: string, data: any) => api.post(`/matches/${id}/events`, data),
  lineup:  (matchId: string, teamId: string, players: any[]) =>
    api.put(`/matches/${matchId}/lineup/${teamId}`, { players }),
  postmatch:(matchId: string, teamId: string, data: any) =>
    api.put(`/matches/${matchId}/postmatch/${teamId}`, data),
  submitPostmatch:(matchId: string, teamId: string) =>
    api.post(`/matches/${matchId}/postmatch/${teamId}/submit`),
};

// ==================== ROZHODČÍ ====================
export const refereesApi = {
  list:         (params?: any) => api.get('/referees', { params }),
  get:          (id: string)   => api.get(`/referees/${id}`),
  register:     (data: any)    => api.post('/referees', data),
  futureMatches:(id: string)   => api.get(`/referees/${id}/future-matches`),
};

// ==================== PLATBY ====================
export const paymentsApi = {
  me:              ()           => api.get('/payments/me'),
  playerLicense:   ()           => api.post('/payments/player-license'),
  superLicense:    ()           => api.post('/payments/super-license'),
  homeFee:         (matchId: string) => api.post('/payments/home-fee', { matchId }),
  qr:              (type: string, id: string) => api.get(`/payments/qr/${type}/${id}`),
};

// ==================== STATISTIKY ====================
export const statsApi = {
  table:    (division?: string) => api.get('/stats/table',    { params: { division } }),
  scorers:  (division?: string) => api.get('/stats/scorers',  { params: { division } }),
  assisters:(division?: string) => api.get('/stats/assisters',{ params: { division } }),
  points:   (division?: string) => api.get('/stats/points',   { params: { division } }),
  mvp:      (division?: string) => api.get('/stats/mvp',      { params: { division } }),
  referees: ()                  => api.get('/stats/referees'),
};

// ==================== NOTIFIKACE ====================
export const notificationsApi = {
  list:    () => api.get('/notifications'),
  readAll: () => api.put('/notifications/read-all'),
  read:    (id: string) => api.put(`/notifications/${id}/read`),
};
