import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Pozvánka do týmu.
 *
 * Vedoucí sdílí odkaz `https://fslleague.cz/pozvanka/FSL-BE-7K2P`. Když má
 * příjemce aplikaci, otevře se rovnou na registraci s předvyplněným kódem.
 * Když ji nemá, stáhne si ji a kód si po instalaci vloží — proto si ho
 * ukládáme stranou a nabízíme ho, jakmile se dostane na obrazovku s kódem.
 */

const PENDING_KEY = 'fsl_pending_invite';

/** Základ odkazu, který vedoucí rozesílá. */
export const INVITE_BASE = 'https://fslleague.cz/pozvanka';

export function inviteUrl(code: string) {
  return `${INVITE_BASE}/${encodeURIComponent(code.trim().toUpperCase())}`;
}

/**
 * Vytáhne kód z čehokoli, co může přijít — z holého kódu, z odkazu
 * na web i z hlubokého odkazu `fsl://pozvanka/KÓD`.
 */
export function parseInviteCode(raw?: string | null): string | null {
  if (!raw) return null;
  const text = raw.trim();

  // Odkaz (web i vlastní schéma) — bereme poslední segment cesty
  const m = /(?:https?:\/\/[^\s]*|fsl:\/\/)\/?pozvanka\/([^/?#\s]+)/i.exec(text);
  const kandidat = m ? decodeURIComponent(m[1]) : text;

  const code = kandidat.trim().toUpperCase();
  // Kód je FSL-ZKRATKA-XXXX; držíme se volnějšího tvaru, backend ověří zbytek
  return /^[A-Z0-9-]{6,20}$/.test(code) ? code : null;
}

export async function savePendingInvite(code: string) {
  try { await AsyncStorage.setItem(PENDING_KEY, code); } catch {}
}

export async function readPendingInvite(): Promise<string | null> {
  try { return await AsyncStorage.getItem(PENDING_KEY); } catch { return null; }
}

export async function clearPendingInvite() {
  try { await AsyncStorage.removeItem(PENDING_KEY); } catch {}
}
