// Přistání z pozvánkového odkazu – https://fslleague.cz/pozvanka/KÓD nebo fsl://pozvanka/KÓD
import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/auth';
import { parseInviteCode, savePendingInvite } from '../../utils/invite';
import { Colors, Fonts } from '../../constants/colors';

export default function PozvankaScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    if (loading) return;

    const kod = parseInviteCode(code);

    (async () => {
      if (kod) await savePendingInvite(kod);

      // Nepřihlášený se nejdřív přihlásí; kód si počká v úložišti
      if (!user) { router.replace('/(auth)/login'); return; }

      // Hráč, který tým má, pozvánku použít nemůže — dřív ho appka jen tiše
      // odklidila na taby a nikdo se nedozvěděl proč
      if (user.player?.teamId) {
        Alert.alert(
          'Jsi v týmu',
          `Pozvánku můžeš použít, až opustíš tým ${user.player?.team?.name ?? ''}. Uděláš to v úpravě profilu.`,
        );
        router.replace('/(tabs)');
        return;
      }

      // Hráč bez týmu se připojí kódem, nezakládá nový profil
      if (user.player) {
        router.replace(
          kod
            ? { pathname: '/pripojit-tym', params: { code: kod } }
            : { pathname: '/pripojit-tym' },
        );
        return;
      }

      router.replace(
        kod
          ? { pathname: '/onboarding/player-code', params: { code: kod } }
          : { pathname: '/onboarding/player-code' },
      );
    })();
  }, [code, user, loading]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <ActivityIndicator color={Colors.go} size="large" />
        <Text style={s.txt}>Otevírám pozvánku…</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  txt:    { fontSize: Fonts.sizes.sm, color: Colors.mu },
});
