import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useNetworkStore } from '../store/network';

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

// Mapování HTTP kódů na česká chybová hlášení
const ERROR_MESSAGES: Record<number, string> = {
  400: 'Neplatný požadavek – zkontroluj zadané údaje.',
  401: 'Nejsi přihlášen nebo platnost relace vypršela.',
  403: 'Nemáš oprávnění k této akci.',
  404: 'Požadovaný záznam nebyl nalezen.',
  409: 'Konflikt – záznam již existuje nebo byl změněn.',
  422: 'Zadané údaje nejsou platné.',
  429: 'Příliš mnoho požadavků – počkej chvíli a zkus to znovu.',
  500: 'Chyba serveru – zkus to znovu za okamžik.',
  503: 'Služba je dočasně nedostupná.',
};

// Globální error interceptor
api.interceptors.response.use(
  (res) => {
    // Obnovení připojení
    useNetworkStore.getState().setOffline(false);
    return res;
  },
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync('fsl_token');
    }
    // Přidej přehlednou chybovou zprávu pokud server žádnou neposlal
    if (err.response && !err.response.data?.error) {
      err.response.data = err.response.data ?? {};
      err.response.data.error = ERROR_MESSAGES[err.response.status] ?? 'Neočekávaná chyba.';
    }
    // Timeout / síťová chyba → zobraz offline banner
    if (err.code === 'ECONNABORTED' || !err.response) {
      err.message = 'Nepodařilo se připojit k serveru. Zkontroluj připojení k internetu.';
      useNetworkStore.getState().setOffline(true);
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
  leaveTeam:   (id: string)   => api.post(`/players/${id}/leave-team`),
  removeFromTeam: (playerId: string, teamId: string) => api.delete(`/players/${playerId}/team/${teamId}`),
  myStats:     (season?: string) => api.get('/players/my/stats', { params: { season } }),
  uploadPhoto: (id: string, uri: string) => {
    const form = new FormData();
    form.append('photo', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
    return api.post(`/players/${id}/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ==================== ZÁPASY ====================
export const matchesApi = {
  list:            (params?: any)  => api.get('/matches', { params }),
  get:             (id: string)    => api.get(`/matches/${id}`),
  create:          (data: any)     => api.post('/matches', data),
  update:          (id: string, data: any) => api.put(`/matches/${id}`, data),
  addEvent:        (id: string, data: any) => api.post(`/matches/${id}/events`, data),
  deleteEvent:     (id: string, eventId: string) => api.delete(`/matches/${id}/events/${eventId}`),
  startMatch:      (id: string)    => api.post(`/matches/${id}/start`),
  endMatch:        (id: string)    => api.post(`/matches/${id}/end`),
  lineup:          (matchId: string, teamId: string, players: any[], force = false) =>
    api.put(`/matches/${matchId}/lineup/${teamId}`, { players, force }),
  postmatch:       (matchId: string, teamId: string, data: any) =>
    api.put(`/matches/${matchId}/postmatch/${teamId}`, data),
  submitPostmatch: (matchId: string, teamId: string) =>
    api.post(`/matches/${matchId}/postmatch/${teamId}/submit`),
};

// ==================== ROZHODČÍ ====================
export const refereesApi = {
  list:         (params?: any) => api.get('/referees', { params }),
  get:          (id: string)   => api.get(`/referees/${id}`),
  register:     (data: any)    => api.post('/referees', data),
  update:       (id: string, data: any) => api.put(`/referees/${id}`, data),
  futureMatches:(id: string)   => api.get(`/referees/${id}/future-matches`),
  uploadPhoto:  (id: string, uri: string) => {
    const form = new FormData();
    form.append('photo', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);
    return api.post(`/referees/${id}/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
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
  seasons:  ()                                  => api.get('/stats/seasons'),
  table:    (division?: string, season?: string) => api.get('/stats/table',    { params: { division, season } }),
  scorers:  (division?: string, season?: string) => api.get('/stats/scorers',  { params: { division, season } }),
  assisters:(division?: string, season?: string) => api.get('/stats/assisters',{ params: { division, season } }),
  points:   (division?: string, season?: string) => api.get('/stats/points',   { params: { division, season } }),
  mvp:      (division?: string, season?: string) => api.get('/stats/mvp',      { params: { division, season } }),
  referees: (season?: string)                    => api.get('/stats/referees', { params: { season } }),
};

// ==================== PUSH TOKEN ====================
export const pushApi = {
  saveToken: (token: string) => api.put('/auth/push-token', { token }),
};

// ==================== NOTIFIKACE ====================
export const notificationsApi = {
  list:    () => api.get('/notifications'),
  readAll: () => api.put('/notifications/read-all'),
  read:    (id: string) => api.put(`/notifications/${id}/read`),
};

// ==================== HIGHLIGHTS ====================
export const highlightsApi = {
  list:        ()                          => api.get('/highlights'),
  create:      (data: any)                 => api.post('/highlights', data),
  update:      (id: string, data: any)     => api.put(`/highlights/${id}`, data),
  delete:      (id: string)                => api.delete(`/highlights/${id}`),
  uploadVideo: (id: string, uri: string)   => {
    const form = new FormData();
    form.append('video', { uri, name: 'video.mp4', type: 'video/mp4' } as any);
    return api.post(`/highlights/${id}/video`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180_000, // 3 minuty pro video upload
    });
  },
};

// ==================== DRAFT ====================
export const draftApi = {
  list:          ()                                  => api.get('/draft'),
  me:            ()                                  => api.get('/draft/me'),
  getProfile:    (playerId: string)                  => api.get(`/draft/${playerId}`),
  createProfile: (data: any)                         => api.post('/draft/profile', data),
  updateProfile: (data: any)                         => api.put('/draft/profile', data),
  deleteProfile: ()                                  => api.delete('/draft/profile'),
  uploadVideo:   (uri: string) => {
    const form = new FormData();
    form.append('video', { uri, name: 'draft.mp4', type: 'video/mp4' } as any);
    return api.post('/draft/profile/video', form, {
      headers:  { 'Content-Type': 'multipart/form-data' },
      timeout:  180_000,
    });
  },
  deleteVideo:   (videoId: string)                   => api.delete(`/draft/video/${videoId}`),
  makeOffer:     (playerId: string, data: any)        => api.post(`/draft/${playerId}/offer`, data),
  acceptOffer:   (playerId: string, offerId: string)  => api.post(`/draft/${playerId}/offer/${offerId}/accept`),
  rejectOffer:   (playerId: string, offerId: string)  => api.post(`/draft/${playerId}/offer/${offerId}/reject`),
};

// ==================== SUPERVISOR ====================
export const supervisorApi = {
  dashboard:      ()                             => api.get('/supervisor/dashboard'),
  referees:       (status = 'PENDING')           => api.get('/supervisor/referees', { params: { status } }),
  approveRef:     (id: string, level: string)    => api.put(`/referees/${id}/approve`, { level }),
  rejectRef:      (id: string, reason?: string)  => api.put(`/referees/${id}/reject`, { reason }),
  matches:        (params?: any)                 => api.get('/supervisor/matches', { params }),
  assignReferee:  (matchId: string, refereeId: string) => api.post(`/supervisor/matches/${matchId}/assign-referee`, { refereeId }),
  deleteMatch:    (matchId: string)              => api.delete(`/supervisor/matches/${matchId}`),
  payments:           (params?: any)                 => api.get('/supervisor/payments', { params }),
  updatePayment:      (playerId: string, data: any)  => api.put(`/payments/player/${playerId}`, data),
  updateTeamPayment:  (teamId: string, data: any)    => api.put(`/payments/team/${teamId}`, data),
  bankSync:       (days = 30)                    => api.post('/payments/bank-sync', { days }),

  // Správa týmů
  teams:          (params?: any)                 => api.get('/supervisor/teams', { params }),
  createTeam:     (data: any)                    => api.post('/supervisor/teams', data),
  updateTeam:     (id: string, data: any)        => api.put(`/supervisor/teams/${id}`, data),
  deleteTeam:     (id: string)                   => api.delete(`/supervisor/teams/${id}`),
  divisions:      ()                             => api.get('/supervisor/divisions'),
  conferences:    ()                             => api.get('/supervisor/conferences'),

  // Rozlosování
  previewFixtures: (data: any)                   => api.post('/supervisor/fixtures/preview', data),
  generateFixtures:(data: any)                   => api.post('/supervisor/fixtures/generate', data),
};
