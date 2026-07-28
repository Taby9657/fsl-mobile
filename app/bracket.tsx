import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { goBack } from '../utils/navigation';
import { matchesApi, statsApi, supervisorApi } from '../services/api';
import { Colors, Fonts, Radius } from '../constants/colors';
import { ErrorView } from '../components/ErrorView';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

const ROUND_LABELS: Record<number, string> = {
  1: 'Osmifinále',
  2: 'Čtvrtfinále',
  3: 'Semifinále',
  4: 'Finále',
};

function getRoundLabel(round: number, maxRound: number): string {
  // Pokud víme, kolik kol je celkem, mapujeme od konce
  const fromEnd = maxRound - round;
  if (fromEnd === 0) return 'Finále';
  if (fromEnd === 1) return 'Semifinále';
  if (fromEnd === 2) return 'Čtvrtfinále';
  if (fromEnd === 3) return 'Osmifinále';
  return `Kolo ${round}`;
}

function MatchCard({ match, onPress }: { match: any; onPress: () => void }) {
  const isDone     = match.status === 'DONE';
  const homeWon    = isDone && match.homeScore > match.awayScore;
  const awayWon    = isDone && match.awayScore > match.homeScore;
  const homeColor  = match.homeTeam?.color ?? Colors.go;
  const awayColor  = match.awayTeam?.color ?? Colors.pu;

  return (
    <Pressable style={s.matchCard} onPress={onPress}>
      {/* Domácí tým */}
      <View style={[s.teamRow, homeWon && s.winnerRow]}>
        <View style={[s.teamDot, { backgroundColor: homeColor }]} />
        <Text style={[s.teamName, homeWon && s.winnerName]} numberOfLines={1}>
          {match.homeTeam?.abbr ?? '?'}
        </Text>
        <Text style={[s.score, homeWon && s.winnerScore]}>
          {isDone ? match.homeScore : '—'}
        </Text>
      </View>

      <View style={s.matchSep} />

      {/* Hostující tým */}
      <View style={[s.teamRow, awayWon && s.winnerRow]}>
        <View style={[s.teamDot, { backgroundColor: awayColor }]} />
        <Text style={[s.teamName, awayWon && s.winnerName]} numberOfLines={1}>
          {match.awayTeam?.abbr ?? '?'}
        </Text>
        <Text style={[s.score, awayWon && s.winnerScore]}>
          {isDone ? match.awayScore : '—'}
        </Text>
      </View>

      {/* Datum */}
      <Text style={s.matchDate}>
        {format(new Date(match.date), 'd. M. HH:mm', { locale: cs })}
      </Text>

      {match.status === 'LIVE' && (
        <View style={s.livePill}><Text style={s.liveTxt}>LIVE</Text></View>
      )}
    </Pressable>
  );
}

export default function BracketScreen() {
  const [rounds, setRounds]     = useState<Record<number, any[]>>({});
  const [divisions, setDivisions] = useState<string[]>([]);
  const [seasons, setSeasons]   = useState<string[]>([]);
  const [division, setDivision] = useState<string | undefined>(undefined);
  const [season, setSeason]     = useState<string | undefined>(undefined);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);

  useEffect(() => {
    supervisorApi.divisions().then(r => {
      const divs = [...new Set<string>((r.data ?? []).map((d: any) => d.division as string))].sort();
      setDivisions(divs);
    }).catch(() => {});
    statsApi.seasons().then(r => {
      const ss: string[] = r.data ?? [];
      setSeasons(ss);
      if (ss.length) setSeason(ss[0]);
    }).catch(() => {});
  }, []);

  async function loadBracket() {
    setLoading(true);
    setError(false);
    try {
      const r = await matchesApi.bracket(division, season);
      setRounds(r.data ?? {});
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBracket(); }, [division, season]);

  const roundKeys  = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const maxRound   = roundKeys.length ? Math.max(...roundKeys) : 0;
  const hasMatches = roundKeys.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Play-off pavouk</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filtry */}
      <View style={s.filters}>
        {divisions.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Pressable
              style={[s.chip, !division && s.chipActive]}
              onPress={() => setDivision(undefined)}
            >
              <Text style={[s.chipTxt, !division && s.chipTxtActive]}>Vše</Text>
            </Pressable>
            {divisions.map(d => (
              <Pressable
                key={d}
                style={[s.chip, division === d && s.chipActive]}
                onPress={() => setDivision(d)}
              >
                <Text style={[s.chipTxt, division === d && s.chipTxtActive]}>{d}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {seasons.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginTop: 6 }}>
            {seasons.map(s2 => (
              <Pressable
                key={s2}
                style={[s.chip, season === s2 && s.chipActive]}
                onPress={() => setSeason(s2)}
              >
                <Text style={[s.chipTxt, season === s2 && s.chipTxtActive]}>{s2}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.go} size="large" />
        </View>
      ) : error ? (
        <ErrorView onRetry={loadBracket} />
      ) : !hasMatches ? (
        <View style={s.center}>
          <Ionicons name="podium-outline" size={48} color={Colors.di} />
          <Text style={s.emptyTitle}>Žádné play-off zápasy</Text>
          <Text style={s.emptyDesc}>Zápasy s nastaveným číslem kola se zobrazí zde</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <ScrollView>
            <View style={s.bracket}>
              {roundKeys.map(round => (
                <View key={round} style={s.roundCol}>
                  <Text style={s.roundLabel}>{getRoundLabel(round, maxRound)}</Text>
                  <View style={s.roundMatches}>
                    {rounds[round].map((match: any) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        onPress={() => router.push(`/match/${match.id}` as any)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:    { width: 40, height: 40, justifyContent: 'center' },
  title:   { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  emptyDesc:  { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', paddingHorizontal: 32 },

  filters: { paddingHorizontal: 16, paddingBottom: 8 },
  chip:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  chipActive:  { backgroundColor: Colors.go, borderColor: Colors.go },
  chipTxt:     { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700' },
  chipTxtActive: { color: Colors.bg },

  bracket:      { flexDirection: 'row', padding: 16, gap: 12 },
  roundCol:     { width: 160 },
  roundLabel:   { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.mu, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, textAlign: 'center' },
  roundMatches: { gap: 12 },

  matchCard: { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden', position: 'relative' },
  teamRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  winnerRow: { backgroundColor: `${Colors.go}12` },
  teamDot:   { width: 8, height: 8, borderRadius: 4 },
  teamName:  { flex: 1, fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.mu },
  winnerName:{ color: Colors.wh, fontWeight: '700' },
  score:     { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.mu, minWidth: 20, textAlign: 'right' },
  winnerScore: { color: Colors.go },
  matchSep:  { height: 1, backgroundColor: Colors.bd },
  matchDate: { fontSize: 10, color: Colors.di, textAlign: 'center', paddingBottom: 6, marginTop: 2 },
  livePill:  { position: 'absolute', top: 6, right: 6, backgroundColor: Colors.red, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  liveTxt:   { fontSize: 9, fontWeight: '800', color: Colors.wh },
});
