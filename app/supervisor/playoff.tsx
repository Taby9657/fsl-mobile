/**
 * Nasazení do playoff.
 *
 * Vezme tabulku základní části zvolené soutěže, nasadí 1–N, 2–(N-1) atd.
 * a vygeneruje zápasy jednoho kola. Další kolo se generuje znovu, až se
 * odehraje to předchozí — kdo postoupí, dopředu nevíme.
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi, type StatsScope } from '../../services/api';
import { CompetitionFilter } from '../../components/CompetitionFilter';
import { DatePicker } from '../../components/DatePicker';
import { Colors, Fonts, Radius } from '../../constants/colors';

const POCTY = [2, 4, 6, 8];

export default function PlayoffScreen() {
  const [scope, setScope]     = useState<StatsScope>({});
  const [pocet, setPocet]     = useState(4);
  const [kolo, setKolo]       = useState('1');
  const [bestOf, setBestOf]   = useState('1');
  const [datum, setDatum]     = useState<Date | null>(null);
  const [cas, setCas]         = useState('18:00');
  const [hriste, setHriste]   = useState('');
  const [interval, setInterval] = useState('7');
  const [smazat, setSmazat]   = useState(false);

  const [nahled, setNahled]   = useState<any>(null);
  const [nacita, setNacita]   = useState(false);
  const [generuje, setGeneruje] = useState(false);

  function payload() {
    return {
      ...scope,
      teamCount: pocet,
      round:     parseInt(kolo, 10) || 1,
      bestOf:    parseInt(bestOf, 10) || 1,
    };
  }

  async function nactiNahled() {
    setNacita(true);
    setNahled(null);
    try {
      const r = await supervisorApi.previewPlayoff(payload());
      setNahled(r.data);
    } catch (err: any) {
      Alert.alert('Nepodařilo se nasadit', err?.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setNacita(false);
    }
  }

  async function generuj() {
    if (!datum) { Alert.alert('Chybí datum', 'Vyber datum prvního zápasu.'); return; }
    if (!/^\d{1,2}:\d{2}$/.test(cas)) { Alert.alert('Chybný čas', 'Formát: HH:MM'); return; }

    setGeneruje(true);
    try {
      const r = await supervisorApi.generatePlayoff({
        ...payload(),
        startDate:      datum.toISOString(),
        defaultTime:    cas,
        defaultVenue:   hriste.trim() || null,
        intervalDays:   parseInt(interval, 10) || 7,
        deleteExisting: smazat,
      });
      Alert.alert(
        'Playoff vygenerováno',
        `Vzniklo ${r.data.created} zápasů v ${r.data.pairs} dvojicích (kolo ${r.data.round}).`,
        [{ text: 'Zobrazit zápasy', onPress: () => router.push('/supervisor/matches' as any) }],
      );
      setNahled(null);
    } catch (err: any) {
      Alert.alert('Nepodařilo se vygenerovat', err?.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setGeneruje(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="chevron-back" size={24} color={Colors.wh} />
          </Pressable>
          <Text style={s.title}>Nasazení do playoff</Text>
          <View style={{ width: 40 }} />
        </View>

        <CompetitionFilter onChange={setScope} />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={s.info}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.go} />
            <Text style={s.infoTxt}>
              Nasazuje se podle tabulky základní části: 1–N, 2–(N-1) a tak dál, lepší tým je domácí.
              Generuje se vždy jen jedno kolo — další si vygeneruješ, až se tohle dohraje.
            </Text>
          </View>

          <Text style={s.label}>Kolik týmů postupuje</Text>
          <View style={s.radaChipu}>
            {POCTY.map(n => (
              <Pressable key={n} style={[s.chip, pocet === n && s.chipActive]} onPress={() => { setPocet(n); setNahled(null); }}>
                <Text style={[s.chipTxt, pocet === n && s.chipTxtActive]}>{n}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Kolo</Text>
              <TextInput
                style={s.input} value={kolo}
                onChangeText={v => setKolo(v.replace(/\D/g, ''))}
                placeholder="1" placeholderTextColor={Colors.di}
                keyboardType="number-pad" keyboardAppearance="dark"
              />
              <Text style={s.hint}>1 = první kolo. Vyšší číslo = blíž finále.</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Série na</Text>
              <TextInput
                style={s.input} value={bestOf}
                onChangeText={v => setBestOf(v.replace(/\D/g, ''))}
                placeholder="1" placeholderTextColor={Colors.di}
                keyboardType="number-pad" keyboardAppearance="dark"
              />
              <Text style={s.hint}>
                1 = jeden zápas. 3 = série, hřiště se střídá. Rozhodnutou sérii ukonči
                smazáním neodehraných zápasů — jinak tým vypadá, že je pořád ve hře.
              </Text>
            </View>
          </View>

          <Pressable style={[s.sekBtn, nacita && { opacity: 0.6 }]} onPress={nactiNahled} disabled={nacita}>
            {nacita
              ? <ActivityIndicator color={Colors.go} />
              : <Text style={s.sekBtnTxt}>Zobrazit nasazení</Text>}
          </Pressable>

          {/* ── Náhled dvojic ── */}
          {nahled && (
            <View style={s.nahled}>
              <Text style={s.nahledTitle}>{nahled.teams} týmů · {nahled.pairs.length} dvojic</Text>
              {nahled.pairs.map((p: any, i: number) => (
                <View key={i} style={s.par}>
                  <Text style={s.seed}>{p.seedHome}</Text>
                  <View style={[s.tecka, { backgroundColor: p.homeTeam?.color ?? Colors.go }]} />
                  <Text style={s.tym} numberOfLines={1}>{p.homeTeam?.name ?? '?'}</Text>
                  <Text style={s.body}>{p.homePts}b</Text>
                  <Text style={s.vs}>vs</Text>
                  <Text style={s.body}>{p.awayPts}b</Text>
                  <Text style={s.tym} numberOfLines={1}>{p.awayTeam?.name ?? '?'}</Text>
                  <View style={[s.tecka, { backgroundColor: p.awayTeam?.color ?? Colors.pu }]} />
                  <Text style={s.seed}>{p.seedAway}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Termíny ── */}
          <Text style={s.sekce}>Termíny</Text>

          <Text style={s.label}>Datum prvního zápasu *</Text>
          <DatePicker value={datum} onChange={setDatum} placeholder="Vybrat datum" />

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Čas</Text>
              <TextInput
                style={s.input} value={cas} onChangeText={setCas}
                placeholder="18:00" placeholderTextColor={Colors.di}
                keyboardType="numbers-and-punctuation" keyboardAppearance="dark"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Rozestup (dní)</Text>
              <TextInput
                style={s.input} value={interval}
                onChangeText={v => setInterval(v.replace(/\D/g, ''))}
                placeholder="7" placeholderTextColor={Colors.di}
                keyboardType="number-pad" keyboardAppearance="dark"
              />
            </View>
          </View>

          <Text style={s.label}>Hřiště (volitelné)</Text>
          <TextInput
            style={s.input} value={hriste} onChangeText={setHriste}
            placeholder="Sportovní hala XY" placeholderTextColor={Colors.di}
            keyboardAppearance="dark"
          />

          <Pressable style={s.prepinac} onPress={() => setSmazat(v => !v)}>
            <Ionicons
              name={smazat ? 'checkbox' : 'square-outline'}
              size={20}
              color={smazat ? Colors.red : Colors.di}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.prepinacTxt}>Smazat stávající zápasy tohohle kola</Text>
              <Text style={s.hint}>Odstraní naplánované playoff zápasy se stejným číslem kola.</Text>
            </View>
          </Pressable>

          <Pressable
            style={[s.hlavniBtn, (!nahled || generuje) && { opacity: 0.5 }]}
            onPress={generuj}
            disabled={!nahled || generuje}
          >
            {generuje
              ? <ActivityIndicator color={Colors.bg} />
              : <Text style={s.hlavniBtnTxt}>Vygenerovat playoff</Text>}
          </Pressable>
          {!nahled && <Text style={s.hint}>Nejdřív si zobraz nasazení, ať víš, co vznikne.</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  title:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },

  info:    { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, marginBottom: 8 },
  infoTxt: { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18 },

  label: { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 16, marginBottom: 6 },
  hint:  { fontSize: Fonts.sizes.xs, color: Colors.di, lineHeight: 16, marginTop: 6 },
  input: { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, color: Colors.wh, fontSize: Fonts.sizes.md },
  sekce: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.wh, marginTop: 26 },

  radaChipu:   { flexDirection: 'row', gap: 8 },
  chip:        { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  chipActive:  { backgroundColor: Colors.go, borderColor: Colors.go },
  chipTxt:     { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '700' },
  chipTxtActive: { color: Colors.bg },

  sekBtn:    { borderWidth: 1, borderColor: Colors.go, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 20 },
  sekBtnTxt: { fontSize: Fonts.sizes.md, color: Colors.go, fontWeight: '700' },

  nahled:      { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, marginTop: 14 },
  nahledTitle: { fontSize: Fonts.sizes.sm, fontWeight: '800', color: Colors.wh, marginBottom: 10 },
  par:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.bd },
  seed:        { width: 18, fontSize: 11, fontWeight: '800', color: Colors.go, textAlign: 'center' },
  tecka:       { width: 8, height: 8, borderRadius: 4 },
  tym:         { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.wh, fontWeight: '600' },
  body:        { fontSize: 10, color: Colors.di, fontWeight: '700' },
  vs:          { fontSize: 10, color: Colors.mu },

  prepinac:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, marginTop: 18 },
  prepinacTxt: { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },

  hlavniBtn:    { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginTop: 22 },
  hlavniBtnTxt: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
