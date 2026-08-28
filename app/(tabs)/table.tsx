import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { statsApi, type StatsScope } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { ErrorView } from '../../components/ErrorView';
import { CompetitionFilter } from '../../components/CompetitionFilter';

export default function TableScreen() {
  const [table, setTable]     = useState<any[]>([]);
  // Rozsah drží CompetitionFilter (sezóna → liga → konference → divize)
  const [scope, setScope]     = useState<StatsScope>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]     = useState(false);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else { setLoading(true); setError(false); }
    try {
      const r = await statsApi.table(scope);
      setTable(r.data ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [scope]);

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Tabulka</Text>

      <CompetitionFilter onChange={setScope} />

      {/* Hlavička tabulky */}
      <View style={styles.header}>
        <Text style={[styles.col, { flex: 0.4 }]}>#</Text>
        <Text style={[styles.col, { flex: 3, textAlign: 'left' }]}>Tým</Text>
        <Text style={styles.col}>Z</Text>
        <Text style={styles.col}>V</Text>
        <Text style={styles.col}>R</Text>
        <Text style={styles.col}>P</Text>
        <Text style={styles.col}>G</Text>
        <Text style={[styles.col, { color: Colors.go, fontWeight: '700' }]}>B</Text>
        <Text style={[styles.col, { flex: 1.4 }]}>Forma</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.go} size="large" /></View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ErrorView message="Nepodařilo se načíst tabulku" onRetry={() => load()} />
        </View>
      ) : table.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="trophy-outline" size={40} color={Colors.di} />
          <Text style={styles.emptyText}>Tabulka zatím prázdná</Text>
          <Text style={styles.emptyHint}>Zobrazí se po odehrání prvních zápasů v tomto rozsahu</Text>
        </View>
      ) : (
        <FlatList
          data={table}
          keyExtractor={item => item.teamId}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.go} />
          }
          renderItem={({ item, index }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/team/${item.teamId}`)}>
              <Text style={[styles.cell, { flex: 0.4 }, index < 3 && { color: Colors.go, fontWeight: '700' }]}>
                {index + 1}
              </Text>
              <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.dot, { backgroundColor: item.team?.color ?? Colors.go }]} />
                <Text style={styles.teamName} numberOfLines={1}>{item.team?.name ?? '—'}</Text>
              </View>
              <Text style={styles.cell}>{item.p}</Text>
              <Text style={styles.cell}>{item.w}</Text>
              <Text style={styles.cell}>{item.d}</Text>
              <Text style={styles.cell}>{item.l}</Text>
              <Text style={styles.cell}>{item.gf}:{item.ga}</Text>
              <Text style={[styles.cell, { color: Colors.go, fontWeight: '700' }]}>{item.pts}</Text>
              {/* Forma — poslední zápasy */}
              <View style={[styles.formRow, { flex: 1.4 }]}>
                {(item.form ?? []).map((r: string, i: number) => (
                  <View key={i} style={[styles.formDot, {
                    backgroundColor: r === 'W' ? Colors.green : r === 'L' ? Colors.red : '#F59E0B',
                  }]} />
                ))}
              </View>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  title:     { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh, padding: 16, paddingBottom: 8 },
  header:    {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.bd,
  },
  col:       { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, textAlign: 'center', fontWeight: '600' },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  cell:      { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh, textAlign: 'center' },
  teamName:  { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  dot:       { width: 8, height: 8, borderRadius: 4 },
  sep:       { height: 1, backgroundColor: Colors.bd, marginHorizontal: 16 },
  formRow:   { flexDirection: 'row', alignItems: 'center', gap: 2, justifyContent: 'center' },
  formDot:   { width: 6, height: 6, borderRadius: 3 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.mu },
  emptyHint: { fontSize: Fonts.sizes.sm, color: Colors.di },
});
