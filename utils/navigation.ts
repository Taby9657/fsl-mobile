import { router } from 'expo-router';

/**
 * Bezpečné zpětné navigování.
 * Pokud nelze jít zpět (app otevřena přes push notifikaci nebo deep link),
 * přesměruje na fallback (výchozí: hlavní tabs).
 */
export function goBack(fallback: string = '/(tabs)') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback as any);
  }
}
