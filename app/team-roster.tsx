import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { teamsApi, playersApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';
import { SearchBar } from '../components/SearchBar';

const POS: Record<string, string> = { GK: 'Brankář', F: 'Útočník', D: 'Obránce' };
const LIC_COL: Record<string, string> = {
  PAID: Colors.green, PENDING: '#F59E0B', OVERDUE: Colors.red, WAIVED: Colors.mu,
};

export default function TeamRosterScreen() {
  const { user }  = useAuthStore();
  const teamId    = user?.manager?.[0]?.teamId;
  const [loading, setLoading] = useState(true);
  const [team, setTeam]       = useState<any>(null);
  const [query, setQuery]     = useState('');

  async function removePlayer(player: any) {
    Alert.alert(
      'Odebrat hráče',
      `Odebrat ${player.firstName} ${player.lastName} z týmu?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Odebrat', style: 'destructive',
          onPress: async () => {
            try {
              await playersApi.removeFromTeam(player.id, teamId!);
              setTeam((t: any) => t ? { ...t, players: t.players.filter((p: any) => p.id !== player.id) } : t);
            } catch (err: any) {
              Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se odebrat hráče');
            }
          },
        },
      ],
    );
  }

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    teamsApi.get(teamId)
      .then(r => setTeam(r.data))
      .catch(() => Alert.alert('Chyba', 'Nepodařilo se načíst soupisku'))
      .finally(() => setLoading(false));
  }, [teamId]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Soupiska</Text>
        <Pressable onPress={() => router.push('/invite-code' as any)} style={s.invBtn}>
          <Ionicons name="qr-code-outline" size={18} color={Colors.go} />
          <Text style={s.invTxt}>Pozvat</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
      ) : !teamId ? (
        <View style={s.center}><Text style={s.empty}>Nemáš přiřazený tým.</Text></View>
      ) : (
        <>
          <View style={[s.teamCard, { borderLeftColor: team?.color ?? Colors.go }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.teamName}>{team?.name}</Text>
              <Text style={s.teamSub}>{team?.division} · {team?.players?.length ?? 0} hráčů</Text>
            </View>
            <View style={[s.badge, { backgroundColor: team?.color ?? Colors.go }]}>
              <Text style={s.badgeTxt}>{team?.abbr}</Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Hledat hráče..." />
          </View>
          <FlatList
            data={(team?.players ?? []).filter((p: any) =>
              `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
              String(p.jersey ?? '').includes(query)
            )}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 16, paddingTop: 8 }}
            ListEmptyComponent={
              <View style={s.center}>
                <Ionicons name="people-outline" size={48} color={Colors.mu} />
                <Text style={s.empty}>Žádní hráči. Pozvi je pozvánkovým kódem.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Pressable style={s.row} onPress={() => router.push(`/player/${item.id}` as any)}>
                <View style={s.jersey}>
                  <Text style={s.jerseyNum}>{item.jersey ?? '–'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.firstName} {item.lastName}</Text>
                  <Text style={s.pos}>{POS[item.position] ?? item.position}</Text>
                </View>
                <View style={[s.dot, { backgroundColor: LIC_COL[item.payment?.licStatus ?? 'PENDING'] }]} />
                <Pressable
                  style={s.removeBtn}
                  onPress={() => removePlayer(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="person-remove-outline" size={16} color={Colors.red} />
                </Pressable>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.bg },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:     { width: 40, height: 40, justifyContent: 'center' },
  title:    { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  invBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  invTxt:   { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '600' },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  empty:    { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' },
  teamCard: { margin: 16, marginBottom: 0, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, borderLeftWidth: 4, padding: 14, flexDirection: 'row', alignItems: 'center' },
  teamName: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  teamSub:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  badge:    { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  badgeTxt: { fontSize: Fonts.sizes.sm, fontWeight: '900', color: Colors.bg },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.bd },
  jersey:   { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.c2, justifyContent: 'center', alignItems: 'center' },
  jerseyNum:{ fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.go },
  name:     { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  pos:      { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  removeBtn: { padding: 4 },
});
