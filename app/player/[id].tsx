import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { playersApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { ErrorView } from '../../components/ErrorView';

const POS: Record<string, string> = { GK: 'Brankář', F: 'Útočník', D: 'Obránce' };

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statVal}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export default function PlayerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [player, setPlayer]   = useState<any>(null);
  const [error, setError]     = useState(false);

  useEffect(() => {
    if (!id) return;
    setError(false);
    playersApi.get(id)
      .then(r => setPlayer(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Pressable onPress={() => goBack()} style={s.back}><Ionicons name="chevron-back" size={24} color={Colors.wh} /></Pressable></View>
      <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
    </SafeAreaView>
  );

  if (error) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}><Ionicons name="chevron-back" size={24} color={Colors.wh} /></Pressable>
      </View>
      <ErrorView onRetry={() => { setLoading(true); setError(false); playersApi.get(id!).then(r => setPlayer(r.data)).catch(() => setError(true)).finally(() => setLoading(false)); }} />
    </SafeAreaView>
  );

  if (!player) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}><Ionicons name="chevron-back" size={24} color={Colors.wh} /></Pressable>
        <Text style={s.title}>Hráč nenalezen</Text>
        <View style={{ width: 40 }} />
      </View>
    </SafeAreaView>
  );

  const goals   = player.goals?.length   ?? 0;
  const assists = player.assists?.length  ?? 0;
  const points  = goals + assists;
  const mvp     = player.mvpVotes?.length ?? 0;

  // Poslední zápasy
  const recentMatches = [...(player.goals ?? []), ...(player.assists ?? [])]
    .map((e: any) => e.match)
    .filter(Boolean)
    .reduce((acc: any[], m: any) => {
      if (!acc.find(x => x.id === m.id)) acc.push(m);
      return acc;
    }, [])
    .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  const licColor = player.licensed ? Colors.green : '#F59E0B';
  const licLabel = player.licensed ? 'Licencován' : 'Bez licence';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>{player.firstName} {player.lastName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView>
        {/* Hero karta */}
        <View style={s.heroCard}>
          <View style={s.avatar}>
            {player.photoUrl ? (
              <Image source={{ uri: player.photoUrl }} style={s.avatarImg} />
            ) : (
              <Text style={s.avatarNum}>{player.jersey}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroName}>{player.firstName} {player.lastName}</Text>
            <Pressable onPress={() => player.team?.id && router.push(`/team/${player.team.id}` as any)}>
              <Text style={s.heroTeam}>{player.team?.name ?? '—'} · {POS[player.position] ?? player.position}</Text>
            </Pressable>
          </View>
          <View style={[s.licBadge, { borderColor: licColor, backgroundColor: `${licColor}22` }]}>
            <Text style={[s.licTxt, { color: licColor }]}>{licLabel}</Text>
          </View>
        </View>

        {/* Statistiky */}
        <View style={s.statsRow}>
          <StatBox label="Góly"     value={goals} />
          <StatBox label="Asistence" value={assists} />
          <StatBox label="Body"     value={points} />
          <StatBox label="MVP"      value={mvp} />
        </View>

        {/* Poslední zápasy */}
        {recentMatches.length > 0 && (
          <View style={{ padding: 16 }}>
            <Text style={s.section}>Poslední zápasy</Text>
            {recentMatches.map((m: any) => {
              const myGoals   = player.goals?.filter((g: any) => g.match?.id === m.id).length ?? 0;
              const myAssists = player.assists?.filter((a: any) => a.match?.id === m.id).length ?? 0;
              return (
                <Pressable key={m.id} style={s.matchRow} onPress={() => router.push(`/match/${m.id}` as any)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.matchTeams}>{m.homeTeam?.abbr} vs {m.awayTeam?.abbr}</Text>
                    <Text style={s.matchDate}>{new Date(m.date).toLocaleDateString('cs-CZ')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {myGoals > 0   && <View style={s.statPill}><Ionicons name="football" size={11} color={Colors.go} /><Text style={s.pillTxt}>{myGoals}</Text></View>}
                    {myAssists > 0 && <View style={[s.statPill, { backgroundColor: `${Colors.pu}22` }]}><Ionicons name="hand-left" size={11} color={Colors.pu} /><Text style={[s.pillTxt, { color: Colors.pu }]}>{myAssists}</Text></View>}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.di} style={{ marginLeft: 4 }} />
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:      { width: 40, height: 40, justifyContent: 'center' },
  title:     { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroCard:  { margin: 16, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar:    { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.c2, borderWidth: 2, borderColor: Colors.go, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarNum: { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.go },
  heroName:  { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  heroTeam:  { fontSize: Fonts.sizes.xs, color: Colors.go, marginTop: 3 },
  licBadge:  { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  licTxt:    { fontSize: 10, fontWeight: '700' },
  statsRow:  { flexDirection: 'row', marginHorizontal: 16, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  statBox:   { flex: 1, alignItems: 'center', paddingVertical: 14, borderRightWidth: 1, borderRightColor: Colors.bd },
  statVal:   { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.go },
  statLabel: { fontSize: 10, color: Colors.mu, marginTop: 3 },
  section:   { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  matchRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.c1, borderRadius: Radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: Colors.bd },
  matchTeams:{ fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  matchDate: { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  statPill:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${Colors.go}22`, borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3 },
  pillTxt:   { fontSize: 11, fontWeight: '700', color: Colors.go },
});
