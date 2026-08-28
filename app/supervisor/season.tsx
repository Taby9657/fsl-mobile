// Přechod na novou sezónu – naplánovaný na datum, dvoukrokově potvrzený
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import { goBack } from '../../utils/navigation';
import { supervisorApi } from '../../services/api';
import { DatePicker } from '../../components/DatePicker';
import { ErrorView } from '../../components/ErrorView';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface Transition {
  id: string;
  newSeason: string;
  scheduledAt: string;
  status: 'PENDING_CONFIRM' | 'CONFIRMED' | 'EXECUTED' | 'CANCELLED' | 'FAILED';
  confirmedAt?: string | null;
  executedAt?: string | null;
  result?: string | null;
}

interface SeasonState {
  currentSeason: string | null;
  planned: Transition | null;
  lastTransition: Transition | null;
  blockingMatches: number;
  blockingSample: any[];
}

function formatDate(iso: string) {
  return format(new Date(iso), 'EEEE d. MMMM yyyy', { locale: cs });
}

export default function SeasonScreen() {
  const [data,    setData]    = useState<SeasonState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [busy,    setBusy]    = useState(false);

  const [season, setSeason] = useState('');
  const [date,   setDate]   = useState<Date | null>(null);
  const [opis,   setOpis]   = useState('');

  const load = useCallback(async () => {
    setError(false);
    try {
      const r = await supervisorApi.season();
      setData(r.data);
      setOpis('');
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function plan() {
    const s = season.trim();
    if (!/^\d{4}\/\d{2}$/.test(s)) {
      Alert.alert('Neplatný formát', 'Sezónu zadej ve tvaru 2026/27.'); return;
    }
    if (!date) {
      Alert.alert('Chybí datum', 'Vyber den, kdy má nová sezóna začít.'); return;
    }
    setBusy(true);
    try {
      await supervisorApi.planSeason(s, date.toISOString());
      setSeason(''); setDate(null);
      await load();
      Alert.alert(
        'Naplánováno',
        'Přechod je uložený, ale zatím neplatí. Potvrď ho opsáním názvu sezóny — teprve pak se spustí sám.',
      );
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Přechod se nepodařilo naplánovat');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(t: Transition) {
    setBusy(true);
    try {
      await supervisorApi.confirmSeason(t.id, opis.trim());
      await load();
      Alert.alert('Potvrzeno', `Sezóna ${t.newSeason} se spustí sama v naplánovaný den.`);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Potvrzení se nezdařilo');
    } finally {
      setBusy(false);
    }
  }

  function cancel(t: Transition) {
    Alert.alert(
      'Zrušit přechod',
      `Opravdu zrušit naplánovaný přechod na sezónu ${t.newSeason}?`,
      [
        { text: 'Nechat', style: 'cancel' },
        {
          text: 'Zrušit přechod', style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await supervisorApi.cancelSeason(t.id);
              await load();
            } catch (err: any) {
              Alert.alert('Chyba', err?.response?.data?.error ?? 'Zrušení se nezdařilo');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  const zitra = new Date(); zitra.setDate(zitra.getDate() + 1);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Sezóna</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.pu} size="large" /></View>
      ) : error || !data ? (
        <ErrorView onRetry={() => { setLoading(true); load(); }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>

          {/* Aktuální stav */}
          <View style={s.card}>
            <Text style={s.label}>Aktuální sezóna</Text>
            <Text style={s.big}>{data.currentSeason ?? 'Zatím žádná'}</Text>
            <View style={s.divider} />
            <View style={s.row}>
              <Ionicons
                name={data.blockingMatches > 0 ? 'alert-circle' : 'checkmark-circle'}
                size={18}
                color={data.blockingMatches > 0 ? '#F59E0B' : Colors.green}
              />
              <Text style={s.rowTxt}>
                {data.blockingMatches > 0
                  ? `Zbývá ${data.blockingMatches} neodehraných zápasů`
                  : 'Všechny zápasy jsou dohrané'}
              </Text>
            </View>
            <Text style={s.hint}>
              Přechod se neprovede, dokud jsou ve staré sezóně neodehrané nebo rozehrané zápasy.
              Místo toho se odloží a přijde ti upozornění.
            </Text>
          </View>

          {/* Naplánovaný přechod */}
          {data.planned ? (
            <View style={[s.card, s.plannedCard]}>
              <View style={s.row}>
                <Ionicons
                  name={data.planned.status === 'CONFIRMED' ? 'lock-closed' : 'time-outline'}
                  size={18}
                  color={data.planned.status === 'CONFIRMED' ? Colors.green : '#F59E0B'}
                />
                <Text style={s.plannedTitle}>
                  {data.planned.status === 'CONFIRMED' ? 'Potvrzeno' : 'Čeká na potvrzení'}
                </Text>
              </View>

              <Text style={s.big}>{data.planned.newSeason}</Text>
              <Text style={s.plannedDate}>{formatDate(data.planned.scheduledAt)}</Text>

              {data.planned.status === 'PENDING_CONFIRM' ? (
                <>
                  <Text style={s.hint}>
                    Druhý krok: pro potvrzení opiš přesně název sezóny. Bez toho se přechod nespustí.
                  </Text>
                  <TextInput
                    style={s.input}
                    value={opis}
                    onChangeText={setOpis}
                    placeholder={data.planned.newSeason}
                    placeholderTextColor={Colors.di}
                    autoCapitalize="none"
                    keyboardAppearance="dark"
                  />
                  <Pressable
                    style={[s.btnPrimary, (busy || opis.trim() !== data.planned.newSeason) && s.btnOff]}
                    onPress={() => confirm(data.planned!)}
                    disabled={busy || opis.trim() !== data.planned.newSeason}
                  >
                    {busy
                      ? <ActivityIndicator color={Colors.bg} size="small" />
                      : <Text style={s.btnPrimaryTxt}>Potvrdit přechod</Text>}
                  </Pressable>
                </>
              ) : (
                <Text style={s.hint}>
                  Přechod proběhne automaticky. Do té doby můžeš licence i platby normálně spravovat.
                </Text>
              )}

              <Pressable style={s.btnGhost} onPress={() => cancel(data.planned!)} disabled={busy}>
                <Text style={s.btnGhostTxt}>Zrušit naplánovaný přechod</Text>
              </Pressable>
            </View>
          ) : (
            /* Plánování */
            <View style={s.card}>
              <Text style={s.sectionTitle}>Naplánovat novou sezónu</Text>

              <Text style={s.label}>Označení sezóny</Text>
              <TextInput
                style={s.input}
                value={season}
                onChangeText={setSeason}
                placeholder="2026/27"
                placeholderTextColor={Colors.di}
                autoCapitalize="none"
                keyboardAppearance="dark"
              />

              <Text style={s.label}>Den, kdy má začít</Text>
              <DatePicker value={date} onChange={setDate} minDate={zitra} placeholder="Vybrat datum" />

              <Text style={s.hint}>
                V ten den se resetují licence hráčů i platby týmů. Odpuštěné (WAIVED) zůstávají beze změny.
              </Text>

              <Pressable
                style={[s.btnPrimary, (busy || !season.trim() || !date) && s.btnOff]}
                onPress={plan}
                disabled={busy || !season.trim() || !date}
              >
                {busy
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <Text style={s.btnPrimaryTxt}>Naplánovat</Text>}
              </Pressable>
            </View>
          )}

          {/* Poslední proběhlý přechod */}
          {data.lastTransition && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>Poslední přechod</Text>
              <Text style={s.rowTxt}>
                {data.lastTransition.newSeason}
                {data.lastTransition.executedAt ? ` · ${formatDate(data.lastTransition.executedAt)}` : ''}
              </Text>
              {data.lastTransition.result && (
                <Text style={s.hint}>{data.lastTransition.result}</Text>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', padding: 16 },
  back:         { width: 40, height: 40, justifyContent: 'center' },
  title:        { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card:         { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16, marginBottom: 14 },
  plannedCard:  { borderColor: `${Colors.pu}66`, backgroundColor: Colors.c2 },
  sectionTitle: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.mu, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  label:        { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', marginTop: 10, marginBottom: 6 },
  big:          { fontSize: Fonts.sizes.xxl, fontWeight: '900', color: Colors.go, marginTop: 2 },
  plannedTitle: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  plannedDate:  { fontSize: Fonts.sizes.md, color: Colors.wh, marginTop: 2 },
  divider:      { height: 1, backgroundColor: Colors.bd, marginVertical: 14 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTxt:       { flex: 1, fontSize: Fonts.sizes.md, color: Colors.wh },
  hint:         { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18, marginTop: 10 },
  input:        { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.sm, padding: 12, color: Colors.wh, fontSize: Fonts.sizes.md, marginTop: 6 },
  btnPrimary:   { backgroundColor: Colors.pu, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 14 },
  btnPrimaryTxt:{ fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  btnOff:       { opacity: 0.4 },
  btnGhost:     { alignItems: 'center', paddingVertical: 12, marginTop: 6 },
  btnGhostTxt:  { fontSize: Fonts.sizes.sm, color: Colors.red, fontWeight: '600' },
});
