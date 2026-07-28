import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Share, Linking, Alert } from 'react-native';
import { LiveBadge } from '../../components/LiveBadge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { matchesApi, refereesApi } from '../../services/api';
import { useAuthStore, useIsSupervisor } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';

type Tab = 'events' | 'lineups' | 'info';

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: 'Nadcházející', LIVE: 'LIVE', DONE: 'Odehráno', CANCELLED: 'Zrušeno',
};
const STATUS_COLOR: Record<string, string> = {
  UPCOMING: Colors.mu, LIVE: Colors.red, DONE: Colors.green, CANCELLED: Colors.di,
};

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}  ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function MatchDetailScreen() {
  const { id }       = useLocalSearchParams<{ id: string }>();
  const isSupervisor = useIsSupervisor();
  const { user }     = useAuthStore();
  const [loading, setLoading]         = useState(true);
  const [match, setMatch]             = useState<any>(null);
  const [tab, setTab]                 = useState<Tab>('events');
  const [starRating, setStarRating]   = useState(0);
  const [ratingDone, setRatingDone]   = useState(false);
  const [ratingBusy, setRatingBusy]   = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchMatch(isBackground = false) {
    if (!id) return;
    try {
      const r = await matchesApi.get(id);
      setMatch(r.data);
      // Start/stop polling based on live status
      if (r.data.status === 'LIVE' && !pollRef.current) {
        pollRef.current = setInterval(() => fetchMatch(true), 10_000);
      } else if (r.data.status !== 'LIVE' && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch { /* silent on background refresh */ }
    if (!isBackground) setLoading(false);
  }

  useEffect(() => {
    fetchMatch();
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [id]);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}><Ionicons name="chevron-back" size={24} color={Colors.wh} /></Pressable>
      </View>
      <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
    </SafeAreaView>
  );

  if (!match) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}><Ionicons name="chevron-back" size={24} color={Colors.wh} /></Pressable>
        <Text style={s.title}>Zápas nenalezen</Text>
        <View style={{ width: 40 }} />
      </View>
    </SafeAreaView>
  );

  const isPlayed  = match.status === 'DONE';
  const showScore = match.status === 'DONE' || match.status === 'LIVE';
  const isAssignedRef = user?.referee?.id && match.refereeId === user.referee.id;
  const canScore  = (isSupervisor || isAssignedRef) && (match.status === 'LIVE' || match.status === 'UPCOMING');
  const isTeamManager = (user?.manager ?? []).some(
    (m: any) => m.teamId === match.homeTeamId || m.teamId === match.awayTeamId
  );

  async function submitRating() {
    if (!starRating || !match.referee) return;
    setRatingBusy(true);
    try {
      await refereesApi.rate(match.referee.id, id!, starRating);
      setRatingDone(true);
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Hodnocení se nepodařilo odeslat. Zkus to znovu.';
      Alert.alert('Chyba', msg);
    } finally {
      setRatingBusy(false);
    }
  }
  // Unified chronological timeline
  const timeline = [...(match.events ?? [])].sort((a: any, b: any) => a.minute - b.minute);

  // Soupiska domácích/hostí
  const homeLineup = match.lineups?.find((l: any) => l.teamId === match.homeTeamId)?.players ?? [];
  const awayLineup = match.lineups?.find((l: any) => l.teamId === match.awayTeamId)?.players ?? [];

  return (
    <SafeAreaView style={s.safe}>
      {/* Hlavička */}
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        {match.status === 'LIVE' ? (
          <LiveBadge size="md" />
        ) : (
          <Text style={[s.statusBadge, { color: STATUS_COLOR[match.status] ?? Colors.mu }]}>
            {STATUS_LABEL[match.status] ?? match.status}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {canScore && (
            <Pressable style={s.scoreBtn} onPress={() => router.push(`/match/${id}/score` as any)}>
              <Ionicons name="football" size={14} color={Colors.bg} />
              <Text style={s.scoreBtnTxt}>Skórovat</Text>
            </Pressable>
          )}
          {match.status === 'UPCOMING' && (
            <Pressable
              style={s.shareBtn}
              onPress={() => {
                const start  = new Date(match.date);
                const end    = new Date(start.getTime() + 90 * 60 * 1000);
                const fmt_dt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                const title  = encodeURIComponent(`${match.homeTeam?.abbr} vs ${match.awayTeam?.abbr}`);
                const loc    = encodeURIComponent(match.venue ?? 'FSL');
                const ics    = [
                  'BEGIN:VCALENDAR', 'VERSION:2.0',
                  'BEGIN:VEVENT',
                  `DTSTART:${fmt_dt(start)}`,
                  `DTEND:${fmt_dt(end)}`,
                  `SUMMARY:${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
                  `LOCATION:${match.venue ?? ''}`,
                  'END:VEVENT', 'END:VCALENDAR',
                ].join('\r\n');
                const uri = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
                Linking.openURL(uri).catch(() => {});
              }}
            >
              <Ionicons name="calendar-outline" size={20} color={Colors.mu} />
            </Pressable>
          )}
          <Pressable
            style={s.shareBtn}
            onPress={() => Share.share({
              message: `${match.homeTeam?.name} vs ${match.awayTeam?.name}`,
              url: `fsl://match/${id}`,
            })}
          >
            <Ionicons name="share-outline" size={20} color={Colors.mu} />
          </Pressable>
        </View>
      </View>

      <ScrollView>
        {/* Scoreboard */}
        <View style={s.scoreboard}>
          <Pressable style={s.teamCol} onPress={() => router.push(`/team/${match.homeTeamId}` as any)}>
            <View style={[s.teamBadge, { backgroundColor: match.homeTeam?.color ?? Colors.go }]}>
              <Text style={s.teamAbbr}>{match.homeTeam?.abbr}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={2}>{match.homeTeam?.name}</Text>
          </Pressable>

          <View style={s.scoreCol}>
            {showScore ? (
              <Text style={s.score}>{match.homeScore ?? 0}:{match.awayScore ?? 0}</Text>
            ) : (
              <Text style={s.scoreDate}>{fmt(match.date)}</Text>
            )}
            <Text style={s.competition}>{match.competition} · kolo {match.round}</Text>
          </View>

          <Pressable style={s.teamCol} onPress={() => router.push(`/team/${match.awayTeamId}` as any)}>
            <View style={[s.teamBadge, { backgroundColor: match.awayTeam?.color ?? Colors.pu }]}>
              <Text style={s.teamAbbr}>{match.awayTeam?.abbr}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={2}>{match.awayTeam?.name}</Text>
          </Pressable>
        </View>

        {/* Tagy */}
        <View style={s.tabs}>
          {(['events', 'lineups', 'info'] as Tab[]).map(t => (
            <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                {t === 'events' ? 'Průběh' : t === 'lineups' ? 'Soupiska' : 'Info'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ padding: 16 }}>
          {/* ── PRŮBĚH ── */}
          {tab === 'events' && (
            timeline.length === 0 ? (
              <Empty text={isPlayed ? 'Žádné zaznamenané události' : 'Zápas ještě nezačal'} />
            ) : (
              <>
                {/* Skóre headerbar */}
                <View style={s.timelineHeader}>
                  <Text style={s.timelineTeam} numberOfLines={1}>{match.homeTeam?.abbr}</Text>
                  <View style={s.timelineDivider} />
                  <Text style={[s.timelineTeam, { textAlign: 'right' }]} numberOfLines={1}>{match.awayTeam?.abbr}</Text>
                </View>

                {timeline.map((e: any) => {
                  const isHome  = e.teamId === match.homeTeamId;
                  const isGoal  = e.type === 'GOAL';
                  const iconName = isGoal ? 'football' : 'warning';
                  const iconColor = isGoal ? Colors.go : Colors.red;
                  const playerName = isGoal
                    ? `${e.scorer?.firstName ?? ''} ${e.scorer?.lastName ?? ''}`.trim()
                    : `${e.penalty?.firstName ?? ''} ${e.penalty?.lastName ?? ''}`.trim();
                  const subText = isGoal && e.assist
                    ? `Asist: ${e.assist.firstName} ${e.assist.lastName}`
                    : !isGoal && e.penaltyType ? e.penaltyType : null;

                  return (
                    <View key={e.id} style={[s.eventRow, !isHome && s.eventRowAway]}>
                      {/* Minuta + ikona na straně domácích */}
                      {isHome ? (
                        <>
                          <View style={{ width: 28, alignItems: 'center' }}>
                            <Text style={s.eventMin}>{e.minute}'</Text>
                          </View>
                          <View style={[s.eventIcon, { backgroundColor: `${iconColor}22` }]}>
                            <Ionicons name={iconName} size={14} color={iconColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.eventName}>{playerName}</Text>
                            {subText && <Text style={s.eventSub}>{subText}</Text>}
                          </View>
                          <View style={{ width: 28 + 28 + 10 }} />
                        </>
                      ) : (
                        <>
                          <View style={{ width: 28 + 28 + 10 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.eventName, { textAlign: 'right' }]}>{playerName}</Text>
                            {subText && <Text style={[s.eventSub, { textAlign: 'right' }]}>{subText}</Text>}
                          </View>
                          <View style={[s.eventIcon, { backgroundColor: `${iconColor}22` }]}>
                            <Ionicons name={iconName} size={14} color={iconColor} />
                          </View>
                          <View style={{ width: 28, alignItems: 'center' }}>
                            <Text style={s.eventMin}>{e.minute}'</Text>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
              </>
            )
          )}

          {/* ── SOUPISKA ── */}
          {tab === 'lineups' && (
            homeLineup.length === 0 && awayLineup.length === 0 ? (
              <Empty text="Soupisky ještě nebyly odeslány" />
            ) : (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <LineupCol title={match.homeTeam?.abbr} players={homeLineup} />
                <LineupCol title={match.awayTeam?.abbr} players={awayLineup} />
              </View>
            )
          )}

          {/* ── INFO ── */}
          {tab === 'info' && (
            <>
              <View style={s.infoCard}>
                {match.venue && <InfoRow label="Hřiště" value={match.venue} />}
                <InfoRow label="Datum" value={fmt(match.date)} />
                <InfoRow label="Soutěž" value={match.competition ?? '—'} />
                <InfoRow label="Divize" value={match.division ?? '—'} />
                {match.round && <InfoRow label="Kolo" value={String(match.round)} />}
                {match.referee && (
                  <Pressable onPress={() => router.push(`/referee/${match.referee.id}` as any)}>
                    <InfoRow label="Rozhodčí" value={`${match.referee.firstName} ${match.referee.lastName} (${match.referee.level})`} link />
                  </Pressable>
                )}
              </View>

              {/* Hodnocení rozhodčího — pouze manažer po skončení zápasu */}
              {isPlayed && match.referee && isTeamManager && (
                <View style={s.rateCard}>
                  <Text style={s.rateTitle}>Hodnocení rozhodčího</Text>
                  {ratingDone ? (
                    <View style={s.rateSuccess}>
                      <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
                      <Text style={s.rateSuccessTxt}>Hodnocení odesláno</Text>
                    </View>
                  ) : (
                    <>
                      <View style={s.starsRow}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <Pressable key={i} onPress={() => setStarRating(i)} hitSlop={8}>
                            <Ionicons
                              name={starRating >= i ? 'star' : 'star-outline'}
                              size={30}
                              color={Colors.go}
                            />
                          </Pressable>
                        ))}
                      </View>
                      <Pressable
                        style={[s.rateBtn, (!starRating || ratingBusy) && { opacity: 0.4 }]}
                        disabled={!starRating || ratingBusy}
                        onPress={submitRating}
                      >
                        {ratingBusy
                          ? <ActivityIndicator color={Colors.bg} size="small" />
                          : <Text style={s.rateBtnTxt}>Odeslat hodnocení</Text>
                        }
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LineupCol({ title, players }: { title: string; players: any[] }) {
  const unlicensedCount = players.filter((lp: any) => {
    const lic = lp.player?.payment?.licStatus;
    return lic && !['PAID', 'WAIVED'].includes(lic);
  }).length;
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.section, { textAlign: 'center' }]}>{title}</Text>
      {unlicensedCount > 0 && (
        <View style={s.licWarn}>
          <Ionicons name="warning" size={12} color={Colors.red} />
          <Text style={s.licWarnTxt}>{unlicensedCount}× bez licence</Text>
        </View>
      )}
      {players.map((lp: any) => {
        const lic = lp.player?.payment?.licStatus;
        const unlicensed = lic && !['PAID', 'WAIVED'].includes(lic);
        return (
          <Pressable key={lp.player?.id} style={s.lineupRow} onPress={() => lp.player?.id && router.push(`/player/${lp.player.id}` as any)}>
            <Text style={[s.lineupNum, unlicensed && { color: Colors.red }]}>{lp.player?.jersey}</Text>
            <Text style={s.lineupName} numberOfLines={1}>{lp.player?.lastName}</Text>
            {unlicensed && <Ionicons name="warning" size={12} color={Colors.red} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function InfoRow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, link && { color: Colors.go }]}>{value}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={s.center}>
      <Ionicons name="football-outline" size={40} color={Colors.mu} />
      <Text style={{ fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:         { width: 40, height: 40, justifyContent: 'center' },
  scoreBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.go, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  scoreBtnTxt:  { fontSize: 11, fontWeight: '700', color: Colors.bg },
  shareBtn:     { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title:        { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  statusBadge:  { fontSize: Fonts.sizes.sm, fontWeight: '700' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32 },
  scoreboard:   { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 8 },
  teamCol:      { flex: 1, alignItems: 'center', gap: 8 },
  teamBadge:    { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  teamAbbr:     { fontSize: Fonts.sizes.md, fontWeight: '900', color: Colors.bg },
  teamName:     { fontSize: Fonts.sizes.xs, color: Colors.mu, textAlign: 'center' },
  scoreCol:     { flex: 1, alignItems: 'center', gap: 6 },
  score:        { fontSize: 36, fontWeight: '900', color: Colors.wh },
  scoreDate:    { fontSize: Fonts.sizes.xs, color: Colors.mu, textAlign: 'center' },
  competition:  { fontSize: 10, color: Colors.di, textAlign: 'center' },
  tabs:         { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 4 },
  tab:          { flex: 1, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center' },
  tabActive:    { backgroundColor: Colors.go, borderColor: Colors.go },
  tabTxt:       { fontSize: 11, color: Colors.mu, fontWeight: '600' },
  tabTxtActive: { color: Colors.bg },
  section:      { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timelineTeam:   { flex: 1, fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.mu, textTransform: 'uppercase', letterSpacing: 0.5 },
  timelineDivider:{ width: 1, height: 14, backgroundColor: Colors.bd, marginHorizontal: 8 },
  eventRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  eventRowHome: {},
  eventRowAway: {},
  eventIcon:    { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  eventMin:     { width: 28, fontSize: Fonts.sizes.xs, color: Colors.di, textAlign: 'center' },
  eventName:    { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  eventSub:     { fontSize: Fonts.sizes.xs, color: Colors.mu },
  lineupRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  lineupNum:    { width: 22, fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.go },
  lineupName:   { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh },
  licWarn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${Colors.red}18`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6 },
  licWarnTxt:   { fontSize: 10, color: Colors.red, fontWeight: '700' },
  infoCard:     { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16 },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  infoLabel:    { fontSize: Fonts.sizes.sm, color: Colors.mu },
  infoValue:    { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '500', flex: 1, textAlign: 'right' },
  rateCard:     { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16, marginTop: 12 },
  rateTitle:    { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.mu, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  starsRow:     { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 14 },
  rateBtn:      { backgroundColor: Colors.go, borderRadius: Radius.md, height: 42, alignItems: 'center', justifyContent: 'center' },
  rateBtnTxt:   { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },
  rateSuccess:  { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 8 },
  rateSuccessTxt:{ fontSize: Fonts.sizes.sm, color: Colors.green, fontWeight: '600' },
});
