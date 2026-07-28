import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'fsl_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minut

interface CacheEntry<T> {
  data: T;
  ts: number;
  ttl: number;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > entry.ttl) return null; // expirováno
    return entry.data;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, data: T, ttl = DEFAULT_TTL): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now(), ttl };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {}
}

export async function cacheClear(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {}
}

export async function cacheClearAll(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const fslKeys = keys.filter(k => k.startsWith(PREFIX));
    await AsyncStorage.multiRemove(fslKeys);
  } catch {}
}

/** Kolik klíčů je uloženo */
export async function cacheSize(): Promise<number> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(k => k.startsWith(PREFIX)).length;
  } catch {
    return 0;
  }
}
