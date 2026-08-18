import { useEffect, useState } from 'react';
import { View, Text, FlatList, ScrollView, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { statsApi, supervisorApi, playersApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { ErrorView } from '../../components/ErrorView';
import { SkeletonTableRow } from '../../components/SkeletonCard';

type Tab = 'scorers' | 'assisters' | 'body' | 'mvp' | 'referees' | 'mine';

const TABS: { key: Tab; label: string }[] = [
  { key: 'mine',      label: 'Moje' },
  { key: 'scorers',   label: 'Střelci' },
  { key: 'assisters', label: 'Nahrávači' },
  { key: 'body',      label: 'Body' },
  { key: 'mvp',       label: 'MVP' },
  { key: 'referees',  label: 'Rozhodčí' },
];

function StarRow({ avg }: { avg: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={avg >= i ? 'star' : avg >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={12}
          color={Colors.go}
        />
      ))}
    </View>
  );
}

interface MyStats {
  goals: number;
  assists: number;
  points: number;
  penalties: number;
  mvpVotes: number;
  recentGoals: any[];
  recentAssists: any[];
}

export default function StatsScreen() {
  const [tab, setTab]             = useState<Tab>('mine');
  const [seasons, setSeasons]     = useState<string[]>([]);
  const [season, setSeason]       = useState<string | undefined>(undefined); // undefined = aktuální (první)
  const [divisions, setDivisions] = useState<string[]>([]);
  const [division, setDivision]   = useState<string>('Vše');
  const [data, setData]           = useState<any[]>([]);
  const [myStats, setMyStats]     = useState<MyStats | null>(null);
  const [myStatsErr, setMyStatsErr] = useState<'no_player' | 'error' | null>(null);
  const [loading, setLoading]     = useState(true);
  const [refresh, setRefresh]     = useState(false);
  const [error, setError]         = useState(false);

  // Načti ročníky + divize jednou při startu
  useEffect(() => {
    statsApi.seasons().then(r => {
      const s = r.data as string[];
      setSeasons(s);
      if (s.length > 0) setSeason(s[0]); // nejnovější první
    }).catch(() => {});
    supervisorApi.divisions().then(r => {
      const divs = [...new Set<string>((r.data ?? []).map((d: any) => d.division as string))].sort();
      setDivisions(divs);
    }).catch(() => {});
  }, []);

  async function loadMine(isRefresh = false) {
    if (!isRefresh) { setLoading(true); setMyStatsErr(null); }
    try {
      const r = await playersApi.myStats(season);
      setMyStats(r.data);
    } catch (err: any) {
      setMyStatsErr(err?.response?.status === 404 ? 'no_player' : 'error');
    }
    setLoading(false);
    setRefresh(false);
  }

  async function load(isRefresh = false) {
    if (tab === 'mine') return loadMine(isRefresh);
    if (!isRefresh) { setLoading(true); setError(false); }
    setData([]);
    const div = division === 'Vše' ? undefined : division;
    try {
      const call =
        tab === 'scorers'   ? statsApi.scorers(div, season)
        : tab === 'assisters' ? statsApi.assisters(div, season)
        : tab === 'body'      ? statsApi.points(div, season)
        : tab === 'mvp'       ? statsApi.mvp(div, season)
        :                       statsApi.referees(season);
      const r = await call;
      setData(r.data);
    } catch {
      if (!isRefresh) setError(true);
    }
    setLoading(false);
    setRefresh(false);
  }

  useEffect(() => { load(); }, [tab, division, season]);

  function getValueLabel(item: any): string {
    if (tab === 'scorers')   return `${item.goals} G`;
    if (tab === 'assisters') return `${item.assists} A`;
    if (tab === 'body')      return `${item.points ?? (item.goals + item.assists)} B`;
    if (tab === 'mvp')       return `${item.votes}×`;
    return '';
  }

  function renderPlayerRow({ item, index }: { item: any; index: number }) {
    return (
      <Pressable
        style={styles.row}
        onPress={() => item.player?.id && router.push(`/player/${item.player.id}` as any)}
      >
        <Text style={styles.pos}>{index + 1}</Text>
        <View style={styles.info}>
          <Text style={styles.name}>
            {item.player?.firstName} {item.player?.lastName}
          </Text>
          <Text style={styles.team}>
            {item.player?.team?.abbr}
            {tab === 'body' ? `  ·  ${item.goals}G  ${item.assists}A` : ''}
          </Text>
        </View>
        <Text style={styles.value}>{getValueLabel(item)}</Text>
      </Pressable>
    );
  }

  function renderRefereeRow({ item, index }: { item: any; index: number }) {
    return (
      <Pressable
        style={styles.row}
        onPress={() => item.referee?.id && router.push(`/referee/${item.referee.id}` as any)}
      >
        <Text style={styles.pos}>{index + 1}</Text>
        <View style={styles.info}>
          <Text style={styles.name}>
            {item.referee?.firstName} {item.referee?.lastName}
          </Text>
          <View style={styles.refMeta}>
            <StarRow avg={item.avg} />
            <Text style={styles.refCount}>{item.count} hodnocení</Text>
          </View>
        </View>
        <View style={styles.refScore}>
          <Text style={styles.value}>{item.avg.toFixed(1)}</Text>
          <Text style={styles.refMax}>/5</Text>
        </View>
      </Pressable>
    );
  }

  function renderMineContent() {
    if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.go} /></View>;
    if (myStatsErr === 'no_player') return (
      <View style={styles.center}>
        <Ionicons name="person-outline" size={40} color={Colors.mu} />
        <Text style={styles.empty}>Nemáte hráčský profil</Text>
        <Text style={[styles.empty, { fontSize: Fonts.sizes.sm, color: Colors.di }]}>Statistiky se zobrazí po registraci hráče</Text>
      </View>
    );
    if (myStatsErr === 'error') return <ErrorView onRetry={() => loadMine()} />;
    if (!myStats) return null;

    const fmt = (m: any) => {
      const ha = m.match;
      return `${ha?.homeTeam?.abbr ?? '?'} vs ${ha?.awayTeam?.abbr ?? '?'}`;
    };

    return (
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); loadMine(true); }} tintColor={Colors.go} />}
      >
        {/* Souhrn */}
        <View style={styles.statGrid}>
          {[
            { label: 'Góly',     value: myStats.goals,     icon: 'football' as const },
            { label: 'Asistence',value: myStats.assists,   icon: 'hand-right' as const },
            { label: 'Body',     value: myStats.points,    icon: 'flash' as const },
            { label: 'Tresty',   value: myStats.penalties, icon: 'warning' as const },
            { label: 'MVP',      value: myStats.mvpVotes,  icon: 'star' as const },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <Ionicons name={s.icon} size={18} color={Colors.go} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Posledních 5 gólů */}
        {myStats.recentGoals.length > 0 && (
          <View style={styles.recentBlock}>
            <Text style={styles.recentTitle}>Poslední góly</Text>
            {myStats.recentGoals.map((g: any, i: number) => (
              <Pressable key={g.id ?? i} style={styles.recentRow} onPress={() => g.matchId && router.push(`/match/${g.matchId}` as any)}>
                <Ionicons name="football" size={14} color={Colors.go} />
                <Text style={styles.recentText}>{fmt(g)}</Text>
                <Text style={styles.recentMin}>{g.minute}'</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Posledních 5 asistencí */}
        {myStats.recentAssists.length > 0 && (
          <View style={styles.recentBlock}>
            <Text style={styles.recentTitle}>Poslední asistence</Text>
            {myStats.recentAssists.map((a: any, i: number) => (
              <Pressable key={a.id ?? i} style={styles.recentRow} onPress={() => a.matchId && router.push(`/match/${a.matchId}` as any)}>
                <Ionicons name="hand-right" size={14} color={Colors.go} />
                <Text style={styles.recentText}>{fmt(a)}</Text>
                <Text style={styles.recentMin}>{a.minute}'</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    );
  }

  const divisionList = ['Vše', ...divisions];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Hlavička */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Statistiky</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {seasons.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {seasons.map(s => (
                <Pressable key={s} style={[styles.seasonChip, season === s && styles.seasonChipActive]} onPress={() => setSeason(s)}>
                  <Text style={[styles.seasonTxt, season === s && styles.seasonTxtActive]}>{s}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <Pressable onPress={() => router.push('/compare' as any)} style={styles.compareBtn}>
            <Ionicons name="git-compare-outline" size={15} color={Colors.go} />
            <Text style={styles.compareTxt}>Porovnat</Text>
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingVertical: 2 }}>
        {TABS.map(t => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Division filter (skryj pro rozhodčí a moje) */}
      {tab !== 'referees' && tab !== 'mine' && divisionList.length > 1 && (
        <View style={styles.divBarWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingVertical: 2 }}>
            {divisionList.map(d => (
              <Pressable
                key={d}
                style={[styles.divChip, division === d && styles.divChipActive]}
                onPress={() => setDivision(d)}
              >
                <Text style={[styles.divChipTxt, division === d && styles.divChipTxtActive]}>{d}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {tab === 'mine' ? renderMineContent() : loading ? (
        <View style={styles.skeletonCard}>
          {Array.from({ length: 10 }).map((_, i) => (
            <SkeletonTableRow key={i} last={i === 9} />
          ))}
        </View>
      ) : error ? (
        <ErrorView onRetry={() => load()} />
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="stats-chart-outline" size={40} color={Colors.mu} />
          <Text style={styles.empty}>Zatím žádná data</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(_, idx) => String(idx)}
          contentContainerStyle={{ padding: 16 }}
          renderItem={tab === 'referees' ? renderRefereeRow : renderPlayerRow}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(true); }} tintColor={Colors.go} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  titleRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 10 },
  title:        { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh, flex: 1 },
  compareBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: `${Colors.go}18`, borderRadius: Radius.full, borderWidth: 1, borderColor: `${Colors.go}44` },
  compareTxt:   { fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.go },
  seasonChip:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  seasonChipActive: { backgroundColor: Colors.go, borderColor: Colors.go },
  seasonTxt:    { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700' },
  seasonTxtActive: { color: Colors.bg },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 32 },
  empty:        { fontSize: Fonts.sizes.md, color: Colors.mu, textAlign: 'center' },
  tabsBar:      { flexGrow: 0, marginBottom: 0 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.md,
    backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center',
  },
  tabActive:     { backgroundColor: Colors.go, borderColor: Colors.go },
  tabText:       { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },
  tabTextActive: { color: Colors.bg },
  // Moje statistiky
  statGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:     {
    flex: 1, minWidth: '28%', backgroundColor: Colors.c1, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.bd, padding: 14, alignItems: 'center', gap: 4,
  },
  statValue:    { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.wh },
  statLabel:    { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },
  recentBlock:  { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  recentTitle:  { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  recentRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  recentText:   { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh },
  recentMin:    { fontSize: Fonts.sizes.xs, color: Colors.di },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 14, backgroundColor: Colors.c1,
    borderRadius: Radius.md,
  },
  pos:      { width: 26, fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  info:     { flex: 1 },
  name:     { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  team:     { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  value:    { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.go },
  sep:      { height: 6 },
  refMeta:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  refCount: { fontSize: Fonts.sizes.xs, color: Colors.di },
  refScore: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  refMax:   { fontSize: Fonts.sizes.sm, color: Colors.mu },
  divBarWrap:    { borderTopWidth: 1, borderTopColor: Colors.bd, paddingVertical: 8 },
  divChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  divChipActive: { backgroundColor: Colors.pu, borderColor: Colors.pu },
  divChipTxt:    { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },
  divChipTxtActive: { color: '#fff' },
  skeletonCard:  { margin: 16, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
});
