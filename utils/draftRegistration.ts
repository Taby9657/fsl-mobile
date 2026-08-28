import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Rozdělaná registrace.
 *
 * Kdo si vybere roli a odejde uprostřed formuláře, dostane při dalším spuštění
 * zase jen výběr role — a neví, že už něco rozdělaného má. Ukládáme si proto,
 * kam došel, a nabídneme mu pokračování.
 *
 * Držíme jen to, co pomůže navázat (role, tým, kód). Vyplněné osobní údaje
 * schválně neukládáme — nemají proč ležet v úložišti telefonu.
 */

const KEY = 'fsl_draft_registration';

export type DraftRole = 'player' | 'manager' | 'referee';

export interface DraftRegistration {
  role:       DraftRole;
  /** Ověřený tým u hráče — ať víme, kam navázat. */
  teamId?:    string;
  teamName?:  string;
  inviteCode?: string;
  updatedAt:  number;
}

export const DRAFT_LABELS: Record<DraftRole, string> = {
  player:  'hráče',
  manager: 'vedoucího týmu',
  referee: 'rozhodčího',
};

export async function saveDraft(draft: Omit<DraftRegistration, 'updatedAt'>) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...draft, updatedAt: Date.now() }));
  } catch {}
}

export async function readDraft(): Promise<DraftRegistration | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as DraftRegistration;
    return d?.role ? d : null;
  } catch {
    return null;
  }
}

export async function clearDraft() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}

/** Kam uživatele vrátit, aby mohl navázat. */
export function draftRoute(d: DraftRegistration) {
  if (d.role === 'manager')  return { pathname: '/onboarding/manager' as const };
  if (d.role === 'referee')  return { pathname: '/onboarding/referee' as const };
  if (d.teamId) {
    return {
      pathname: '/onboarding/player-info' as const,
      params: { teamId: d.teamId, teamName: d.teamName ?? '', inviteCode: d.inviteCode ?? '' },
    };
  }
  return {
    pathname: '/onboarding/player-code' as const,
    params: d.inviteCode ? { code: d.inviteCode } : {},
  };
}

/** „před 3 hodinami" apod. — stačí hrubě. */
export function draftAge(updatedAt: number) {
  const min = Math.max(1, Math.round((Date.now() - updatedAt) / 60000));
  if (min < 60)   return `před ${min} min`;
  const hod = Math.round(min / 60);
  if (hod < 24)   return `před ${hod} h`;
  const dnu = Math.round(hod / 24);
  return dnu === 1 ? 'včera' : `před ${dnu} dny`;
}
