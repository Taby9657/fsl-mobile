import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { statsApi, supervisorApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { ErrorView } from '../../components/ErrorView';

export default function TableScreen() {
  const [table, setTable]         = useState<any[]>([]);
  const [divisions, setDivisions] = useState<string[]>([]);
  const [division, setDivision]   = useState<string | undefined>(undefined);
  const [seasons, setSeasons]     = useState<string[]>([]);
  const [season, setSeason]       = useState<string | undefined>(undefined);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(false);

  // Načti seznam divizí a sezón jednou při startu
  useEffect(() => {
    supervisorApi.divisions().then(r => {
      const divs = [...new Set<string>((r.data ?? []).map((d: any) => d.division as string))].sort();
      setDivisions(divs);
      if (divs.length > 0 && division === undefined) setDivision(divs[0]);
    }).catch(() => {});
    statsApi.seasons().then(r => {
      const ss: string[] = r.data ?? [];
      setSeasons(ss);
      if (ss.length > 0) setSeason(ss[0]);
    }).catch(() => {});
  }, []);

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else { setLoading(true); setError(false); }
    try {
      const r = await statsApi.table(division, season);
      setTable(r.data ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [division, season]);

  const title = division ?? 'Tabulka';

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={Colors.go} size="large" /></View>
  );

  if (error) return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>{title}</Text>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ErrorView message="Nepodařilo se načíst tabulku" onRetry={() => load()} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Tabulka</Text>

      {/* Division selector */}
      {divisions.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.divBar}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {divisions.map(d => (
            <Pressable
              key={d}
              style={[styles.divChip, division === d && styles.divChipActive]}
              onPress={() => setDivision(d)}
            >
              <Text style={[styles.divChipTxt, division === d && styles.divChipTxtActive]}>{d}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Season selector */}
      {seasons.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.divBar, { marginBottom: 4 }]}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {seasons.map(s => (
            <Pressable
              key={s}
              style={[styles.divChip, season === s && styles.divChipActive]}
              onPress={() => setSeason(s)}
            >
              <Text style={[styles.divChipTxt, season === s && styles.divChipTxtActive]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

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

      {table.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="trophy-outline" size={40} color={Colors.di} />
          <Text style={styles.emptyText}>Tabulka zatím prázdná</Text>
          <Text style={styles.emptyHint}>Zobrazí se po odehrání prvních zápasů</Text>
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
  divBar:    { flexGrow: 0, marginBottom: 8 },
  divChip:   { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  divChipActive: { backgroundColor: Colors.go, borderColor: Colors.go },
  divChipTxt:    { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  divChipTxtActive: { color: Colors.bg },
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
