import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

type ReqStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';
type Tab = 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';

const TYPE_LABEL: Record<string, string> = {
  MATCH_TRANSCRIPT: 'Zápis ze zápasu',
  PLAYER_DISPUTE:   'Hráčský spor',
  LICENSE_ISSUE:    'Problém s licencí',
  OTHER:            'Ostatní',
};

const STATUS_COLOR: Record<ReqStatus, string> = {
  PENDING:     '#F59E0B',
  IN_PROGRESS: '#3B82F6',
  APPROVED:    Colors.green,
  REJECTED:    Colors.red,
};

const STATUS_LABEL: Record<ReqStatus, string> = {
  PENDING:     'Čeká',
  IN_PROGRESS: 'Řeší se',
  APPROVED:    'Schváleno',
  REJECTED:    'Zamítnuto',
};

function StatusBadge({ status }: { status: ReqStatus }) {
  const c = STATUS_COLOR[status] ?? Colors.mu;
  return (
    <View style={{ backgroundColor: `${c}22`, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: c }}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

function fmt(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()}. ${dt.getMonth() + 1}. ${dt.getFullYear()}`;
}

export default function SuperRequestsScreen() {
  const [tab, setTab]           = useState<Tab>('PENDING');
  const [data, setData]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]     = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const r = await supervisorApi.requests(tab);
      setData(r.data ?? []);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst žádosti');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: string, status: ReqStatus, note?: string) {
    setActing(id);
    try {
      await supervisorApi.updateRequest(id, { status, ...(note ? { note } : {}) });
      setData(prev => prev.filter(r => r.id !== id));
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se změnit stav žádosti');
    } finally {
      setActing(null);
    }
  }

  function confirmAction(id: string, status: ReqStatus) {
    const label = STATUS_LABEL[status];
    Alert.alert(
      `${label}?`,
      `Opravdu chcete žádost označit jako "${label}"?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        { text: label, style: status === 'REJECTED' ? 'destructive' : 'default',
          onPress: () => changeStatus(id, status) },
      ],
    );
  }

  const TABS: Tab[] = ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED'];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Žádosti</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab bar */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{STATUS_LABEL[t]}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
      ) : data.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="checkmark-circle-outline" size={48} color={Colors.mu} />
          <Text style={s.empty}>Žádné žádosti v této kategorii</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.go} />}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.typeLabel}>{TYPE_LABEL[item.type] ?? item.type}</Text>
                <StatusBadge status={item.status} />
              </View>

              {item.user?.email && (
                <Text style={s.meta}>Od: {item.user.email}</Text>
              )}
              <Text style={s.meta}>{fmt(item.createdAt)}</Text>

              <Text style={s.body}>{item.body}</Text>

              {item.note ? (
                <View style={s.noteBubble}>
                  <Text style={s.noteTxt}>Poznámka: {item.note}</Text>
                </View>
              ) : null}

              {/* Akce jen pro PENDING / IN_PROGRESS */}
              {(item.status === 'PENDING' || item.status === 'IN_PROGRESS') && (
                <View style={s.actions}>
                  {item.status === 'PENDING' && (
                    <Pressable
                      style={[s.btn, { backgroundColor: '#3B82F622', borderColor: '#3B82F6' }]}
                      disabled={acting === item.id}
                      onPress={() => changeStatus(item.id, 'IN_PROGRESS')}
                    >
                      {acting === item.id
                        ? <ActivityIndicator size={14} color="#3B82F6" />
                        : <Text style={[s.btnTxt, { color: '#3B82F6' }]}>Převzít</Text>}
                    </Pressable>
                  )}
                  <Pressable
                    style={[s.btn, { backgroundColor: `${Colors.green}22`, borderColor: Colors.green }]}
                    disabled={acting === item.id}
                    onPress={() => confirmAction(item.id, 'APPROVED')}
                  >
                    <Text style={[s.btnTxt, { color: Colors.green }]}>Schválit</Text>
                  </Pressable>
                  <Pressable
                    style={[s.btn, { backgroundColor: `${Colors.red}22`, borderColor: Colors.red }]}
                    disabled={acting === item.id}
                    onPress={() => confirmAction(item.id, 'REJECTED')}
                  >
                    <Text style={[s.btnTxt, { color: Colors.red }]}>Zamítnout</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back:        { width: 40, height: 40, justifyContent: 'center' },
  title:       { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  empty:       { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' },

  tabs:        { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  tab:         { flex: 1, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Colors.c1, alignItems: 'center' },
  tabActive:   { backgroundColor: Colors.go },
  tabTxt:      { fontSize: 11, fontWeight: '600', color: Colors.mu },
  tabTxtActive:{ color: Colors.bg },

  card:        { backgroundColor: Colors.c1, borderRadius: Radius.lg, padding: 14, gap: 6 },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeLabel:   { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  meta:        { fontSize: 11, color: Colors.mu },
  body:        { fontSize: Fonts.sizes.sm, color: Colors.wh, marginTop: 4, lineHeight: 20 },
  noteBubble:  { backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 10, marginTop: 4 },
  noteTxt:     { fontSize: 12, color: Colors.mu, fontStyle: 'italic' },

  actions:     { flexDirection: 'row', gap: 8, marginTop: 8 },
  btn:         { flex: 1, paddingVertical: 8, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center' },
  btnTxt:      { fontSize: 13, fontWeight: '700' },
});
