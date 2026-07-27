import { useEffect, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { statsApi, supervisorApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { ErrorView } from '../../components/ErrorView';

type Tab = 'scorers' | 'assisters' | 'mvp' | 'referees';

const TABS: { key: Tab; label: string }[] = [
  { key: 'scorers',   label: 'Střelci' },
  { key: 'assisters', label: 'Nahrávači' },
  { key: 'mvp',       label: 'MVP' },
  { key: 'referees',  label: 'Rozhodčí' },
];

function StarRow({ avg }: { avg: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={avg >= i ? 'star' : avg >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={12}
          color={Colors.go}
        />
      ))}
    </View>
  );
}

export default function StatsScreen() {
  const [tab, setTab]           = useState<Tab>('scorers');
  const [divisions, setDivisions] = useState<string[]>([]);
  const [division, setDivision] = useState<string>('Vše');
  const [data, setData]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refresh, setRefresh]   = useState(false);
  const [error, setError]       = useState(false);

  // Načti seznam divizí jednou při startu
  useEffect(() => {
    supervisorApi.divisions().then(r => {
      const divs = [...new Set<string>((r.data ?? []).map((d: any) => d.division as string))].sort();
      setDivisions(divs);
    }).catch(() => {});
  }, []);

  async function load(isRefresh = false) {
    if (!isRefresh) { setLoading(true); setError(false); }
    setData([]);
    const div = division === 'Vše' ? undefined : division;
    try {
      const call =
        tab === 'scorers'   ? statsApi.scorers(div)
        : tab === 'assisters' ? statsApi.assisters(div)
        : tab === 'mvp'       ? statsApi.mvp(div)
        :                       statsApi.referees();
      const r = await call;
      setData(r.data);
    } catch {
      if (!isRefresh) setError(true);
    }
    setLoading(false);
    setRefresh(false);
  }

  useEffect(() => { load(); }, [tab, division]);

  function getValueLabel(item: any): string {
    if (tab === 'scorers')   return `${item.goals} G`;
    if (tab === 'assisters') return `${item.assists} A`;
    if (tab === 'mvp')       return `${item.votes}×`;
    return '';
  }

  function renderPlayerRow({ item, index }: { item: any; index: number }) {
    return (
      <Pressable
        style={styles.row}
        onPress={() => item.player?.id && router.push(`/player/${item.player.id}` as any)}
      >
        <Text style={styles.pos}>{index + 1}</Text>
        <View style={styles.info}>
          <Text style={styles.name}>
            {item.player?.firstName} {item.player?.lastName}
          </Text>
          <Text style={styles.team}>{item.player?.team?.abbr}</Text>
        </View>
        <Text style={styles.value}>{getValueLabel(item)}</Text>
      </Pressable>
    );
  }

  function renderRefereeRow({ item, index }: { item: any; index: number }) {
    return (
      <Pressable
        style={styles.row}
        onPress={() => item.referee?.id && router.push(`/referee/${item.referee.id}` as any)}
      >
        <Text style={styles.pos}>{index + 1}</Text>
        <View style={styles.info}>
          <Text style={styles.name}>
            {item.referee?.firstName} {item.referee?.lastName}
          </Text>
          <View style={styles.refMeta}>
            <StarRow avg={item.avg} />
            <Text style={styles.refCount}>{item.count} hodnocení</Text>
          </View>
        </View>
        <View style={styles.refScore}>
          <Text style={styles.value}>{item.avg.toFixed(1)}</Text>
          <Text style={styles.refMax}>/5</Text>
        </View>
      </Pressable>
    );
  }

  const divisionList = ['Vše', ...divisions];

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Statistiky</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Division filter (skryj pro rozhodčí) */}
      {tab !== 'referees' && divisionList.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.divBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {divisionList.map(d => (
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

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.go} /></View>
      ) : error ? (
        <ErrorView onRetry={() => load()} />
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="stats-chart-outline" size={40} color={Colors.mu} />
          <Text style={styles.empty}>Zatím žádná data</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(_, idx) => String(idx)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={tab === 'referees' ? renderRefereeRow : renderPlayerRow}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(true); }} tintColor={Colors.go} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  title:        { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh, padding: 16, paddingBottom: 8 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  empty:        { fontSize: Fonts.sizes.md, color: Colors.mu },
  tabs: {
    flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 8,
  },
  tab: {
    flex: 1, paddingVertical: 7, borderRadius: Radius.md,
    backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center',
  },
  tabActive:     { backgroundColor: Colors.go, borderColor: Colors.go },
  tabText:       { fontSize: 11, color: Colors.mu, fontWeight: '600' },
  tabTextActive: { color: Colors.bg },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 14, backgroundColor: Colors.c1,
    borderRadius: Radius.md,
  },
  pos:      { width: 26, fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  info:     { flex: 1 },
  name:     { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  team:     { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  value:    { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.go },
  sep:      { height: 6 },
  refMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  refCount: { fontSize: Fonts.sizes.xs, color: Colors.di },
  refScore: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  refMax:   { fontSize: Fonts.sizes.sm, color: Colors.mu },
  divBar:        { flexGrow: 0, marginBottom: 4 },
  divChip:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  divChipActive: { backgroundColor: Colors.go, borderColor: Colors.go },
  divChipTxt:    { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  divChipTxtActive: { color: Colors.bg },
});
