import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface Stats {
  pendingReferees: number;
  pendingRequests: number;
  upcomingMatches: number;
  totalTeams: number;
  totalPlayers: number;
  unpaidLicenses: number;
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

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats]     = useState<Stats | null>(null);

  useEffect(() => {
    supervisorApi.dashboard()
      .then(r => setStats(r.data))
      .catch(() => Alert.alert('Chyba', 'Nepodařilo se načíst statistiky'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={s.section}>Celkový přehled</Text>
          <View style={s.grid}>
            <StatCard icon="people" label="Celkem hráčů"  value={stats?.totalPlayers ?? 0} />
            <StatCard icon="shield" label="Celkem týmů"   value={stats?.totalTeams ?? 0} />
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
            color={stats?.pendingReferees ? '#F59E0B' : Colors.green}
            route="/supervisor/referees"
          />
          <View style={{ height: 10 }} />
          <StatCard
            icon="document-text"
            label="Otevřené žádosti"
            value={stats?.pendingRequests ?? 0}
            color={stats?.pendingRequests ? '#F59E0B' : Colors.green}
          />

          <Text style={[s.section, { marginTop: 20 }]}>Správa ligy</Text>
          <View style={s.actions}>
            {[
              { icon: 'shield',        label: 'Správa týmů',        route: '/supervisor/teams',   color: Colors.go },
              { icon: 'calendar',      label: 'Rozlosování',         route: '/supervisor/league',  color: Colors.go },
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
            ].map(a => (
              <Pressable key={a.route} style={s.actionBtn} onPress={() => router.push(a.route as any)}>
                <Ionicons name={a.icon as any} size={20} color={Colors.pu} />
                <Text style={s.actionTxt}>{a.label}</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.di} />
              </Pressable>
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:       { width: 40, height: 40, justifyContent: 'center' },
  title:      { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section:    { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  grid:       { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard:   { flex: 1, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, borderLeftWidth: 4, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statIcon:   { width: 36, height: 36, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' },
  statVal:    { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh },
  statLabel:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  actions:    { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  actionBtn:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  actionTxt:  { flex: 1, fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
});
