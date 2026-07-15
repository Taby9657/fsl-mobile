import { useEffect, useState } from 'react';
import { View, Text, SectionList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { matchesApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

type MatchStatus = 'UPCOMING' | 'LIVE' | 'DONE';

const STATUS_LABEL: Record<MatchStatus, string> = {
  UPCOMING: 'Nadcházející',
  LIVE:     'Právě hraje',
  DONE:     'Odehrané',
};

export default function MatchesScreen() {
  const [matches, setMatches] = useState<any[]>([]);
  const [filter, setFilter]   = useState<MatchStatus>('UPCOMING');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    matchesApi.list({ status: filter, limit: '50' })
      .then(r => setMatches(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Filter pills */}
      <View style={styles.pills}>
        {(['LIVE', 'UPCOMING', 'DONE'] as MatchStatus[]).map(s => (
          <Pressable key={s} style={[styles.pill, filter === s && styles.pillActive]} onPress={() => setFilter(s)}>
            <Text style={[styles.pillText, filter === s && styles.pillTextActive]}>{STATUS_LABEL[s]}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.go} /></View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name={filter === 'UPCOMING' ? 'calendar-outline' : filter === 'LIVE' ? 'radio-outline' : 'checkmark-circle-outline'} size={48} color={Colors.di} />
          <Text style={styles.emptyTitle}>
            {filter === 'UPCOMING' ? 'Žádné nadcházející zápasy' : filter === 'LIVE' ? 'Žádný zápas právě neprobíhá' : 'Žádné odehrané zápasy'}
          </Text>
          <Text style={styles.emptyDesc}>
            {filter === 'UPCOMING' ? 'Rozpis zápasů přidá supervisor' : filter === 'LIVE' ? 'Živé výsledky se zobrazí jakmile zápas začne' : 'Odehrané zápasy se zobrazí po ukončení sezony'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={[{ title: STATUS_LABEL[filter], data: matches }]}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/match/${item.id}`)}>
              <View style={styles.cardRow}>
                <Text style={styles.date}>
                  {format(new Date(item.date), 'EEE d. M. · HH:mm', { locale: cs })}
                </Text>
                {item.status === 'LIVE' && (
                  <View style={styles.liveBadge}><Text style={styles.liveText}>LIVE</Text></View>
                )}
              </View>
              <View style={styles.teams}>
                <Text style={styles.teamName}>{item.homeTeam.name}</Text>
                {item.status === 'DONE' ? (
                  <Text style={styles.score}>{item.homeScore} : {item.awayScore}</Text>
                ) : (
                  <Text style={styles.vs}>vs</Text>
                )}
                <Text style={[styles.teamName, { textAlign: 'right' }]}>{item.awayTeam.name}</Text>
              </View>
              {item.venue && <Text style={styles.venue}>{item.venue}</Text>}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 10 },
  empty:     { color: Colors.mu, fontSize: Fonts.sizes.sm },
  emptyTitle:{ fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.mu, textAlign: 'center' },
  emptyDesc: { fontSize: Fonts.sizes.sm, color: Colors.di, textAlign: 'center', lineHeight: 20 },
  pills:  { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 0 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full,
    backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd,
  },
  pillActive:     { backgroundColor: Colors.go, borderColor: Colors.go },
  pillText:       { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  pillTextActive: { color: Colors.bg },
  sectionHeader:  { fontSize: Fonts.sizes.sm, color: Colors.mu, marginBottom: 8, fontWeight: '600' },
  card: {
    backgroundColor: Colors.c1, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.bd, padding: 14, marginBottom: 8,
  },
  cardRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  date:     { fontSize: Fonts.sizes.xs, color: Colors.mu },
  liveBadge:{ backgroundColor: Colors.red, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  liveText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  teams:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: { flex: 1, fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  score:    { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.go, minWidth: 60, textAlign: 'center' },
  vs:       { fontSize: Fonts.sizes.sm, color: Colors.mu, minWidth: 30, textAlign: 'center' },
  venue:    { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 6 },
});
