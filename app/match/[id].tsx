import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { matchesApi } from '../../services/api';
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
  const { id }    = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [match, setMatch]     = useState<any>(null);
  const [tab, setTab]         = useState<Tab>('events');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchMatch(isBackground = false) {
    if (!id) return;
    try {
      const r = await matchesApi.get(id);
      setMatch(r.data);
      // Start/stop polling based on live status
      if (r.data.status === 'LIVE' && !pollRef.current) {
        pollRef.current = setInterval(() => fetchMatch(true), 15_000);
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

  const isPlayed = match.status === 'DONE';
  const goals    = (match.events ?? []).filter((e: any) => e.type === 'GOAL');
  const penalties= (match.events ?? []).filter((e: any) => e.type === 'PENALTY');

  // Góly per tým
  const homeGoals = goals.filter((g: any) => g.teamId === match.homeTeamId);
  const awayGoals = goals.filter((g: any) => g.teamId === match.awayTeamId);

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
        <Text style={[s.statusBadge, { color: STATUS_COLOR[match.status] ?? Colors.mu }]}>
          {STATUS_LABEL[match.status] ?? match.status}
        </Text>
        <View style={{ width: 40 }} />
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
            {isPlayed ? (
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
            goals.length === 0 && penalties.length === 0 ? (
              <Empty text={isPlayed ? 'Žádné zaznamenané události' : 'Zápas ještě nezačal'} />
            ) : (
              <>
                {/* Góly */}
                {goals.length > 0 && (
                  <>
                    <Text style={s.section}>Góly</Text>
                    {goals.map((g: any) => {
                      const isHome = g.teamId === match.homeTeamId;
                      return (
                        <View key={g.id} style={[s.eventRow, isHome ? s.eventRowHome : s.eventRowAway]}>
                          {isHome && <Text style={s.eventMin}>{g.minute}'</Text>}
                          <View style={[s.eventIcon, { backgroundColor: `${Colors.go}22` }]}>
                            <Ionicons name="football" size={14} color={Colors.go} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.eventName, !isHome && { textAlign: 'right' }]}>
                              {g.scorer?.firstName} {g.scorer?.lastName}
                            </Text>
                            {g.assist && (
                              <Text style={[s.eventSub, !isHome && { textAlign: 'right' }]}>
                                Asist: {g.assist.firstName} {g.assist.lastName}
                              </Text>
                            )}
                          </View>
                          {!isHome && <Text style={s.eventMin}>{g.minute}'</Text>}
                        </View>
                      );
                    })}
                  </>
                )}

                {/* Tresty */}
                {penalties.length > 0 && (
                  <>
                    <Text style={[s.section, { marginTop: 16 }]}>Tresty</Text>
                    {penalties.map((p: any) => {
                      const isHome = p.teamId === match.homeTeamId;
                      return (
                        <View key={p.id} style={[s.eventRow, isHome ? s.eventRowHome : s.eventRowAway]}>
                          {isHome && <Text style={s.eventMin}>{p.minute}'</Text>}
                          <View style={[s.eventIcon, { backgroundColor: `${Colors.red}22` }]}>
                            <Ionicons name="warning" size={14} color={Colors.red} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.eventName, !isHome && { textAlign: 'right' }]}>
                              {p.penalty?.firstName} {p.penalty?.lastName}
                            </Text>
                            {p.penaltyType && (
                              <Text style={[s.eventSub, !isHome && { textAlign: 'right' }]}>
                                {p.penaltyType}
                              </Text>
                            )}
                          </View>
                          {!isHome && <Text style={s.eventMin}>{p.minute}'</Text>}
                        </View>
                      );
                    })}
                  </>
                )}
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
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LineupCol({ title, players }: { title: string; players: any[] }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[s.section, { textAlign: 'center' }]}>{title}</Text>
      {players.map((lp: any) => (
        <Pressable key={lp.player?.id} style={s.lineupRow} onPress={() => lp.player?.id && router.push(`/player/${lp.player.id}` as any)}>
          <Text style={s.lineupNum}>{lp.player?.jersey}</Text>
          <Text style={s.lineupName} numberOfLines={1}>{lp.player?.lastName}</Text>
        </Pressable>
      ))}
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
  eventRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  eventRowHome: {},
  eventRowAway: { flexDirection: 'row-reverse' },
  eventIcon:    { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  eventMin:     { width: 28, fontSize: Fonts.sizes.xs, color: Colors.di, textAlign: 'center' },
  eventName:    { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  eventSub:     { fontSize: Fonts.sizes.xs, color: Colors.mu },
  lineupRow:    { flexDirection: 'row', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  lineupNum:    { width: 22, fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.go },
  lineupName:   { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh },
  infoCard:     { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16 },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  infoLabel:    { fontSize: Fonts.sizes.sm, color: Colors.mu },
  infoValue:    { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '500', flex: 1, textAlign: 'right' },
});
