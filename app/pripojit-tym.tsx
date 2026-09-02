/**
 * Připojení hráče, který tým nemá, pozvánkovým kódem.
 *
 * Kdo jednou tým opustil, měl dřív jedinou cestu zpátky draft: nový profil mu
 * brání unikátní `userId`, `PUT /players/:id` kmenový tým nemění a `join/:code`
 * kód jen ověřuje. Backend proto nově umí `POST /players/join` a tahle
 * obrazovka ho obsluhuje.
 */
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { playersApi, teamsApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { parseInviteCode, clearPendingInvite } from '../utils/invite';
import { Colors, Fonts, Radius } from '../constants/colors';

export default function PripojitTymScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const { user, refreshUser } = useAuthStore();
  const [code, setCode] = useState(parseInviteCode(params.code) ?? '');
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const kod = parseInviteCode(params.code);
    if (kod) overKod(kod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.code]);

  async function overKod(rawKod?: string) {
    const kod = parseInviteCode(rawKod ?? code);
    if (!kod) { Alert.alert('Zadej platný kód', 'Kód má formát FSL-TM-XXXX'); return; }
    setCode(kod);
    setLoading(true);
    try {
      const res = await teamsApi.join(kod);
      setTeam(res.data.team);
    } catch (err: any) {
      // Vypršelý kód není totéž co neplatný — backend to rozlišuje kódem chyby
      const kodChyby = err?.response?.data?.code;
      Alert.alert(
        kodChyby === 'CODE_EXPIRED' ? 'Kód vypršel' : 'Kód nesedí',
        err?.response?.data?.error ?? 'Zkus to znovu',
      );
    } finally {
      setLoading(false);
    }
  }

  async function pripoj() {
    setLoading(true);
    try {
      const res = await playersApi.join(code);
      await clearPendingInvite();
      await refreshUser();
      Alert.alert('Jsi v týmu', `Vítej v týmu ${res.data.team?.name ?? ''}.`);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Nepovedlo se', err?.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back}>
            <Ionicons name="chevron-back" size={24} color={Colors.wh} />
          </Pressable>
          <Text style={s.title}>Připojit se k týmu</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.body}>
          {team ? (
            <>
              <View style={s.teamCard}>
                <View style={[s.badge, { backgroundColor: team.color ?? Colors.go }]}>
                  <Text style={s.badgeTxt}>{team.abbr}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.teamName}>{team.name}</Text>
                  <Text style={s.teamSub}>{team.division ?? 'Divizi přidělí supervisor'}</Text>
                </View>
              </View>

              {team.regStatus === 'PENDING' || team.regStatus === 'APPEALING' ? (
                <Text style={s.note}>
                  Tým ještě čeká na schválení supervisorem. Na soupisku se zapsat můžeš,
                  zápasy se rozlosují až po schválení.
                </Text>
              ) : null}

              <Text style={s.note}>
                Hráčský profil ti zůstane i se statistikami — mění se jen tým
                {user?.player?.jersey != null ? ` (dres #${user.player.jersey})` : ''}.
              </Text>

              <Pressable style={s.primaryBtn} onPress={pripoj} disabled={loading}>
                {loading
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={s.primaryTxt}>Připojit se k týmu {team.name}</Text>}
              </Pressable>
              <Pressable style={s.ghostBtn} onPress={() => setTeam(null)} disabled={loading}>
                <Text style={s.ghostTxt}>Zadat jiný kód</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.perex}>Zadej pozvánkový kód, který ti poslal vedoucí týmu.</Text>
              <TextInput
                style={s.input}
                value={code}
                onChangeText={t => setCode(t.toUpperCase())}
                placeholder="FSL-TM-XXXX"
                placeholderTextColor={Colors.di}
                autoCapitalize="characters"
                keyboardAppearance="dark"
              />
              <Pressable style={s.primaryBtn} onPress={() => overKod()} disabled={loading || !code.trim()}>
                {loading
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={s.primaryTxt}>Ověřit kód</Text>}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.bg },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:     { width: 40, height: 40, justifyContent: 'center' },
  title:    { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  body:     { padding: 16, gap: 14 },
  perex:    { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 20 },
  input:    { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 16, fontSize: Fonts.sizes.lg, color: Colors.wh, textAlign: 'center', letterSpacing: 3, fontWeight: '700' },
  teamCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14 },
  badge:    { width: 48, height: 48, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  badgeTxt: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.bg },
  teamName: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  teamSub:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  note:     { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18 },
  primaryBtn: { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  primaryTxt: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  ghostBtn: { padding: 12, alignItems: 'center' },
  ghostTxt: { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
});
