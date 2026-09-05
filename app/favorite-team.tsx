// Výběr oblíbeného týmu – personalizace domovské obrazovky pro fanoušky
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { goBack } from '../utils/navigation';
import { teamsApi } from '../services/api';
import { useFanStore } from '../store/fan';
import { ErrorView } from '../components/ErrorView';
import { Colors, Fonts, Radius } from '../constants/colors';

export default function FavoriteTeamScreen() {
  const { favTeamId, setFavTeam } = useFanStore();
  const [teams,   setTeams]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  async function load() {
    setError(false);
    setLoading(true);
    try {
      const r = await teamsApi.list();
      setTeams(r.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function pick(id: string) {
    // Druhé klepnutí na už vybraný tým ho odebere
    await setFavTeam(favTeamId === id ? null : id);
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Oblíbený tým</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
      ) : error ? (
        <ErrorView onRetry={load} />
      ) : (
        <FlatList
          data={teams}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <Text style={s.lead}>
              Vyber si tým, který chceš sledovat. Jeho nejbližší zápas a poslední výsledek
              se ti pak zobrazí nahoře na domovské obrazovce. Opětovným klepnutím výběr zrušíš.
            </Text>
          }
          renderItem={({ item }) => {
            const active = favTeamId === item.id;
            return (
              <Pressable
                style={[s.row, active && s.rowActive]}
                onPress={() => pick(item.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={[s.logo, { borderColor: item.color ?? Colors.bd }]}>
                  {item.logoUrl
                    ? <Image source={{ uri: item.logoUrl }} style={s.logoImg} />
                    : <Text style={[s.abbr, { color: item.color ?? Colors.go }]}>{item.abbr}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{item.name}</Text>
                  {/* Divizi přiděluje supervisor až při rozlosování. Dokud ji tým
                      nemá, řádek prostě není — „Bez divize" svítilo u všech týmů
                      naráz a neneslo žádnou informaci. */}
                  {item.division ? <Text style={s.division}>{item.division}</Text> : null}
                </View>
                <Ionicons
                  name={active ? 'heart' : 'heart-outline'}
                  size={22}
                  color={active ? Colors.go : Colors.di}
                />
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={s.empty}>Zatím tu nejsou žádné týmy.</Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  header:    { flexDirection: 'row', alignItems: 'center', padding: 16 },
  back:      { width: 40, height: 40, justifyContent: 'center' },
  title:     { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lead:      { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 19, marginBottom: 16 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 12, marginBottom: 8 },
  rowActive: { borderColor: Colors.go, backgroundColor: Colors.c2 },
  logo:      { width: 40, height: 40, borderRadius: 20, borderWidth: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: Colors.c2 },
  logoImg:   { width: 40, height: 40 },
  abbr:      { fontSize: Fonts.sizes.xs, fontWeight: '800' },
  name:      { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  division:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  empty:     { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', marginTop: 40 },
});
