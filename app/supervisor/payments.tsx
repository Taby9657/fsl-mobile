import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

type Tab = 'players' | 'teams';
type PayStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXEMPT';

const S_COLOR: Record<PayStatus, string> = {
  PAID: Colors.green, PENDING: '#F59E0B', FAILED: Colors.red, EXEMPT: Colors.mu,
};
const S_LABEL: Record<PayStatus, string> = {
  PAID: 'Zaplaceno', PENDING: 'Čeká', FAILED: 'Selhalo', EXEMPT: 'Osvobozeno',
};

function StatusBadge({ status }: { status: PayStatus }) {
  const c = S_COLOR[status];
  return (
    <View style={{ backgroundColor: `${c}22`, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: c }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: c }}>{S_LABEL[status]}</Text>
    </View>
  );
}

export default function SuperPaymentsScreen() {
  const [tab, setTab]         = useState<Tab>('players');
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams]     = useState<any[]>([]);
  const [acting, setActing]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    supervisorApi.payments()
      .then(r => { setPlayers(r.data.players); setTeams(r.data.teams); })
      .catch(() => Alert.alert('Chyba', 'Nepodařilo se načíst platby'))
      .finally(() => setLoading(false));
  }, []);

  async function markPaid(playerId: string, type: 'lic' | 'super') {
    setActing(playerId + type);
    try {
      await supervisorApi.updatePayment(playerId, type === 'lic' ? { licStatus: 'PAID' } : { superStatus: 'PAID' });
      setPlayers(prev => prev.map(p =>
        p.player.id === playerId
          ? { ...p, licStatus: type === 'lic' ? 'PAID' : p.licStatus, superStatus: type === 'super' ? 'PAID' : p.superStatus }
          : p
      ));
      Alert.alert('Hotovo', 'Platba označena jako zaplacená');
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se aktualizovat');
    } finally {
      setActing(null);
    }
  }

  const pendingPlayers = players.filter(p => p.licStatus !== 'PAID');
  const paidPlayers    = players.filter(p => p.licStatus === 'PAID');
  const pendingTeams   = teams.filter(t => t.status !== 'PAID');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Platby</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Souhrn */}
      <View style={s.summary}>
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: '#F59E0B' }]}>{pendingPlayers.length}</Text>
          <Text style={s.summaryLabel}>Hráčů bez licence</Text>
        </View>
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: Colors.green }]}>{paidPlayers.length}</Text>
          <Text style={s.summaryLabel}>Licencováno</Text>
        </View>
        <View style={s.summaryItem}>
          <Text style={[s.summaryVal, { color: '#F59E0B' }]}>{pendingTeams.length}</Text>
          <Text style={s.summaryLabel}>Týmů čeká</Text>
        </View>
      </View>

      <View style={s.tabs}>
        <Pressable style={[s.tab, tab === 'players' && s.tabActive]} onPress={() => setTab('players')}>
          <Text style={[s.tabTxt, tab === 'players' && s.tabTxtActive]}>Hráči</Text>
        </Pressable>
        <Pressable style={[s.tab, tab === 'teams' && s.tabActive]} onPress={() => setTab('teams')}>
          <Text style={[s.tabTxt, tab === 'teams' && s.tabTxtActive]}>Týmy</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
      ) : tab === 'players' ? (
        <FlatList
          data={players}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<View style={s.center}><Text style={s.empty}>Žádní hráči</Text></View>}
          renderItem={({ item }) => {
            const pid = item.player?.id;
            return (
              <View style={s.card}>
                <View style={s.cardRow}>
                  <Text style={s.playerName}>
                    {item.player?.firstName} {item.player?.lastName}
                    <Text style={s.teamName}> · {item.player?.team?.abbr}</Text>
                  </Text>
                </View>
                <View style={s.licRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.licLabel}>Licence ({item.licFee} Kč)</Text>
                    <StatusBadge status={item.licStatus} />
                  </View>
                  {item.licStatus !== 'PAID' && (
                    <Pressable
                      style={[s.markBtn, acting === pid + 'lic' && { opacity: 0.5 }]}
                      onPress={() => markPaid(pid, 'lic')}
                      disabled={!!acting}
                    >
                      {acting === pid + 'lic'
                        ? <ActivityIndicator color={Colors.bg} size="small" />
                        : <Text style={s.markBtnTxt}>Označit zaplaceno</Text>
                      }
                    </Pressable>
                  )}
                </View>
                {item.superStatus !== 'EXEMPT' && (
                  <View style={[s.licRow, { marginTop: 8 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.licLabel}>Super licence ({item.superFee} Kč)</Text>
                      <StatusBadge status={item.superStatus} />
                    </View>
                    {item.superStatus !== 'PAID' && (
                      <Pressable
                        style={[s.markBtn, acting === pid + 'super' && { opacity: 0.5 }]}
                        onPress={() => markPaid(pid, 'super')}
                        disabled={!!acting}
                      >
                        {acting === pid + 'super'
                          ? <ActivityIndicator color={Colors.bg} size="small" />
                          : <Text style={s.markBtnTxt}>Označit zaplaceno</Text>
                        }
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      ) : (
        <FlatList
          data={teams}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<View style={s.center}><Text style={s.empty}>Žádné týmy</Text></View>}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardRow}>
                <Text style={s.playerName}>{item.team?.name}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={s.licLabel}>Registrační poplatek: {item.amount} Kč</Text>
              {item.variableSymbol && (
                <Text style={s.licLabel}>VS: {item.variableSymbol}</Text>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:        { width: 40, height: 40, justifyContent: 'center' },
  title:       { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty:       { fontSize: Fonts.sizes.sm, color: Colors.mu },
  summary:     { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  summaryItem: { flex: 1, alignItems: 'center', padding: 12 },
  summaryVal:  { fontSize: Fonts.sizes.xl, fontWeight: '700' },
  summaryLabel:{ fontSize: 10, color: Colors.mu, marginTop: 2 },
  tabs:        { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 4 },
  tab:         { flex: 1, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center' },
  tabActive:   { backgroundColor: Colors.go, borderColor: Colors.go },
  tabTxt:      { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  tabTxtActive:{ color: Colors.bg },
  card:        { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14 },
  cardRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  playerName:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  teamName:    { fontWeight: '400', color: Colors.mu },
  licRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  licLabel:    { fontSize: Fonts.sizes.xs, color: Colors.mu, marginBottom: 4 },
  markBtn:     { backgroundColor: Colors.go, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  markBtnTxt:  { fontSize: 11, fontWeight: '700', color: Colors.bg },
});
