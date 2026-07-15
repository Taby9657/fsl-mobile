import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { matchesApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`;
}

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={8}>
          <Ionicons name={i <= value ? 'star' : 'star-outline'} size={28} color={Colors.go} />
        </Pressable>
      ))}
    </View>
  );
}

export default function PostMatchScreen() {
  const { user }   = useAuthStore();
  const teamId     = user?.manager?.[0]?.teamId;

  const [loading, setLoading]       = useState(true);
  const [matches, setMatches]       = useState<any[]>([]);
  const [selected, setSelected]     = useState<any>(null);
  const [matchDetail, setDetail]    = useState<any>(null);
  const [mvpId, setMvpId]           = useState('');
  const [refRating, setRefRating]   = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    matchesApi.list({ teamId, status: 'PLAYED' })
      .then(r => setMatches(r.data))
      .catch(() => Alert.alert('Chyba', 'Nepodařilo se načíst zápasy'))
      .finally(() => setLoading(false));
  }, [teamId]);

  async function selectMatch(m: any) {
    setSelected(m);
    setMvpId('');
    setRefRating(0);
    try {
      const res = await matchesApi.get(m.id);
      setDetail(res.data);
    } catch {}
  }

  // Hráči mého týmu v daném zápase
  const myLineup = matchDetail?.lineups?.find((l: any) => l.teamId === teamId);
  const myPlayers: any[] = myLineup?.players?.map((lp: any) => lp.player) ?? [];

  async function submit() {
    if (!selected || refRating === 0) {
      Alert.alert('Upozornění', 'Vyber zápas a ohodnoť rozhodčího.');
      return;
    }
    setSubmitting(true);
    try {
      await matchesApi.postmatch(selected.id, teamId!, {
        mvpPlayerId:    mvpId || null,
        refRating:      refRating,
      });
      await matchesApi.submitPostmatch(selected.id, teamId!);
      Alert.alert('Hotovo', 'Po-zápasový formulář odeslán!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se odeslat formulář');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Po-zápasový formulář</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
      ) : matches.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="football-outline" size={48} color={Colors.mu} />
          <Text style={s.empty}>Žádné odehrané zápasy k vyplnění</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>

          {/* Výběr zápasu */}
          <Text style={s.section}>1. Vyber zápas</Text>
          {matches.map(m => (
            <Pressable
              key={m.id}
              style={[s.matchCard, selected?.id === m.id && s.matchCardActive]}
              onPress={() => selectMatch(m)}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.matchTeams}>{m.homeTeam?.abbr} vs {m.awayTeam?.abbr}</Text>
                <Text style={s.matchMeta}>{fmt(m.date)} · {m.homeScore ?? '?'}:{m.awayScore ?? '?'}</Text>
              </View>
              {selected?.id === m.id && <Ionicons name="checkmark-circle" size={20} color={Colors.go} />}
            </Pressable>
          ))}

          {selected && (
            <>
              {/* Hodnocení rozhodčího */}
              <Text style={[s.section, { marginTop: 20 }]}>2. Hodnocení rozhodčího</Text>
              {selected.referee ? (
                <View style={s.card}>
                  <Text style={s.cardLabel}>
                    {selected.referee.firstName} {selected.referee.lastName}
                    {' · '}úroveň {selected.referee.level}
                  </Text>
                  <View style={{ marginTop: 12 }}>
                    <Stars value={refRating} onChange={setRefRating} />
                  </View>
                  {refRating > 0 && (
                    <Text style={[s.cardLabel, { marginTop: 8, color: Colors.go }]}>
                      {refRating}/5 hvězdiček
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={s.empty}>K tomuto zápasu není přiřazen rozhodčí.</Text>
              )}

              {/* MVP */}
              <Text style={[s.section, { marginTop: 20 }]}>3. MVP zápasu (volitelné)</Text>
              {myPlayers.length === 0 ? (
                <Text style={s.empty}>Soupiska k tomuto zápasu nebyla odeslána.</Text>
              ) : (
                myPlayers.map(p => (
                  <Pressable
                    key={p.id}
                    style={[s.playerRow, mvpId === p.id && s.playerRowSel]}
                    onPress={() => setMvpId(prev => prev === p.id ? '' : p.id)}
                  >
                    <View style={s.jersey}>
                      <Text style={s.jerseyNum}>{p.jersey ?? '–'}</Text>
                    </View>
                    <Text style={[s.playerName, mvpId === p.id && { color: Colors.wh }]}>
                      {p.firstName} {p.lastName}
                    </Text>
                    {mvpId === p.id && <Ionicons name="trophy" size={18} color={Colors.go} />}
                  </Pressable>
                ))
              )}

              <Pressable
                style={[s.submitBtn, (submitting || refRating === 0) && { opacity: 0.5 }]}
                onPress={submit}
                disabled={submitting || refRating === 0}
              >
                {submitting
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <Text style={s.submitBtnText}>Odeslat formulář</Text>
                }
              </Pressable>
            </>
          )}

          <View style={{ height: 40 }} />
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
  empty:          { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' },
  section:        { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  matchCard:      { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  matchCardActive:{ borderColor: Colors.go },
  matchTeams:     { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  matchMeta:      { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 3 },
  card:           { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16 },
  cardLabel:      { fontSize: Fonts.sizes.sm, color: Colors.mu },
  playerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: Colors.bd },
  playerRowSel:   { borderColor: Colors.go, backgroundColor: Colors.c2 },
  jersey:         { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.c2, justifyContent: 'center', alignItems: 'center' },
  jerseyNum:      { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.go },
  playerName:     { flex: 1, fontSize: Fonts.sizes.md, color: Colors.mu, fontWeight: '500' },
  submitBtn:      { backgroundColor: Colors.go, borderRadius: Radius.md, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  submitBtnText:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
