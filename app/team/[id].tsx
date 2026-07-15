import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { teamsApi, matchesApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

type Tab = 'roster' | 'matches';

const POS: Record<string, string> = { GK: 'Br', F: 'Ú', D: 'O' };

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading]   = useState(true);
  const [team, setTeam]         = useState<any>(null);
  const [matches, setMatches]   = useState<any[]>([]);
  const [tab, setTab]           = useState<Tab>('roster');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      teamsApi.get(id),
      matchesApi.list({ teamId: id, limit: '20' }),
    ])
      .then(([tRes, mRes]) => {
        setTeam(tRes.data);
        setMatches(mRes.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Pressable onPress={() => goBack()} style={s.back}><Ionicons name="chevron-back" size={24} color={Colors.wh} /></Pressable></View>
      <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
    </SafeAreaView>
  );

  if (!team) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}><Ionicons name="chevron-back" size={24} color={Colors.wh} /></Pressable>
        <Text style={s.title}>Tým nenalezen</Text>
        <View style={{ width: 40 }} />
      </View>
    </SafeAreaView>
  );

  const players: any[] = team.players ?? [];
  const wins   = matches.filter((m: any) => {
    if (m.status !== 'PLAYED') return false;
    const isHome = m.homeTeamId === id;
    return isHome ? m.homeScore > m.awayScore : m.awayScore > m.homeScore;
  }).length;
  const losses = matches.filter((m: any) => {
    if (m.status !== 'PLAYED') return false;
    const isHome = m.homeTeamId === id;
    return isHome ? m.homeScore < m.awayScore : m.awayScore < m.homeScore;
  }).length;
  const played = matches.filter((m: any) => m.status === 'PLAYED').length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>{team.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView>
        {/* Hero */}
        <View style={[s.hero, { borderTopColor: team.color ?? Colors.go }]}>
          <View style={[s.badge, { backgroundColor: team.color ?? Colors.go }]}>
            <Text style={s.badgeTxt}>{team.abbr}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{team.name}</Text>
            <Text style={s.heroDivision}>{team.division}</Text>
          </View>
        </View>

        {/* Mini statistiky */}
        <View style={s.statsRow}>
          <StatBox label="Hráčů"   value={players.length} />
          <StatBox label="Zápasů"  value={played} />
          <StatBox label="Výhry"   value={wins}   color={Colors.green} />
          <StatBox label="Prohry"  value={losses} color={Colors.red} />
        </View>

        {/* Tagy */}
        <View style={s.tabs}>
          {(['roster', 'matches'] as Tab[]).map(t => (
            <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'roster' ? `Soupiska (${players.length})` : 'Zápasy'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ padding: 16 }}>
          {/* ── SOUPISKA ── */}
          {tab === 'roster' && (
            players.length === 0 ? (
              <View style={s.center}>
                <Text style={s.empty}>Žádní hráči</Text>
              </View>
            ) : (
              players.map((p: any) => (
                <Pressable key={p.id} style={s.playerRow} onPress={() => router.push(`/player/${p.id}` as any)}>
                  <View style={s.jersey}>
                    <Text style={s.jerseyNum}>{p.jersey ?? '–'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.playerName}>{p.firstName} {p.lastName}</Text>
                    <Text style={s.playerPos}>{POS[p.position] ?? p.position}</Text>
                  </View>
                  <View style={[s.licDot, { backgroundColor: p.licensed ? Colors.green : '#F59E0B' }]} />
                  <Ionicons name="chevron-forward" size={14} color={Colors.di} />
                </Pressable>
              ))
            )
          )}

          {/* ── ZÁPASY ── */}
          {tab === 'matches' && (
            matches.length === 0 ? (
              <View style={s.center}>
                <Text style={s.empty}>Žádné zápasy</Text>
              </View>
            ) : (
              matches.map((m: any) => {
                const isHome = m.homeTeamId === id;
                const opp    = isHome ? m.awayTeam : m.homeTeam;
                const myScore  = isHome ? m.homeScore : m.awayScore;
                const oppScore = isHome ? m.awayScore : m.homeScore;
                const won = m.status === 'PLAYED' && myScore > oppScore;
                const lost= m.status === 'PLAYED' && myScore < oppScore;
                const result = m.status !== 'PLAYED' ? null : won ? 'V' : lost ? 'P' : 'R';
                const resultColor = won ? Colors.green : lost ? Colors.red : Colors.mu;

                return (
                  <Pressable key={m.id} style={s.matchRow} onPress={() => router.push(`/match/${m.id}` as any)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.matchOpp}>
                        {isHome ? '🏠 ' : '✈️ '}{opp?.name}
                      </Text>
                      <Text style={s.matchDate}>{new Date(m.date).toLocaleDateString('cs-CZ')}</Text>
                    </View>
                    {m.status === 'PLAYED' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={s.score}>{myScore}:{oppScore}</Text>
                        <View style={[s.resultBadge, { backgroundColor: `${resultColor}22`, borderColor: resultColor }]}>
                          <Text style={[s.resultTxt, { color: resultColor }]}>{result}</Text>
                        </View>
                      </View>
                    ) : (
                      <Text style={s.upcoming}>Nadcházející</Text>
                    )}
                    <Ionicons name="chevron-forward" size={14} color={Colors.di} style={{ marginLeft: 8 }} />
                  </Pressable>
                );
              })
            )
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={s.statBox}>
      <Text style={[s.statVal, color ? { color } : {}]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:        { width: 40, height: 40, justifyContent: 'center' },
  title:       { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  center:      { padding: 32, alignItems: 'center', gap: 8 },
  empty:       { fontSize: Fonts.sizes.sm, color: Colors.mu },
  hero:        { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 16, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, borderTopWidth: 4, padding: 16 },
  badge:       { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  badgeTxt:    { fontSize: Fonts.sizes.md, fontWeight: '900', color: Colors.bg },
  heroName:    { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  heroDivision:{ fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 3 },
  statsRow:    { flexDirection: 'row', marginHorizontal: 16, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden', marginBottom: 12 },
  statBox:     { flex: 1, alignItems: 'center', paddingVertical: 12, borderRightWidth: 1, borderRightColor: Colors.bd },
  statVal:     { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.go },
  statLabel:   { fontSize: 10, color: Colors.mu, marginTop: 2 },
  tabs:        { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 4 },
  tab:         { flex: 1, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center' },
  tabActive:   { backgroundColor: Colors.go, borderColor: Colors.go },
  tabTxt:      { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  tabTxtActive:{ color: Colors.bg },
  playerRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: Colors.bd },
  jersey:      { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.c2, justifyContent: 'center', alignItems: 'center' },
  jerseyNum:   { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.go },
  playerName:  { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  playerPos:   { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  licDot:      { width: 8, height: 8, borderRadius: 4 },
  matchRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.c1, borderRadius: Radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.bd },
  matchOpp:    { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  matchDate:   { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  score:       { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  resultBadge: { borderWidth: 1, borderRadius: 10, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  resultTxt:   { fontSize: 11, fontWeight: '700' },
  upcoming:    { fontSize: Fonts.sizes.xs, color: Colors.mu },
});
