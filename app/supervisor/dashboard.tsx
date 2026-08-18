import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi, statsApi, api } from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { ErrorView } from '../../components/ErrorView';
import { SkeletonBlock } from '../../components/SkeletonCard';

interface Stats {
  pendingReferees: number;
  pendingRequests: number;
  upcomingMatches: number;
  totalTeams: number;
  totalPlayers: number;
  unpaidLicenses: number;
  pendingTeams: number;
  appealingTeams: number;
}

function StatCard({ icon, label, value, color, route }: { icon: any; label: string; value: number; color?: string; route?: string }) {
  const c = color ?? Colors.go;
  return (
    <Pressable style={[s.statCard, { borderLeftColor: c }]} onPress={route ? () => router.push(route as any) : undefined}>
      <View style={[s.statIcon, { backgroundColor: `${c}22` }]}>
        <Ionicons name={icon} size={20} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.statVal}>{value}</Text>
        <Text style={s.statLabel}>{label}</Text>
      </View>
      {route && <Ionicons name="chevron-forward" size={14} color={Colors.di} />}
    </Pressable>
  );
}

function SkeletonStatCard() {
  return (
    <View style={[s.statCard, { borderLeftColor: Colors.bd }]}>
      <SkeletonBlock width={36} height={36} style={{ borderRadius: 8 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBlock width="40%" height={20} />
        <SkeletonBlock width="70%" height={11} />
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const [loading, setLoading]   = useState(true);
  const [refresh, setRefresh]   = useState(false);
  const [error, setError]       = useState(false);
  const [stats, setStats]       = useState<Stats | null>(null);

  async function load(isRefresh = false) {
    if (!isRefresh) { setLoading(true); setError(false); }
    try {
      const r = await supervisorApi.dashboard();
      setStats(r.data);
    } catch {
      if (!isRefresh) setError(true);
      else Alert.alert('Chyba', 'Nepodařilo se obnovit statistiky');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }

  useEffect(() => { load(); }, []);

  const hasPending = (stats?.pendingReferees ?? 0) > 0 || (stats?.pendingRequests ?? 0) > 0
    || (stats?.pendingTeams ?? 0) > 0 || (stats?.appealingTeams ?? 0) > 0;

  // BUG-11 OPRAVA: CSV export s JWT autorizací + sdílení obsahu přes Share API
  async function exportCSV(type: 'players' | 'referees') {
    try {
      // Axios interceptor přidá token automaticky — použijeme api instanci místo Linking.openURL
      const response = await api.get('/stats/export', {
        params: { type },
        // Axios vrátí text/csv jako string
        responseType: 'text',
        headers: { Accept: 'text/csv' },
      });
      const csvText: string = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const label = type === 'players' ? 'Hráči' : 'Rozhodčí';
      // Sdílej obsah CSV přes nativní Share dialog (funguje bez expo-file-system)
      await Share.share({
        message: csvText,
        title: `FSL ${label} export CSV`,
      });
    } catch (e: any) {
      Alert.alert('Chyba exportu', e?.response?.data?.error ?? e?.message ?? 'Nepodařilo se exportovat data');
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Dashboard</Text>
        <Pressable style={s.refreshBtn} onPress={() => { setRefresh(true); load(true); }}>
          <Ionicons name="refresh" size={20} color={Colors.mu} />
        </Pressable>
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          <View style={s.grid}>
            <SkeletonStatCard /><SkeletonStatCard />
          </View>
          <View style={s.grid}>
            <SkeletonStatCard /><SkeletonStatCard />
          </View>
          <SkeletonBlock height={14} width="50%" style={{ marginTop: 10, marginBottom: 6 }} />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonBlock height={14} width="40%" style={{ marginTop: 10, marginBottom: 6 }} />
          {[1, 2].map(i => <SkeletonBlock key={i} height={48} width="100%" style={{ borderRadius: 10 }} />)}
        </ScrollView>
      ) : error ? (
        <ErrorView onRetry={() => load()} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(true); }} tintColor={Colors.go} />}
        >
          {/* Alert banner pokud čeká akce */}
          {hasPending && (
            <Pressable style={s.alertBanner} onPress={() => router.push('/supervisor/referees' as any)}>
              <Ionicons name="warning" size={16} color='#F59E0B' />
              <Text style={s.alertTxt}>
                {[
                  (stats?.pendingReferees  ?? 0) > 0 && `${stats!.pendingReferees} rozhodčích čeká`,
                  (stats?.pendingRequests  ?? 0) > 0 && `${stats!.pendingRequests} žádostí`,
                  (stats?.pendingTeams     ?? 0) > 0 && `${stats!.pendingTeams} týmů čeká na schválení`,
                  (stats?.appealingTeams   ?? 0) > 0 && `${stats!.appealingTeams} odvolání`,
                ].filter(Boolean).join('  ·  ')}
              </Text>
              <Ionicons name="chevron-forward" size={14} color='#F59E0B' />
            </Pressable>
          )}

          <Text style={s.section}>Celkový přehled</Text>
          <View style={s.grid}>
            <StatCard icon="people"   label="Celkem hráčů"  value={stats?.totalPlayers ?? 0} />
            <StatCard icon="shield"   label="Celkem týmů"   value={stats?.totalTeams ?? 0} />
          </View>
          <View style={s.grid}>
            <StatCard icon="football" label="Nadch. zápasů" value={stats?.upcomingMatches ?? 0} color={Colors.pu} />
            <StatCard icon="card"     label="Bez licence"   value={stats?.unpaidLicenses ?? 0} color={Colors.red} route="/supervisor/payments" />
          </View>

          <Text style={[s.section, { marginTop: 20 }]}>Vyžaduje akci</Text>
          <StatCard
            icon="person-add"
            label="Rozhodčí čekají na schválení"
            value={stats?.pendingReferees ?? 0}
            color={(stats?.pendingReferees ?? 0) > 0 ? '#F59E0B' : Colors.green}
            route="/supervisor/referees"
          />
          <View style={{ height: 10 }} />
          <StatCard
            icon="document-text"
            label="Otevřené žádosti"
            value={stats?.pendingRequests ?? 0}
            color={(stats?.pendingRequests ?? 0) > 0 ? '#F59E0B' : Colors.green}
            route="/supervisor/requests"
          />
          <View style={{ height: 10 }} />
          <StatCard
            icon="shield-outline"
            label="Týmy čekají na registraci"
            value={stats?.pendingTeams ?? 0}
            color={(stats?.pendingTeams ?? 0) > 0 ? '#F59E0B' : Colors.go}
            route="/supervisor/teams"
          />
          {(stats?.appealingTeams ?? 0) > 0 && (
            <>
              <View style={{ height: 10 }} />
              <StatCard
                icon="chatbubble-ellipses-outline"
                label="Odvolání registrací"
                value={stats.appealingTeams}
                color={Colors.red}
                route="/supervisor/teams"
              />
            </>
          )}

          <Text style={[s.section, { marginTop: 20 }]}>Správa ligy</Text>
          <View style={s.actions}>
            {[
              { icon: 'shield',   label: 'Správa týmů',  route: '/supervisor/teams',  color: Colors.go },
              { icon: 'calendar', label: 'Rozlosování',  route: '/supervisor/league', color: Colors.go },
            ].map(a => (
              <Pressable key={a.route} style={s.actionBtn} onPress={() => router.push(a.route as any)}>
                <Ionicons name={a.icon as any} size={20} color={a.color} />
                <Text style={s.actionTxt}>{a.label}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.di} />
              </Pressable>
            ))}
          </View>

          <Text style={[s.section, { marginTop: 20 }]}>Rychlé akce</Text>
          <View style={s.actions}>
            {[
              { icon: 'person-add', label: 'Schvalovací fronta', route: '/supervisor/referees' },
              { icon: 'football',   label: 'Správa zápasů',      route: '/supervisor/matches' },
              { icon: 'cash',       label: 'Přehled plateb',     route: '/supervisor/payments' },
              { icon: 'podium',     label: 'Play-off pavouk',    route: '/bracket' },
            ].map(a => (
              <Pressable key={a.route} style={s.actionBtn} onPress={() => router.push(a.route as any)}>
                <Ionicons name={a.icon as any} size={20} color={Colors.pu} />
                <Text style={s.actionTxt}>{a.label}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.di} />
              </Pressable>
            ))}
          </View>

          <Text style={[s.section, { marginTop: 20 }]}>Export dat</Text>
          <View style={s.exportRow}>
            <Pressable style={s.exportBtn} onPress={() => exportCSV('players')}>
              <Ionicons name="people-outline" size={18} color={Colors.go} />
              <Text style={s.exportTxt}>Hráči CSV</Text>
            </Pressable>
            <Pressable style={s.exportBtn} onPress={() => exportCSV('referees')}>
              <Ionicons name="shield-outline" size={18} color={Colors.go} />
              <Text style={s.exportTxt}>Rozhodčí CSV</Text>
            </Pressable>
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:        { width: 40, height: 40, justifyContent: 'center' },
  refreshBtn:  { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
  title:       { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, flex: 1 },
  section:     { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  grid:        { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard:    { flex: 1, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, borderLeftWidth: 4, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIcon:    { width: 36, height: 36, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' },
  statVal:     { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh },
  statLabel:   { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  actions:     { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  actionTxt:   { flex: 1, fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F59E0B18', borderWidth: 1, borderColor: '#F59E0B44', borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  alertTxt:    { flex: 1, fontSize: Fonts.sizes.sm, color: '#F59E0B', fontWeight: '600' },
  exportRow:   { flexDirection: 'row', gap: 10 },
  exportBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14 },
  exportTxt:   { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.go },
});
