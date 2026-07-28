import { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { matchesApi, supervisorApi, statsApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { ErrorView } from '../../components/ErrorView';
import { LiveBadge } from '../../components/LiveBadge';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

const LIVE_POLL_INTERVAL = 10_000;

type MatchStatus = 'UPCOMING' | 'LIVE' | 'DONE';

const STATUS_LABEL: Record<MatchStatus, string> = {
  UPCOMING: 'Nadcházející',
  LIVE:     'Právě hraje',
  DONE:     'Odehrané',
};

export default function MatchesScreen() {
  const [matches, setMatches]     = useState<any[]>([]);
  const [filter, setFilter]       = useState<MatchStatus>('UPCOMING');
  const [divisions, setDivisions] = useState<string[]>([]);
  const [division, setDivision]   = useState<string | undefined>(undefined);
  const [seasons, setSeasons]     = useState<string[]>([]);
  const [season, setSeason]       = useState<string | undefined>(undefined);
  const [loading, setLoading]     = useState(true);
  const [refresh, setRefresh]     = useState(false);
  const [error, setError]         = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Načti divize + sezóny jednou při startu
  useEffect(() => {
    supervisorApi.divisions().then(r => {
      const divs = [...new Set<string>((r.data ?? []).map((d: any) => d.division as string))].sort();
      setDivisions(divs);
    }).catch(() => {});
    statsApi.seasons().then(r => {
      const ss: string[] = r.data ?? [];
      setSeasons(ss);
    }).catch(() => {});
  }, []);

  async function load(isRefresh = false) {
    if (!isRefresh) { setLoading(true); setError(false); }
    try {
      const params: Record<string, string> = { status: filter, limit: '50' };
      if (division) params.division = division;
      if (season)   params.season   = season;
      const r = await matchesApi.list(params);
      setMatches(r.data);
    } catch {
      if (!isRefresh) setError(true);
    }
    setLoading(false);
    setRefresh(false);
  }

  useEffect(() => {
    load();
    if (filter === 'LIVE') {
      pollRef.current = setInterval(() => load(true), LIVE_POLL_INTERVAL);
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [filter, division, season]);

  const divisionList = ['Vše', ...divisions];
  const showSeasons  = seasons.length > 1 && filter === 'DONE';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Status filter */}
      <View style={styles.pills}>
        {(['LIVE', 'UPCOMING', 'DONE'] as MatchStatus[]).map(s => (
          <Pressable key={s} style={[styles.pill, filter === s && styles.pillActive]} onPress={() => setFilter(s)}>
            <Text style={[styles.pillText, filter === s && styles.pillTextActive]}>{STATUS_LABEL[s]}</Text>
          </Pressable>
        ))}
      </View>

      {/* Division filter */}
      {divisionList.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.divBar}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {divisionList.map(d => (
            <Pressable
              key={d}
              style={[styles.divChip, (division === d || (d === 'Vše' && !division)) && styles.divChipActive]}
              onPress={() => setDivision(d === 'Vše' ? undefined : d)}
            >
              <Text style={[styles.divChipTxt, (division === d || (d === 'Vše' && !division)) && styles.divChipTxtActive]}>{d}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Season filter – jen pro DONE zápasy */}
      {showSeasons && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.divBar}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {seasons.map(s => (
            <Pressable
              key={s}
              style={[styles.divChip, (season === s || (!season && s === seasons[0])) && styles.divChipActive]}
              onPress={() => setSeason(s === seasons[0] && !season ? undefined : s)}
            >
              <Text style={[styles.divChipTxt, (season === s || (!season && s === seasons[0])) && styles.divChipTxtActive]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.go} /></View>
      ) : error ? (
        <ErrorView onRetry={() => load()} />
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name={filter === 'UPCOMING' ? 'calendar-outline' : filter === 'LIVE' ? 'radio-outline' : 'checkmark-circle-outline'}
            size={48}
            color={Colors.di}
          />
          <Text style={styles.emptyTitle}>
            {filter === 'UPCOMING' ? 'Žádné nadcházející zápasy' : filter === 'LIVE' ? 'Žádný zápas právě neprobíhá' : 'Žádné odehrané zápasy'}
          </Text>
          <Text style={styles.emptyDesc}>
            {filter === 'UPCOMING' ? 'Rozpis zápasů přidá supervisor' : filter === 'LIVE' ? 'Živé výsledky se zobrazí jakmile zápas začne' : 'Odehrané zápasy se zobrazí po ukončení sezony'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(true); }} tintColor={Colors.go} />}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/match/${item.id}`)}>
              <View style={styles.cardRow}>
                <Text style={styles.date}>
                  {format(new Date(item.date), 'EEE d. M. · HH:mm', { locale: cs })}
                </Text>
                {item.status === 'LIVE' && <LiveBadge />}
              </View>
              <View style={styles.teams}>
                <Text style={styles.teamName}>{item.homeTeam.name}</Text>
                {(item.status === 'DONE' || item.status === 'LIVE') ? (
                  <Text style={styles.score}>{item.homeScore} : {item.awayScore}</Text>
                ) : (
                  <Text style={styles.vs}>vs</Text>
                )}
                <Text style={[styles.teamName, { textAlign: 'right' }]}>{item.awayTeam.name}</Text>
              </View>
              {(item.venue || item.division) && (
                <Text style={styles.venue}>
                  {[item.division, item.venue].filter(Boolean).join(' · ')}
                </Text>
              )}
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.bg },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  emptyTitle:    { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.mu, textAlign: 'center' },
  emptyDesc:     { fontSize: Fonts.sizes.sm, color: Colors.di, textAlign: 'center', lineHeight: 20 },
  pills:         { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full,
    backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd,
  },
  pillActive:      { backgroundColor: Colors.go, borderColor: Colors.go },
  pillText:        { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  pillTextActive:  { color: Colors.bg },
  divBar:          { flexGrow: 0, marginBottom: 4 },
  divChip:         { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  divChipActive:   { backgroundColor: Colors.go, borderColor: Colors.go },
  divChipTxt:      { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  divChipTxtActive:{ color: Colors.bg },
  card: {
    backgroundColor: Colors.c1, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.bd, padding: 14,
  },
  cardRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  date:      { fontSize: Fonts.sizes.xs, color: Colors.mu },
  teams:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName:  { flex: 1, fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  score:     { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.go, minWidth: 60, textAlign: 'center' },
  vs:        { fontSize: Fonts.sizes.sm, color: Colors.mu, minWidth: 30, textAlign: 'center' },
  venue:     { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 6 },
});
