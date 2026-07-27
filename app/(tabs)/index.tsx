import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { matchesApi, statsApi, notificationsApi, highlightsApi } from '../../services/api';
import { useAuthStore, useIsSupervisor } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

export default function HomeScreen() {
  const { user, isGuest } = useAuthStore();
  const isSupervisor = useIsSupervisor();
  const hasRole = !!(user?.player || user?.referee || user?.manager?.length);

  const [matches,    setMatches]    = useState<any[]>([]);
  const [table,      setTable]      = useState<any[]>([]);
  const [notifs,     setNotifs]     = useState<any[]>([]);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refresh,    setRefresh]    = useState(false);

  async function load() {
    try {
      const calls: Promise<any>[] = [
        matchesApi.list({ limit: '3', status: 'UPCOMING' }),
        statsApi.table(),
        highlightsApi.list(),
      ];
      if (!isGuest && user) calls.push(notificationsApi.list());

      const [mRes, tRes, hRes, nRes] = await Promise.all(calls);
      setMatches(mRes.data ?? []);
      setTable((tRes.data ?? []).slice(0, 5));
      setHighlights(hRes.data ?? []);
      if (nRes) setNotifs((nRes.data ?? []).filter((n: any) => !n.read).slice(0, 3));
    } catch {}
    setLoading(false);
    setRefresh(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
  );

  const unread = notifs.length;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(); }} tintColor={Colors.go} />}
      >
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>
              Ahoj, {user?.player?.firstName ?? user?.referee?.firstName ?? (isGuest ? 'návštěvníku' : 'hráči')} 👋
            </Text>
            <Text style={s.season}>Sezona 2025/26</Text>
          </View>
          <Pressable onPress={() => router.push('/notifications')} style={s.bell}>
            <Ionicons name="notifications" size={22} color={unread > 0 ? Colors.go : Colors.mu} />
            {unread > 0 && (
              <View style={s.badge}><Text style={s.badgeText}>{unread}</Text></View>
            )}
          </Pressable>
        </View>

        {/* Onboarding banner */}
        {!isGuest && !hasRole && (
          <Pressable style={s.onboardBanner} onPress={() => router.push('/onboarding')}>
            <Ionicons name="person-add" size={20} color={Colors.bg} />
            <View style={{ flex: 1 }}>
              <Text style={s.onboardTitle}>Dokonči registraci</Text>
              <Text style={s.onboardDesc}>Připoj se k týmu nebo se zaregistruj jako rozhodčí</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.bg} />
          </Pressable>
        )}

        {/* Referee pending banner */}
        {!isGuest && user?.referee?.status === 'PENDING' && (
          <View style={s.infoBanner}>
            <Ionicons name="time-outline" size={18} color="#F59E0B" />
            <Text style={s.infoBannerTxt}>Registrace rozhodčího čeká na schválení supervisorem</Text>
          </View>
        )}

        {/* ── HIGHLIGHTS KOLA ── */}
        {highlights.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Highlight kola</Text>
              {isSupervisor && (
                <Pressable onPress={() => router.push('/supervisor/highlights' as any)}>
                  <Text style={s.seeAll}>Spravovat →</Text>
                </Pressable>
              )}
            </View>
            {highlights.slice(0, 3).map((h: any) => (
              <View key={h.id} style={[s.highlightCard, h.pinned && s.highlightPinned]}>
                <View style={s.highlightHeader}>
                  {h.pinned && (
                    <View style={s.pinnedBadge}>
                      <Ionicons name="pin" size={10} color={Colors.bg} />
                      <Text style={s.pinnedTxt}>Připnuto</Text>
                    </View>
                  )}
                  {h.round && <Text style={s.highlightRound}>Kolo {h.round}</Text>}
                </View>
                <Text style={s.highlightTitle}>{h.title}</Text>
                <Text style={s.highlightBody} numberOfLines={3}>{h.body}</Text>
              </View>
            ))}
          </>
        )}

        {/* Supervisor – tlačítko přidat highlight, když žádné nejsou */}
        {highlights.length === 0 && isSupervisor && (
          <Pressable style={s.addHighlightBtn} onPress={() => router.push('/supervisor/highlights' as any)}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.go} />
            <Text style={s.addHighlightTxt}>Přidat highlight kola</Text>
          </Pressable>
        )}

        {/* ── NEJBLIŽŠÍ ZÁPASY ── */}
        <Text style={s.sectionTitle}>Nejbližší zápasy</Text>
        {matches.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color={Colors.di} />
            <Text style={s.emptyCardTitle}>Žádné nadcházející zápasy</Text>
          </View>
        ) : matches.map((m: any) => (
          <Pressable key={m.id} style={s.matchCard} onPress={() => router.push(`/match/${m.id}`)}>
            <Text style={s.matchDate}>{format(new Date(m.date), 'EEE d. M. · HH:mm', { locale: cs })}</Text>
            <View style={s.matchTeams}>
              <Text style={s.teamName}>{m.homeTeam?.abbr}</Text>
              <Text style={s.vs}>vs</Text>
              <Text style={s.teamName}>{m.awayTeam?.abbr}</Text>
            </View>
            {m.venue && <Text style={s.venue}>{m.venue}</Text>}
          </Pressable>
        ))}

        {/* ── TABULKA TOP 5 ── */}
        {table.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Tabulka</Text>
              <Pressable onPress={() => router.push('/(tabs)/table' as any)}>
                <Text style={s.seeAll}>Celá tabulka →</Text>
              </Pressable>
            </View>
            <View style={s.tableCard}>
              {table.map((row: any, idx: number) => (
                <View key={row.teamId} style={[s.tableRow, idx < table.length - 1 && s.tableRowBorder]}>
                  <Text style={[s.tablePos, idx < 3 && { color: Colors.go, fontWeight: '700' }]}>{idx + 1}</Text>
                  <View style={[s.teamDot, { backgroundColor: row.team?.color ?? Colors.go }]} />
                  <Text style={s.tableName}>{row.team?.name ?? '—'}</Text>
                  <Text style={s.tablePts}>{row.pts} b</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1, paddingHorizontal: 16 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  // Header
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  greeting:{ fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh },
  season:  { fontSize: Fonts.sizes.sm, color: Colors.mu, marginTop: 2 },
  bell:    { position: 'relative', padding: 4 },
  badge:   { position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.red, justifyContent: 'center', alignItems: 'center' },
  badgeText: { fontSize: 9, fontWeight: '700', color: Colors.white },

  // Banners
  onboardBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.go, borderRadius: Radius.md, padding: 14, marginBottom: 8 },
  onboardTitle:  { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },
  onboardDesc:   { fontSize: Fonts.sizes.xs, color: `${Colors.bg}99` },
  infoBanner:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F59E0B22', borderRadius: Radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F59E0B44' },
  infoBannerTxt: { flex: 1, fontSize: Fonts.sizes.xs, color: '#F59E0B', fontWeight: '600' },

  // Section
  sectionTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginTop: 16, marginBottom: 10 },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  seeAll:       { fontSize: Fonts.sizes.sm, color: Colors.go },

  // Highlights
  highlightCard: {
    backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd,
    padding: 14, marginBottom: 8,
  },
  highlightPinned: { borderColor: Colors.go, borderWidth: 1.5 },
  highlightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  pinnedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.go, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  pinnedTxt:       { fontSize: 10, fontWeight: '700', color: Colors.bg },
  highlightRound:  { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },
  highlightTitle:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, marginBottom: 4 },
  highlightBody:   { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 19 },
  addHighlightBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, borderStyle: 'dashed', padding: 14, marginBottom: 4, marginTop: 16 },
  addHighlightTxt: { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '600' },

  // Zápasy
  matchCard:  { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, marginBottom: 8 },
  matchDate:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginBottom: 6 },
  matchTeams: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  teamName:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, flex: 1 },
  vs:         { fontSize: Fonts.sizes.sm, color: Colors.mu },
  venue:      { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 4 },

  emptyCard:      { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 20, alignItems: 'center', gap: 6, marginBottom: 8 },
  emptyCardTitle: { fontSize: Fonts.sizes.sm, color: Colors.mu },

  // Tabulka
  tableCard:      { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden', marginBottom: 8 },
  tableRow:       { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  tableRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.bd },
  tablePos:       { width: 20, fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  teamDot:        { width: 8, height: 8, borderRadius: 4 },
  tableName:      { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  tablePts:       { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '700' },
});
