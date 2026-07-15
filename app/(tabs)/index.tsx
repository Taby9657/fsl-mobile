import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { matchesApi, statsApi, notificationsApi } from '../../services/api';
import { useAuthStore, useIsManager, useIsReferee, useIsSupervisor } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

export default function HomeScreen() {
  const { user, isGuest } = useAuthStore();
  const isManager    = useIsManager();
  const isReferee    = useIsReferee();
  const isSupervisor = useIsSupervisor();
  const hasRole      = isManager || isReferee || isSupervisor || !!user?.player;
  const [matches, setMatches]   = useState<any[]>([]);
  const [table, setTable]       = useState<any[]>([]);
  const [notifs, setNotifs]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refresh, setRefresh]   = useState(false);

  async function load() {
    try {
      const calls: Promise<any>[] = [
        matchesApi.list({ limit: '3', status: 'UPCOMING' }),
        statsApi.table(),
      ];
      if (!isGuest && user) calls.push(notificationsApi.list());

      const [mRes, tRes, nRes] = await Promise.all(calls);
      setMatches(mRes.data ?? []);
      setTable((tRes.data ?? []).slice(0, 5));
      if (nRes) setNotifs((nRes.data ?? []).filter((n: any) => !n.read).slice(0, 3));
    } catch {}
    setLoading(false);
    setRefresh(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={Colors.go} size="large" /></View>
  );

  const unread = notifs.length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={Colors.go} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Ahoj, {user?.player?.firstName ?? user?.referee?.firstName ?? (isGuest ? 'návštěvníku' : 'hráči')} 👋</Text>
            <Text style={styles.season}>Sezona 2025/26</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={styles.bell}>
            <Ionicons name="notifications" size={22} color={unread > 0 ? Colors.go : Colors.mu} />
            {unread > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View>
            )}
          </Pressable>
        </View>

        {/* Banner pro nové uživatele bez role */}
        {!isGuest && !hasRole && (
          <Pressable style={styles.onboardBanner} onPress={() => router.push('/onboarding')}>
            <Ionicons name="person-add" size={20} color={Colors.bg} />
            <View style={{ flex: 1 }}>
              <Text style={styles.onboardTitle}>Dokonči registraci</Text>
              <Text style={styles.onboardDesc}>Připoj se k týmu nebo se zaregistruj jako rozhodčí</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.bg} />
          </Pressable>
        )}

        {/* Role banner */}
        {!isGuest && isReferee && user?.referee?.status === 'PENDING' && (
          <View style={styles.infoBanner}>
            <Ionicons name="time-outline" size={18} color="#F59E0B" />
            <Text style={styles.infoBannerTxt}>Registrace rozhodčího čeká na schválení supervisorem</Text>
          </View>
        )}

        {/* Nejbližší zápasy */}
        <Text style={styles.sectionTitle}>Nejbližší zápasy</Text>
        {matches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={32} color={Colors.di} />
            <Text style={styles.emptyCardTitle}>Žádné nadcházející zápasy</Text>
            <Text style={styles.emptyCardDesc}>Zápasy se zobrazí jakmile supervisor přidá rozpis</Text>
          </View>
        ) : matches.map((m: any) => (
          <Pressable key={m.id} style={styles.matchCard} onPress={() => router.push(`/match/${m.id}`)}>
            <Text style={styles.matchDate}>{format(new Date(m.date), 'EEE d. M. · HH:mm', { locale: cs })}</Text>
            <View style={styles.matchTeams}>
              <Text style={styles.teamName}>{m.homeTeam.abbr}</Text>
              <Text style={styles.vs}>vs</Text>
              <Text style={styles.teamName}>{m.awayTeam.abbr}</Text>
            </View>
            {m.venue && <Text style={styles.venue}>{m.venue}</Text>}
          </Pressable>
        ))}

        {/* Tabulka – top 5 */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Tabulka</Text>
          <Pressable onPress={() => router.push('/(tabs)/table')}>
            <Text style={styles.seeAll}>Celá tabulka →</Text>
          </Pressable>
        </View>
        <View style={styles.tableCard}>
          {table.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="trophy-outline" size={32} color={Colors.di} />
            <Text style={styles.emptyCardTitle}>Tabulka zatím prázdná</Text>
            <Text style={styles.emptyCardDesc}>Zobrazí se po odehrání prvních zápasů</Text>
          </View>
        ) : null}
        {table.map((row: any, idx: number) => (
            <View key={row.teamId} style={[styles.tableRow, idx < table.length - 1 && styles.tableRowBorder]}>
              <Text style={styles.tablePos}>{idx + 1}</Text>
              <View style={[styles.teamDot, { backgroundColor: row.team?.color ?? Colors.go }]} />
              <Text style={styles.tableName}>{row.team?.name ?? '—'}</Text>
              <Text style={styles.tablePts}>{row.pts} b</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1, paddingHorizontal: 16 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  greeting:{ fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh },
  season:  { fontSize: Fonts.sizes.sm, color: Colors.mu, marginTop: 2 },
  bell:    { position: 'relative', padding: 4 },
  badge:   {
    position: 'absolute', top: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.red, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: Colors.white },
  sectionTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginTop: 16, marginBottom: 10 },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  seeAll:       { fontSize: Fonts.sizes.sm, color: Colors.go },
  empty:        { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', paddingVertical: 16 },
  emptyCard:    { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 24, alignItems: 'center', gap: 8, marginBottom: 8 },
  emptyCardTitle:{ fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.mu },
  emptyCardDesc: { fontSize: Fonts.sizes.xs, color: Colors.di, textAlign: 'center' },
  onboardBanner:{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.go, borderRadius: Radius.md, padding: 14, marginBottom: 8 },
  onboardTitle: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },
  onboardDesc:  { fontSize: Fonts.sizes.xs, color: `${Colors.bg}99` },
  infoBanner:   { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F59E0B22', borderRadius: Radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F59E0B44' },
  infoBannerTxt:{ flex: 1, fontSize: Fonts.sizes.xs, color: '#F59E0B', fontWeight: '600' },
  matchCard: {
    backgroundColor: Colors.c1, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.bd,
    padding: 14, marginBottom: 8,
  },
  matchDate:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginBottom: 6 },
  matchTeams: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamName:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, flex: 1 },
  vs:         { fontSize: Fonts.sizes.sm, color: Colors.mu },
  venue:      { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 4 },
  tableCard: {
    backgroundColor: Colors.c1, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden',
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.bd },
  tablePos:  { width: 20, fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  teamDot:   { width: 8, height: 8, borderRadius: 4 },
  tableName: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  tablePts:  { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '700' },
});
