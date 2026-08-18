import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { matchesApi, teamsApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function LineupScreen() {
  const { user }   = useAuthStore();
  const teamId     = user?.manager?.[0]?.teamId;

  const [loading, setLoading]     = useState(true);
  const [matches, setMatches]     = useState<any[]>([]);
  const [players, setPlayers]     = useState<any[]>([]);
  const [selected, setSelected]   = useState<any>(null);   // vybraný zápas
  const [picked, setPicked]       = useState<Set<string>>(new Set());
  const [goalkeeper, setGoalkeeper] = useState<string>(''); // player ID brankáře
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    Promise.all([
      matchesApi.list({ teamId, status: 'UPCOMING' }),
      teamsApi.get(teamId),
    ])
      .then(([mRes, tRes]) => {
        setMatches(mRes.data);
        setPlayers(tRes.data.players ?? []);
      })
      .catch(() => Alert.alert('Chyba', 'Nepodařilo se načíst data'))
      .finally(() => setLoading(false));
  }, [teamId]);

  function togglePlayer(id: string) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // odebrat brankáře pokud byl odebrán ze soupisky
        if (goalkeeper === id) setGoalkeeper('');
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleGoalkeeper(id: string) {
    setGoalkeeper(prev => prev === id ? '' : id);
  }

  function isLicensed(p: any) {
    return ['PAID', 'WAIVED'].includes(p.payment?.licStatus);
  }

  async function doSubmit(force = false) {
    setSubmitting(true);
    try {
      await matchesApi.lineup(
        selected!.id,
        teamId!,
        [...picked].map(id => ({ playerId: id, isGoalkeeper: id === goalkeeper })),
        force,
      );
      Alert.alert('Hotovo', 'Soupiska odeslána!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'UNLICENSED_PLAYERS') {
        const names = (err.response.data.unlicensed as any[])
          .map((u: any) => `${u.jersey ? `#${u.jersey} ` : ''}${u.firstName} ${u.lastName}`)
          .join('\n');
        Alert.alert(
          '⚠️ Hráči bez licence',
          `Tito hráči nemají platnou licenci:\n\n${names}\n\nOdeslat soupisku přesto?`,
          [
            { text: 'Zrušit', style: 'cancel' },
            { text: 'Odeslat přesto', style: 'destructive', onPress: () => doSubmit(true) },
          ],
        );
      } else {
        Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se odeslat soupisku');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitLineup() {
    if (!selected || picked.size === 0) {
      Alert.alert('Upozornění', 'Vyber zápas a aspoň jednoho hráče.');
      return;
    }
    if (picked.size < 9) {
      Alert.alert('Nedostatek hráčů', `Soupiska musí mít min. 9 hráčů (aktuálně ${picked.size}).`);
      return;
    }
    if (!goalkeeper || !picked.has(goalkeeper)) {
      Alert.alert('Chybí brankář', 'Označ jednoho hráče jako brankáře (GK).');
      return;
    }
    await doSubmit(false);
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Soupiska před zápasem</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
      ) : matches.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="football-outline" size={48} color={Colors.mu} />
          <Text style={s.empty}>Žádné nadcházející zápasy</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Výběr zápasu */}
          <Text style={s.sectionTitle}>1. Vyber zápas</Text>
          {matches.map(m => (
            <Pressable
              key={m.id}
              style={[s.matchCard, selected?.id === m.id && s.matchCardActive]}
              onPress={() => { setSelected(m); setPicked(new Set()); setGoalkeeper(''); }}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.matchTeams}>{m.homeTeam?.abbr} vs {m.awayTeam?.abbr}</Text>
                <Text style={s.matchDate}>{fmt(m.date)}</Text>
                {m.venue && <Text style={s.matchVenue}>{m.venue}</Text>}
              </View>
              {selected?.id === m.id && <Ionicons name="checkmark-circle" size={20} color={Colors.go} />}
            </Pressable>
          ))}

          {/* Výběr hráčů */}
          {selected && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 20 }]}>
                2. Vyber hráče ({picked.size} vybráno{goalkeeper ? ' · GK ✓' : ' · GK chybí'})
              </Text>
              {players.map(p => {
                const sel = picked.has(p.id);
                const lic = isLicensed(p);
                const isGK = goalkeeper === p.id;
                return (
                  <Pressable key={p.id} style={[s.playerRow, sel && s.playerRowSel, isGK && s.playerRowGK]} onPress={() => togglePlayer(p.id)}>
                    <View style={[s.jersey, { borderColor: isGK ? Colors.pu : lic ? Colors.go : Colors.red }]}>
                      <Text style={[s.jerseyNum, isGK && { color: Colors.pu }]}>{p.jersey ?? '–'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.playerName, sel && { color: Colors.wh }]}>
                        {p.firstName} {p.lastName}
                      </Text>
                      {!lic && (
                        <Text style={s.noLicTxt}>⚠️ bez licence</Text>
                      )}
                    </View>
                    {sel && (
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); toggleGoalkeeper(p.id); }}
                        style={[s.gkBtn, isGK && s.gkBtnActive]}
                        hitSlop={8}
                      >
                        <Text style={[s.gkBtnTxt, isGK && s.gkBtnTxtActive]}>GK</Text>
                      </Pressable>
                    )}
                    <Ionicons
                      name={sel ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={sel ? Colors.go : Colors.di}
                      style={{ marginLeft: 6 }}
                    />
                  </Pressable>
                );
              })}

              <Pressable
                style={[s.submitBtn, (submitting || picked.size === 0) && { opacity: 0.5 }]}
                onPress={submitLineup}
                disabled={submitting || picked.size === 0}
              >
                {submitting
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <Text style={s.submitBtnText}>Odeslat soupisku</Text>
                }
              </Pressable>
            </>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:           { width: 40, height: 40, justifyContent: 'center' },
  title:          { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  empty:          { fontSize: Fonts.sizes.sm, color: Colors.mu },
  sectionTitle:   { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  matchCard:      { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  matchCardActive:{ borderColor: Colors.go },
  matchTeams:     { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  matchDate:      { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  matchVenue:     { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 1 },
  playerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: Colors.bd },
  playerRowSel:   { borderColor: Colors.go, backgroundColor: Colors.c2 },
  playerRowGK:    { borderColor: Colors.pu },
  gkBtn:          { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.di },
  gkBtnActive:    { backgroundColor: Colors.pu, borderColor: Colors.pu },
  gkBtnTxt:       { fontSize: 10, fontWeight: '700', color: Colors.di },
  gkBtnTxtActive: { color: Colors.wh },
  jersey:         { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.c2, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  noLicTxt:       { fontSize: 10, color: Colors.red, marginTop: 1 },
  jerseyNum:      { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.go },
  playerName:     { flex: 1, fontSize: Fonts.sizes.md, color: Colors.mu, fontWeight: '500' },
  submitBtn:      { backgroundColor: Colors.go, borderRadius: Radius.md, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  submitBtnText:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
