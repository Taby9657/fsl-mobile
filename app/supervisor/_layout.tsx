/**
 * Brána do supervisorských obrazovek.
 *
 * Do 11. 9. 2026 tahle složka žádný `_layout.tsx` neměla a **žádná z dvanácti
 * obrazovek si sama neověřovala, kdo ji otevřel**. Menu je sice ukazovalo jen
 * supervisorovi, jenže expo-router jede na cestách: `router.push('/supervisor/teams')`
 * nebo deep link ji vyrenderoval komukoli. Data z API by cizí člověk nedostal
 * (routy hlídá `requireSupervisor` na serveru), ale obrazovky Správy ligy se
 * mu otevřely — a formuláře na nich vypadají, jako by fungovaly.
 *
 * Web má totéž řešené `AuthGuard require="supervisor"` nad celým `/admin`.
 *
 * Kdo sem přidá další obrazovku, nemusí dělat nic — brána platí pro celou
 * složku. Kdo tenhle soubor smaže, otevře všech dvanáct obrazovek každému.
 */

import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { useAuthStore, useIsSupervisor } from '../../store/auth';
import { Colors, Fonts } from '../../constants/colors';

export default function SupervisorLayout() {
  const loading = useAuthStore(s => s.loading);
  const user = useAuthStore(s => s.user);
  const isSupervisor = useIsSupervisor();

  // Přesměrování patří do efektu, ne do těla komponenty — navigace během
  // renderu skončí varováním a někdy i zacyklením.
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/(auth)/login'); return; }
    if (!isSupervisor) router.replace('/(tabs)');
  }, [loading, user, isSupervisor]);

  if (loading) {
    return (
      <View style={s.stred}>
        <ActivityIndicator color={Colors.go} />
      </View>
    );
  }

  if (!user || !isSupervisor) {
    // Než přesměrování proběhne, nesmí se obsah mihnout na obrazovce.
    return (
      <View style={s.stred}>
        <Text style={s.text}>Tahle část patří supervisorovi ligy.</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: Colors.bg },
      animation: 'slide_from_right',
    }} />
  );
}

const s = StyleSheet.create({
  stred: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg, padding: 24 },
  text:  { color: Colors.mu, fontSize: Fonts.sizes.md, textAlign: 'center' },
});
