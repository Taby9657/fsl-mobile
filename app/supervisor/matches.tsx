import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi, refereesApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function SuperMatchesScreen() {
  const [matches, setMatches]   = useState<any[]>([]);
  const [refs, setRefs]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [assignMatch, setAssign] = useState<any>(null);  // modal target
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    Promise.all([
      supervisorApi.matches({ status: 'UPCOMING' }),
      refereesApi.list({ status: 'APPROVED' }),
    ])
      .then(([mRes, rRes]) => {
        setMatches(mRes.data);
        setRefs(rRes.data);
      })
      .catch(() => Alert.alert('Chyba', 'Nepodařilo se načíst data'))
      .finally(() => setLoading(false));
  }, []);

  async function assign(refereeId: string) {
    if (!assignMatch) return;
    setAssigning(true);
    try {
      const res = await supervisorApi.assignReferee(assignMatch.id, refereeId);
      setMatches(prev => prev.map(m => m.id === assignMatch.id ? { ...m, referee: res.data.referee } : m));
      setAssign(null);
      Alert.alert('Hotovo', 'Rozhodčí přiřazen');
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se přiřadit');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Správa zápasů</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.empty}>Žádné nadcházející zápasy</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.teams}>{item.homeTeam?.name} vs {item.awayTeam?.name}</Text>
                  <Text style={s.meta}>{fmt(item.date)}{item.venue ? ` · ${item.venue}` : ''}</Text>
                </View>
              </View>

              {/* Rozhodčí */}
              {item.referee ? (
                <View style={s.refRow}>
                  <Ionicons name="person-circle-outline" size={16} color={Colors.green} />
                  <Text style={s.refName}>{item.referee.firstName} {item.referee.lastName} (úr. {item.referee.level})</Text>
                  <Pressable onPress={() => setAssign(item)} style={s.changeBtn}>
                    <Text style={s.changeTxt}>Změnit</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={s.assignBtn} onPress={() => setAssign(item)}>
                  <Ionicons name="person-add-outline" size={16} color={Colors.pu} />
                  <Text style={s.assignTxt}>Přiřadit rozhodčího</Text>
                </Pressable>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* Modal pro výběr rozhodčího */}
      <Modal visible={!!assignMatch} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Vyber rozhodčího</Text>
              <Pressable onPress={() => setAssign(null)}>
                <Ionicons name="close" size={22} color={Colors.mu} />
              </Pressable>
            </View>
            <Text style={s.modalSub}>
              {assignMatch?.homeTeam?.abbr} vs {assignMatch?.awayTeam?.abbr}
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {refs.map(r => (
                <Pressable key={r.id} style={s.refOption} onPress={() => assign(r.id)} disabled={assigning}>
                  <View style={s.refAv}>
                    <Ionicons name="person" size={16} color={Colors.pu} />
                  </View>
                  <Text style={s.refOptName}>{r.firstName} {r.lastName}</Text>
                  <Text style={s.refLvl}>{r.level}</Text>
                  {assigning && <ActivityIndicator size="small" color={Colors.go} />}
                </Pressable>
              ))}
              {refs.length === 0 && (
                <Text style={[s.empty, { padding: 16 }]}>Žádní schválení rozhodčí</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:         { width: 40, height: 40, justifyContent: 'center' },
  title:        { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty:        { fontSize: Fonts.sizes.sm, color: Colors.mu },
  card:         { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14 },
  cardTop:      { flexDirection: 'row', alignItems: 'flex-start' },
  teams:        { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  meta:         { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 3 },
  refRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: `${Colors.green}11`, borderRadius: Radius.sm, padding: 8 },
  refName:      { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh },
  changeBtn:    { backgroundColor: Colors.c2, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  changeTxt:    { fontSize: Fonts.sizes.xs, color: Colors.go, fontWeight: '600' },
  assignBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, borderWidth: 1, borderColor: Colors.pu, borderRadius: Radius.sm, padding: 10, borderStyle: 'dashed' },
  assignTxt:    { fontSize: Fonts.sizes.sm, color: Colors.pu, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal:        { backgroundColor: Colors.c1, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: 20 },
  modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  modalSub:     { fontSize: Fonts.sizes.sm, color: Colors.mu, marginBottom: 16 },
  refOption:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  refAv:        { width: 32, height: 32, borderRadius: 16, backgroundColor: `${Colors.pu}22`, justifyContent: 'center', alignItems: 'center' },
  refOptName:   { flex: 1, fontSize: Fonts.sizes.md, color: Colors.wh, fontWeight: '500' },
  refLvl:       { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '600' },
});
