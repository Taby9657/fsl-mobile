import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { statsApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

export default function TableScreen() {
  const [table, setTable]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi.table().then(r => setTable(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={Colors.go} size="large" /></View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.title}>Tabulka – Divize A</Text>

      {/* Hlavička tabulky */}
      <View style={styles.header}>
        <Text style={[styles.col, { flex: 0.4 }]}>#</Text>
        <Text style={[styles.col, { flex: 3 }]}>Tým</Text>
        <Text style={styles.col}>Z</Text>
        <Text style={styles.col}>V</Text>
        <Text style={styles.col}>R</Text>
        <Text style={styles.col}>P</Text>
        <Text style={styles.col}>G</Text>
        <Text style={[styles.col, { color: Colors.go, fontWeight: '700' }]}>B</Text>
      </View>

      <FlatList
        data={table}
        keyExtractor={item => item.teamId}
        contentContainerStyle={{ paddingHorizontal: 16 }}
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
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  title:  { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh, padding: 16, paddingBottom: 8 },
  header: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.bd,
  },
  col:      { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, textAlign: 'center', fontWeight: '600' },
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  cell:     { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh, textAlign: 'center' },
  teamName: { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  sep:      { height: 1, backgroundColor: Colors.bd, marginHorizontal: 16 },
});
