import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { statsApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

type Tab = 'scorers' | 'assisters' | 'mvp';
const TABS: { key: Tab; label: string }[] = [
  { key: 'scorers',   label: 'Střelci' },
  { key: 'assisters', label: 'Nahrávači' },
  { key: 'mvp',       label: 'MVP' },
];

export default function StatsScreen() {
  const [tab, setTab]       = useState<Tab>('scorers');
  const [data, setData]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const call = tab === 'scorers'   ? statsApi.scorers()
               : tab === 'assisters' ? statsApi.assisters()
               :                       statsApi.mvp();
    call.then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [tab]);

  function getValue(item: any) {
    if (tab === 'scorers')   return `${item.goals} G`;
    if (tab === 'assisters') return `${item.assists} A`;
    return `${item.votes}×`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Statistiky</Text>

      {/* Tagy */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <Pressable key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={Colors.go} /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(_, idx) => String(idx)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item, index }) => (
            <View style={styles.row}>
              <Text style={styles.pos}>{index + 1}</Text>
              <View style={styles.info}>
                <Text style={styles.name}>{item.player?.firstName} {item.player?.lastName}</Text>
                <Text style={styles.team}>{item.player?.team?.abbr}</Text>
              </View>
              <Text style={styles.value}>{getValue(item)}</Text>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  title:  { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh, padding: 16, paddingBottom: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs:   { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.md,
    backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center',
  },
  tabActive:     { backgroundColor: Colors.go, borderColor: Colors.go },
  tabText:       { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  tabTextActive: { color: Colors.bg },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 16, backgroundColor: Colors.c1,
    borderRadius: Radius.md, marginBottom: 4,
  },
  pos:   { width: 28, fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  info:  { flex: 1 },
  name:  { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  team:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  value: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.go },
  sep:   { height: 4 },
});
