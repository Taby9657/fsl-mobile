import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBack } from '../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { searchApi } from '../services/api';
import { Colors, Fonts, Radius } from '../constants/colors';

const POS: Record<string, string> = { GK: 'Br', F: 'Ú', D: 'O' };

interface Results {
  players:  any[];
  teams:    any[];
  referees: any[];
}

export default function SearchScreen() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchApi.search(q);
        setResults(r.data);
      } catch {
        setResults({ players: [], teams: [], referees: [] });
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const total = (results?.players.length ?? 0) + (results?.teams.length ?? 0) + (results?.referees.length ?? 0);

  return (
    <SafeAreaView style={s.safe}>
      {/* Hlavička se vstupem */}
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <View style={s.inputWrap}>
          <Ionicons name="search" size={16} color={Colors.mu} style={{ marginLeft: 10 }} />
          <TextInput
            style={s.input}
            placeholder="Hledat hráče, týmy, rozhodčí…"
            placeholderTextColor={Colors.di}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {loading && <ActivityIndicator color={Colors.mu} size="small" style={{ marginRight: 10 }} />}
        </View>
      </View>

      {/* Prázdný stav */}
      {!query.trim() && (
        <View style={s.center}>
          <Ionicons name="search-outline" size={48} color={Colors.mu} />
          <Text style={s.hint}>Zadej jméno hráče, název týmu nebo rozhodčího</Text>
        </View>
      )}

      {/* Příliš krátký dotaz */}
      {query.trim().length === 1 && (
        <View style={s.center}>
          <Text style={s.hint}>Zadej alespoň 2 znaky</Text>
        </View>
      )}

      {/* Žádné výsledky */}
      {results !== null && total === 0 && !loading && (
        <View style={s.center}>
          <Ionicons name="sad-outline" size={40} color={Colors.mu} />
          <Text style={s.hint}>Nic nenalezeno pro „{query}"</Text>
        </View>
      )}

      {/* Výsledky */}
      {results !== null && total > 0 && (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }}>

          {/* Týmy */}
          {results.teams.length > 0 && (
            <View>
              <Text style={s.section}>Týmy</Text>
              {results.teams.map(t => (
                <Pressable key={t.id} style={s.row} onPress={() => router.push(`/team/${t.id}` as any)}>
                  <View style={[s.teamBadge, { backgroundColor: t.color ?? Colors.go }]}>
                    <Text style={s.teamAbbr}>{t.abbr}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{t.name}</Text>
                    {t.division && <Text style={s.rowSub}>{t.division}</Text>}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.di} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Hráči */}
          {results.players.length > 0 && (
            <View>
              <Text style={s.section}>Hráči</Text>
              {results.players.map(p => (
                <Pressable key={p.id} style={s.row} onPress={() => router.push(`/player/${p.id}` as any)}>
                  <View style={s.playerBadge}>
                    <Text style={s.playerNum}>{p.jersey ?? '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{p.firstName} {p.lastName}</Text>
                    <Text style={s.rowSub}>
                      {p.team?.name ?? 'Bez týmu'}{p.position ? ` · ${POS[p.position] ?? p.position}` : ''}
                    </Text>
                  </View>
                  {p.team?.color && (
                    <View style={[s.teamDot, { backgroundColor: p.team.color }]} />
                  )}
                  <Ionicons name="chevron-forward" size={14} color={Colors.di} />
                </Pressable>
              ))}
            </View>
          )}

          {/* Rozhodčí */}
          {results.referees.length > 0 && (
            <View>
              <Text style={s.section}>Rozhodčí</Text>
              {results.referees.map(r => (
                <Pressable key={r.id} style={s.row} onPress={() => router.push(`/referee/${r.id}` as any)}>
                  <View style={s.refBadge}>
                    <Ionicons name="person" size={18} color={Colors.pu} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{r.firstName} {r.lastName}</Text>
                    <Text style={s.rowSub}>Úroveň {r.level}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.di} />
                </Pressable>
              ))}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  back:        { width: 40, height: 40, justifyContent: 'center' },
  inputWrap:   { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, height: 42 },
  input:       { flex: 1, paddingHorizontal: 8, fontSize: Fonts.sizes.md, color: Colors.wh, height: '100%' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  hint:        { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', lineHeight: 20 },
  section:     { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 12, marginBottom: 6 },
  rowName:     { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  rowSub:      { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  teamBadge:   { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  teamAbbr:    { fontSize: 11, fontWeight: '900', color: Colors.bg },
  playerBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.c2, justifyContent: 'center', alignItems: 'center' },
  playerNum:   { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.go },
  refBadge:    { width: 36, height: 36, borderRadius: 18, backgroundColor: `${Colors.pu}22`, justifyContent: 'center', alignItems: 'center' },
  teamDot:     { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
});
