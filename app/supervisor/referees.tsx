import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

type Filter = 'PENDING' | 'APPROVED' | 'REJECTED';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'PENDING',  label: 'Čekající' },
  { key: 'APPROVED', label: 'Schváleni' },
  { key: 'REJECTED', label: 'Zamítnuti' },
];

const LEVELS = ['A', 'B', 'C'];

export default function SuperRefereesScreen() {
  const [filter, setFilter]   = useState<Filter>('PENDING');
  const [refs, setRefs]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supervisorApi.referees(filter);
      setRefs(res.data);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function approve(ref: any) {
    Alert.alert(
      'Schválit rozhodčího',
      `${ref.firstName} ${ref.lastName} — vyber úroveň:`,
      LEVELS.map(lvl => ({
        text: `Úroveň ${lvl}`,
        onPress: async () => {
          setActing(ref.id);
          try {
            await supervisorApi.approveRef(ref.id, lvl);
            setRefs(prev => prev.filter(r => r.id !== ref.id));
            Alert.alert('Hotovo', `${ref.firstName} ${ref.lastName} schválen (${lvl})`);
          } catch (err: any) {
            Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se schválit');
          } finally {
            setActing(null);
          }
        },
      })).concat([{ text: 'Zrušit', style: 'cancel', onPress: () => {} }] as any),
    );
  }

  async function reject(ref: any) {
    Alert.alert('Zamítnout rozhodčího', `${ref.firstName} ${ref.lastName}?`, [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Zamítnout', style: 'destructive',
        onPress: async () => {
          setActing(ref.id);
          try {
            await supervisorApi.rejectRef(ref.id);
            setRefs(prev => prev.filter(r => r.id !== ref.id));
          } catch (err: any) {
            Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se zamítnout');
          } finally {
            setActing(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Rozhodčí</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.tabs}>
        {FILTERS.map(f => (
          <Pressable key={f.key} style={[s.tab, filter === f.key && s.tabActive]} onPress={() => setFilter(f.key)}>
            <Text style={[s.tabTxt, filter === f.key && s.tabTxtActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
      ) : (
        <FlatList
          data={refs}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.green} />
              <Text style={s.empty}>
                {filter === 'PENDING' ? 'Žádní čekající rozhodčí' : 'Žádní rozhodčí v této kategorii'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={s.avatar}>
                  <Ionicons name="person" size={22} color={Colors.pu} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.firstName} {item.lastName}</Text>
                  <Text style={s.email}>{item.user?.email}</Text>
                </View>
                {item.level && (
                  <View style={s.levelBadge}>
                    <Text style={s.levelTxt}>{item.level}</Text>
                  </View>
                )}
              </View>

              {filter === 'PENDING' && (
                <View style={s.actions}>
                  <Pressable
                    style={[s.approveBtn, acting === item.id && { opacity: 0.5 }]}
                    onPress={() => approve(item)}
                    disabled={acting === item.id}
                  >
                    {acting === item.id
                      ? <ActivityIndicator color={Colors.bg} size="small" />
                      : <Text style={s.approveTxt}>Schválit</Text>
                    }
                  </Pressable>
                  <Pressable
                    style={[s.rejectBtn, acting === item.id && { opacity: 0.5 }]}
                    onPress={() => reject(item)}
                    disabled={acting === item.id}
                  >
                    <Text style={s.rejectTxt}>Zamítnout</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:       { width: 40, height: 40, justifyContent: 'center' },
  title:      { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  empty:      { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' },
  tabs:       { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 4 },
  tab:        { flex: 1, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center' },
  tabActive:  { backgroundColor: Colors.pu, borderColor: Colors.pu },
  tabTxt:     { fontSize: 11, color: Colors.mu, fontWeight: '600' },
  tabTxtActive:{ color: Colors.white },
  card:       { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.pu}22`, justifyContent: 'center', alignItems: 'center' },
  name:       { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  email:      { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  levelBadge: { backgroundColor: `${Colors.go}22`, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.go },
  levelTxt:   { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.go },
  actions:    { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn: { flex: 1, backgroundColor: Colors.green, borderRadius: Radius.sm, height: 38, justifyContent: 'center', alignItems: 'center' },
  approveTxt: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },
  rejectBtn:  { flex: 1, borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.sm, height: 38, justifyContent: 'center', alignItems: 'center' },
  rejectTxt:  { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.red },
});
