import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { refereesApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';
import { ErrorView } from '../../components/ErrorView';
import { SkeletonBlock, SkeletonHeroCard } from '../../components/SkeletonCard';

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function Stars({ avg }: { avg: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1,2,3,4,5].map(i => (
        <Ionicons
          key={i}
          name={avg >= i ? 'star' : avg >= i - 0.5 ? 'star-half' : 'star-outline'}
          size={14}
          color={Colors.go}
        />
      ))}
    </View>
  );
}

export default function RefereeDetailScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const { user }  = useAuthStore();
  const isSelf    = user?.referee?.id === id;

  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const [ref, setRef]           = useState<any>(null);
  const [matches, setMatches]   = useState<any[]>([]);
  const [tab, setTab]           = useState<'upcoming' | 'history' | 'ratings'>('upcoming');

  function loadData() {
    if (!id) return;
    setError(false); setLoading(true);
    Promise.all([
      refereesApi.get(id),
      refereesApi.futureMatches(id),
    ])
      .then(([rRes, mRes]) => {
        setRef(rRes.data);
        setMatches(mRes.data);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [id]);

  const ratings: any[] = ref?.ratings ?? [];
  const avgRating = ratings.length > 0
    ? ratings.reduce((s: number, r: any) => s + r.rating, 0) / ratings.length
    : 0;
  const pastMatches: any[] = (ref?.matches ?? []).filter((m: any) => m.status === 'DONE');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>{isSelf ? 'Moje nasazení' : 'Rozhodčí'}</Text>
        {isSelf && (
          <Pressable onPress={() => router.push('/referee-profile' as any)}>
            <Text style={{ color: Colors.go, fontWeight: '600', fontSize: Fonts.sizes.sm }}>Profil</Text>
          </Pressable>
        )}
        {!isSelf && <View style={{ width: 40 }} />}
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <SkeletonHeroCard />
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3].map(i => <SkeletonBlock key={i} height={34} style={{ flex: 1, borderRadius: 8 }} />)}
          </View>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonBlock key={i} height={60} width="100%" style={{ borderRadius: 10 }} />
          ))}
        </ScrollView>
      ) : error ? (
        <ErrorView onRetry={loadData} />
      ) : !ref ? (
        <View style={s.center}><Text style={s.empty}>Rozhodčí nenalezen</Text></View>
      ) : (
        <ScrollView>
          {/* Info karta */}
          <View style={s.topCard}>
            <View style={s.avatar}>
              <Ionicons name="person" size={30} color={Colors.go} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.refName}>{ref.firstName} {ref.lastName}</Text>
              <Text style={s.refLevel}>Úroveň {ref.level}</Text>
            </View>
            {avgRating > 0 && (
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Stars avg={avgRating} />
                <Text style={s.avgNum}>{avgRating.toFixed(1)} ({ratings.length})</Text>
              </View>
            )}
          </View>

          {/* Tagy */}
          <View style={s.tabs}>
            {(['upcoming', 'history', 'ratings'] as const).map(t => (
              <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
                <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                  {t === 'upcoming' ? 'Nadcházející' : t === 'history' ? 'Historie' : 'Hodnocení'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ padding: 16 }}>
            {/* Nadcházející zápasy */}
            {tab === 'upcoming' && (
              matches.length === 0
                ? <Empty text="Žádné nadcházející zápasy" />
                : matches.map(m => (
                  <View key={m.id}>
                    <MatchCard m={m} />
                    {isSelf && (m.status === 'UPCOMING' || m.status === 'LIVE') && (
                      <Pressable
                        style={{ backgroundColor: Colors.go, borderRadius: Radius.sm, padding: 10, alignItems: 'center', marginTop: -6, marginBottom: 10 }}
                        onPress={() => router.push(`/match/${m.id}/score` as any)}
                      >
                        <Text style={{ color: Colors.bg, fontWeight: '700', fontSize: Fonts.sizes.sm }}>
                          {m.status === 'LIVE' ? '● Pokračovat ve scoringu' : '▶ Zahájit live scoring'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))
            )}

            {/* Historie */}
            {tab === 'history' && (
              pastMatches.length === 0
                ? <Empty text="Žádné odehrané zápasy" />
                : pastMatches.map(m => <MatchCard key={m.id} m={m} played />)
            )}

            {/* Hodnocení */}
            {tab === 'ratings' && (
              ratings.length === 0
                ? <Empty text="Zatím žádná hodnocení" />
                : ratings.map((r: any) => (
                    <View key={r.id} style={s.ratingCard}>
                      <Stars avg={r.rating} />
                      <Text style={s.ratingDate}>{fmt(r.createdAt)}</Text>
                      {r.comment && <Text style={s.ratingComment}>{r.comment}</Text>}
                    </View>
                  ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={s.center}>
      <Ionicons name="football-outline" size={40} color={Colors.mu} />
      <Text style={s.empty}>{text}</Text>
    </View>
  );
}

function MatchCard({ m, played }: { m: any; played?: boolean }) {
  return (
    <Pressable style={s.matchCard} onPress={() => router.push(`/match/${m.id}` as any)}>
      <View style={{ flex: 1 }}>
        <Text style={s.matchTeams}>{m.homeTeam?.abbr} vs {m.awayTeam?.abbr}</Text>
        <Text style={s.matchMeta}>{new Date(m.date).toLocaleDateString('cs-CZ')}</Text>
        {m.venue && <Text style={s.matchVenue}>{m.venue}</Text>}
      </View>
      {played && (
        <Text style={s.score}>{m.homeScore}:{m.awayScore}</Text>
      )}
      <Ionicons name="chevron-forward" size={14} color={Colors.di} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:         { width: 40, height: 40, justifyContent: 'center' },
  title:        { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  empty:        { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' },
  topCard:      { margin: 16, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:       { width: 52, height: 52, borderRadius: 26, backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center' },
  refName:      { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  refLevel:     { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  avgNum:       { fontSize: Fonts.sizes.xs, color: Colors.mu },
  tabs:         { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 4 },
  tab:          { flex: 1, paddingVertical: 7, borderRadius: Radius.md, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center' },
  tabActive:    { backgroundColor: Colors.go, borderColor: Colors.go },
  tabTxt:       { fontSize: 11, color: Colors.mu, fontWeight: '600' },
  tabTxtActive: { color: Colors.bg },
  matchCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, marginBottom: 8, gap: 10 },
  matchTeams:   { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  matchMeta:    { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  matchVenue:   { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 1 },
  score:        { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.go },
  ratingCard:   { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, marginBottom: 8, gap: 6 },
  ratingDate:   { fontSize: Fonts.sizes.xs, color: Colors.di },
  ratingComment:{ fontSize: Fonts.sizes.sm, color: Colors.mu, marginTop: 4 },
});
