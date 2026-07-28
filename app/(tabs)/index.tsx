import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { matchesApi, statsApi, notificationsApi, highlightsApi } from '../../services/api';
import { useAuthStore, useIsSupervisor } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { LiveBadge } from '../../components/LiveBadge';
import { SkeletonMatchCard, SkeletonTableRow, SkeletonHighlightCard } from '../../components/SkeletonCard';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

function VideoHighlightCard({ videoUrl, pinned }: { videoUrl: string; pinned: boolean }) {
  return (
    <Pressable
      style={[s.videoCard, pinned && s.highlightPinned]}
      onPress={() => Linking.openURL(videoUrl)}
    >
      <View style={s.playOverlay}>
        <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.92)" />
        <Text style={s.videoHint}>Klepni pro přehrání</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { user, isGuest } = useAuthStore();
  const isSupervisor = useIsSupervisor();
  const hasRole = !!(user?.player || user?.referee || user?.manager?.length);

  const [matches,      setMatches]      = useState<any[]>([]);
  const [liveMatches,  setLiveMatches]  = useState<any[]>([]);
  const [table,        setTable]        = useState<any[]>([]);
  const [notifs,       setNotifs]       = useState<any[]>([]);
  const [highlights,   setHighlights]   = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refresh,      setRefresh]      = useState(false);
  const [currentSeason, setCurrentSeason] = useState<string>('2025/26');
  const livePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadLive() {
    try {
      const r = await matchesApi.list({ status: 'LIVE' });
      setLiveMatches(r.data ?? []);
    } catch {}
  }

  async function load() {
    const [mRes, lRes, tRes, hRes, nRes, sRes] = await Promise.allSettled([
      matchesApi.list({ limit: '3', status: 'UPCOMING' }),
      matchesApi.list({ status: 'LIVE' }),
      statsApi.table(),
      highlightsApi.list(),
      (!isGuest && user) ? notificationsApi.list() : Promise.resolve(null),
      statsApi.seasons(),
    ]);
    if (mRes.status === 'fulfilled') setMatches(mRes.value.data ?? []);
    if (lRes.status === 'fulfilled') setLiveMatches(lRes.value.data ?? []);
    if (tRes.status === 'fulfilled') setTable((tRes.value.data ?? []).slice(0, 5));
    if (hRes.status === 'fulfilled') setHighlights(hRes.value.data ?? []);
    if (nRes.status === 'fulfilled' && nRes.value) {
      setNotifs((nRes.value.data ?? []).filter((n: any) => !n.read).slice(0, 3));
    }
    if (sRes.status === 'fulfilled') {
      const ss: string[] = sRes.value.data ?? [];
      if (ss.length > 0) setCurrentSeason(ss[0]);
    }
    setLoading(false);
    setRefresh(false);
  }

  useEffect(() => { load(); }, []);

  // Poll live matches: 10s when there are live matches, 30s when quiet
  const hasLive = liveMatches.length > 0;
  useEffect(() => {
    livePollRef.current = setInterval(loadLive, hasLive ? 10_000 : 30_000);
    return () => {
      if (livePollRef.current) { clearInterval(livePollRef.current); livePollRef.current = null; }
    };
  }, [hasLive]);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll}>
        <View style={{ height: 16 }} />
        <SkeletonHighlightCard />
        <SkeletonHighlightCard />
        <View style={{ height: 8 }} />
        <SkeletonMatchCard />
        <SkeletonMatchCard />
        <SkeletonMatchCard />
      </ScrollView>
    </SafeAreaView>
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
            <Text style={s.season}>Sezona {currentSeason}</Text>
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
            {highlights.slice(0, 3).map((h: any) =>
              h.videoUrl ? (
                <VideoHighlightCard key={h.id} videoUrl={h.videoUrl} pinned={h.pinned} />
              ) : (
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
              )
            )}
          </>
        )}

        {/* Supervisor – tlačítko přidat highlight, když žádné nejsou */}
        {highlights.length === 0 && isSupervisor && (
          <Pressable style={s.addHighlightBtn} onPress={() => router.push('/supervisor/highlights' as any)}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.go} />
            <Text style={s.addHighlightTxt}>Přidat highlight kola</Text>
          </Pressable>
        )}

        {/* ── LIVE ZÁPASY ── */}
        {liveMatches.length > 0 && (
          <>
            <View style={s.sectionRow}>
              <LiveBadge size="md" />
              <Pressable onPress={() => router.push('/(tabs)/matches' as any)}>
                <Text style={s.seeAll}>Zápasy →</Text>
              </Pressable>
            </View>
            {liveMatches.map((m: any) => (
              <Pressable key={m.id} style={s.liveMatchCard} onPress={() => router.push(`/match/${m.id}`)}>
                <View style={s.liveMatchTeams}>
                  <Text style={s.liveTeamName}>{m.homeTeam?.name ?? m.homeTeam?.abbr}</Text>
                  <Text style={s.liveScoreText}>{m.homeScore ?? 0}:{m.awayScore ?? 0}</Text>
                  <Text style={[s.liveTeamName, { textAlign: 'right' }]}>{m.awayTeam?.name ?? m.awayTeam?.abbr}</Text>
                </View>
                {m.venue && <Text style={s.venue}>{m.venue}</Text>}
              </Pressable>
            ))}
          </>
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
  // Video highlight
  videoCard:   { borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden', marginBottom: 8, height: 200, backgroundColor: '#1a0a2e', justifyContent: 'center', alignItems: 'center' },
  playOverlay: { justifyContent: 'center', alignItems: 'center', gap: 8 },
  videoHint:   { fontSize: Fonts.sizes.xs, color: 'rgba(255,255,255,0.55)' },

  addHighlightBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, borderStyle: 'dashed', padding: 14, marginBottom: 4, marginTop: 16 },
  addHighlightTxt: { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '600' },

  // Live zápasy
  liveMatchCard:  { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1.5, borderColor: `${Colors.red}55`, padding: 14, marginBottom: 8 },
  liveMatchTeams: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveTeamName:   { flex: 1, fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  liveScoreText:  { fontSize: Fonts.sizes.xxl, fontWeight: '900', color: Colors.go, minWidth: 64, textAlign: 'center' },

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
