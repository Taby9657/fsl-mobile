import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert, Modal, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { teamsApi, playersApi, searchApi } from '../services/api';
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
  const [roster, setRoster]   = useState<any[]>([]);
  const [chybejici, setChybejici] = useState<any[]>([]);
  const [doplnuje, setDoplnuje]   = useState(false);
  const [query, setQuery]     = useState('');

  // Přidání hostujícího hráče
  const [hostModal, setHostModal] = useState(false);
  const [hostQuery, setHostQuery] = useState('');
  const [hostVysledky, setHostVysledky] = useState<any[]>([]);
  const [hostHleda, setHostHleda] = useState(false);
  const [hostPridava, setHostPridava] = useState<string | null>(null);

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
              await nactiSoupisku();
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
    Promise.all([teamsApi.get(teamId), teamsApi.roster(teamId)])
      .then(([tRes, rRes]) => {
        setTeam(tRes.data);
        setRoster(rRes.data.players ?? []);
        setChybejici(rRes.data.missingHome ?? []);
      })
      .catch(() => Alert.alert('Chyba', 'Nepodařilo se načíst soupisku'))
      .finally(() => setLoading(false));
  }, [teamId]);

  async function nactiSoupisku() {
    if (!teamId) return;
    try {
      const r = await teamsApi.roster(teamId);
      setRoster(r.data.players ?? []);
      setChybejici(r.data.missingHome ?? []);
    } catch { /* ticho — uživatel může zkusit znovu */ }
  }

  async function doplnKmenove() {
    if (!teamId) return;
    setDoplnuje(true);
    try {
      const r = await teamsApi.addHomePlayers(teamId);
      await nactiSoupisku();
      Alert.alert('Hotovo', `Na soupisku přibylo ${r.data.added} hráčů.`);
    } catch (err: any) {
      Alert.alert('Nepodařilo se doplnit', err?.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setDoplnuje(false);
    }
  }

  async function hledejHrace(q: string) {
    setHostQuery(q);
    if (q.trim().length < 2) { setHostVysledky([]); return; }
    setHostHleda(true);
    try {
      const r = await searchApi.search(q);
      const naSoupisce = new Set(roster.map((p: any) => p.id));
      setHostVysledky((r.data.players ?? []).filter((p: any) => !naSoupisce.has(p.id)));
    } catch {
      setHostVysledky([]);
    } finally {
      setHostHleda(false);
    }
  }

  async function pridejHosta(player: any) {
    if (!teamId) return;
    setHostPridava(player.id);
    try {
      await teamsApi.addToRoster(teamId, player.id);
      await nactiSoupisku();
      setHostModal(false);
      setHostQuery(''); setHostVysledky([]);
    } catch (err: any) {
      Alert.alert('Nepodařilo se přidat', err?.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setHostPridava(null);
    }
  }

  function odeberHosta(player: any) {
    Alert.alert(
      'Odebrat hostujícího hráče',
      `Odebrat ${player.firstName} ${player.lastName} ze soupisky?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Odebrat', style: 'destructive',
          onPress: async () => {
            try {
              await teamsApi.removeFromRoster(teamId!, player.id);
              await nactiSoupisku();
            } catch (err: any) {
              Alert.alert('Nepodařilo se odebrat', err?.response?.data?.error ?? 'Zkus to znovu');
            }
          },
        },
      ],
    );
  }

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
              <Text style={s.teamSub}>
                {/* Divize jen když ji tým má, jinak by řádek začínal „Nezařazeno ·" */}
                {team?.division ? `${team.division} · ` : ''}
                {roster.length} na soupisce
                {roster.some((p: any) => !p.isHome) ? ` (${roster.filter((p: any) => !p.isHome).length} hostuje)` : ''}
              </Text>
            </View>
            <View style={[s.badge, { backgroundColor: team?.color ?? Colors.go }]}>
              <Text style={s.badgeTxt}>{team?.abbr}</Text>
            </View>
          </View>

          {chybejici.length > 0 && (
            <View style={s.chybiBox}>
              <View style={s.chybiHead}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.go} />
                <Text style={s.chybiTitle}>
                  {chybejici.length} {chybejici.length === 1 ? 'hráč není' : chybejici.length < 5 ? 'hráči nejsou' : 'hráčů není'} na soupisce
                </Text>
              </View>
              <Text style={s.chybiTxt}>
                Soupiska se s novou sezónou nepřenáší — každá se skládá znovu.
                Kmenové hráče doplníš jedním klepnutím, hostující se musí sjednat nanovo.
              </Text>
              <Pressable style={[s.chybiBtn, doplnuje && { opacity: 0.6 }]} onPress={doplnKmenove} disabled={doplnuje}>
                {doplnuje
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <Text style={s.chybiBtnTxt}>Doplnit kmenové hráče</Text>}
              </Pressable>
            </View>
          )}

          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Hledat hráče..." />
          </View>
          <FlatList
            data={roster.filter((p: any) =>
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
                  <Text style={s.pos}>
                    {POS[item.position] ?? item.position}
                    {item.isHome === false && item.team?.abbr ? ` · kmenově ${item.team.abbr}` : ''}
                  </Text>
                </View>
                {item.isHome === false && (
                  <View style={s.hostTag}><Text style={s.hostTagTxt}>hostuje</Text></View>
                )}
                <View style={[s.dot, { backgroundColor: LIC_COL[item.payment?.licStatus ?? 'PENDING'] }]} />
                <Pressable
                  style={s.removeBtn}
                  onPress={() => item.isHome === false ? odeberHosta(item) : removePlayer(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="person-remove-outline" size={16} color={Colors.red} />
                </Pressable>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            ListFooterComponent={
              <Pressable style={s.hostBtn} onPress={() => setHostModal(true)}>
                <Ionicons name="person-add-outline" size={16} color={Colors.pu} />
                <Text style={s.hostBtnTxt}>Přidat hostujícího hráče</Text>
              </Pressable>
            }
          />
        </>
      )}

      {/* ── Přidání hostujícího hráče ── */}
      <Modal visible={hostModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Přidat hostujícího hráče</Text>
              <Pressable onPress={() => { setHostModal(false); setHostQuery(''); setHostVysledky([]); }}>
                <Ionicons name="close" size={22} color={Colors.mu} />
              </Pressable>
            </View>

            <Text style={s.sheetHint}>
              Hostovat smí jen hráč se superlicencí a nejvýš ve třech týmech za sezónu.
              Jakmile je na soupisce, můžeš ho stavět do sestavy jako každého jiného.
            </Text>

            <TextInput
              style={s.sheetInput}
              value={hostQuery}
              onChangeText={hledejHrace}
              placeholder="Jméno hráče…"
              placeholderTextColor={Colors.di}
              keyboardAppearance="dark"
              autoFocus
            />

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {hostHleda && <ActivityIndicator color={Colors.go} style={{ marginTop: 16 }} />}
              {!hostHleda && hostQuery.trim().length >= 2 && hostVysledky.length === 0 && (
                <Text style={s.sheetHint}>Nikdo takový se nenašel.</Text>
              )}
              {hostVysledky.map((p: any) => (
                <Pressable
                  key={p.id}
                  style={s.hostRow}
                  onPress={() => pridejHosta(p)}
                  disabled={!!hostPridava}
                >
                  <View style={s.jersey}><Text style={s.jerseyNum}>{p.jersey ?? '–'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{p.firstName} {p.lastName}</Text>
                    <Text style={s.pos}>{p.team?.name ?? 'Bez týmu'}</Text>
                  </View>
                  {hostPridava === p.id
                    ? <ActivityIndicator color={Colors.pu} size="small" />
                    : <Ionicons name="add-circle-outline" size={20} color={Colors.pu} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  chybiBox:    { marginHorizontal: 16, marginTop: 12, backgroundColor: Colors.c2, borderWidth: 1, borderColor: `${Colors.go}44`, borderRadius: Radius.md, padding: 14 },
  chybiHead:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  chybiTitle:  { fontSize: Fonts.sizes.sm, fontWeight: '800', color: Colors.wh },
  chybiTxt:    { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18, marginBottom: 12 },
  chybiBtn:    { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  chybiBtnTxt: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },
  hostTag:     { backgroundColor: `${Colors.pu}33`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 },
  hostTagTxt:  { fontSize: 9, color: Colors.pu, fontWeight: '800' },
  hostBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.pu, borderStyle: 'dashed', borderRadius: Radius.md, padding: 14, marginTop: 12 },
  hostBtnTxt:  { fontSize: Fonts.sizes.sm, color: Colors.pu, fontWeight: '700' },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  sheetHead:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle:  { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  sheetHint:   { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18, marginBottom: 12 },
  sheetInput:  { backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, color: Colors.wh, fontSize: Fonts.sizes.md, marginBottom: 12 },
  hostRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.bd },
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
