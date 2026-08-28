/**
 * Licence — vysvětlení pravidel a volba týmů pro playoff.
 *
 * Dvě části: pro hráče (co si kupuju a kde smím hrát) a pro vedoucího
 * (koho smím napsat na soupisku). Hráč tu zároveň vidí svoje starty
 * a po základní části si vybírá primární a sekundární tým do playoff.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { licenceApi, type LicenceOverview } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';

type Tab = 'hrac' | 'vedouci';

// ─── stavební kameny ─────────────────────────────────────────────────────────

function Sekce({ ikona, nadpis, children }: {
  ikona: keyof typeof Ionicons.glyphMap; nadpis: string; children: React.ReactNode;
}) {
  return (
    <View style={s.sekce}>
      <View style={s.sekceHead}>
        <Ionicons name={ikona} size={16} color={Colors.go} />
        <Text style={s.sekceTitle}>{nadpis}</Text>
      </View>
      {children}
    </View>
  );
}

function Odstavec({ children }: { children: React.ReactNode }) {
  return <Text style={s.p}>{children}</Text>;
}

function Bod({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bod}>
      <View style={s.odrazka} />
      <Text style={s.bodTxt}>{children}</Text>
    </View>
  );
}

// ─── obrazovka ───────────────────────────────────────────────────────────────

export default function LicenceScreen() {
  const user = useAuthStore(st => st.user);
  const jeVedouci = (user?.manager?.length ?? 0) > 0;

  const [tab, setTab]         = useState<Tab>('hrac');
  const [data, setData]       = useState<LicenceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [ukladam, setUkladam] = useState(false);

  const [primarni, setPrimarni]     = useState<string | null>(null);
  const [sekundarni, setSekundarni] = useState<string | null>(null);

  const load = useCallback(async (jeRefresh = false) => {
    if (!jeRefresh) setLoading(true);
    try {
      const r = await licenceApi.me();
      setData(r.data);
      setPrimarni(r.data?.playoff?.choice?.primaryTeamId ?? null);
      setSekundarni(r.data?.playoff?.choice?.secondaryTeamId ?? null);
    } catch {
      // Bez hráčského profilu prostě ukážeme jen pravidla
      setData(null);
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  async function ulozVolbu() {
    if (!primarni) { Alert.alert('Vyber primární tým', 'Bez něj volbu uložit nejde.'); return; }
    setUkladam(true);
    try {
      await licenceApi.setPlayoff({ primaryTeamId: primarni, secondaryTeamId: sekundarni });
      await load(true);
      Alert.alert('Uloženo', 'Volba týmů pro playoff je zapsaná.');
    } catch (err: any) {
      Alert.alert('Nepodařilo se uložit', err?.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setUkladam(false);
    }
  }

  const naroky   = data?.playoff.eligibleTeams ?? [];
  const maSuper  = data?.superLic ?? false;
  const minStart = data?.minStarts ?? 3;
  const maxTymu  = data?.maxTeams ?? 3;

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Licence</Text>
        <View style={{ width: 40 }} />
      </View>

      {jeVedouci && (
        <View style={s.tabs}>
          {([['hrac', 'Pro hráče'], ['vedouci', 'Pro vedoucí']] as const).map(([k, label]) => (
            <Pressable key={k} style={[s.tab, tab === k && s.tabActive]} onPress={() => setTab(k)}>
              <Text style={[s.tabTxt, tab === k && s.tabTxtActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(true); }} tintColor={Colors.go} />}
      >

        {/* ══════════ PRO HRÁČE ══════════ */}
        {(tab === 'hrac' || !jeVedouci) && (
          <>
            {/* Stručně nahoře */}
            <View style={s.tldr}>
              <Text style={s.tldrTxt}>
                <Text style={s.tucne}>Hráčská licence</Text> tě opravňuje nastupovat za tvůj tým.{'\n'}
                <Text style={s.tucne}>Superlicence</Text> ti navíc dovolí hrát i za cizí týmy.
              </Text>
            </View>

            <Sekce ikona="card-outline" nadpis="Hráčská licence">
              <Odstavec>
                Základní poplatek na sezónu. Bez zaplacené licence tě vedoucí nesmí napsat
                na soupisku — systém takovou sestavu odmítne.
              </Odstavec>
              <Bod>Platí pro celou sezónu, ne pro jednotlivé zápasy.</Bod>
              <Bod>Vztahuje se na tvůj kmenový tým, tedy ten, kde jsi na soupisce.</Bod>
              <Bod>Zaplatit se dá kartou nebo převodem, každý hráč má svůj variabilní symbol.</Bod>
            </Sekce>

            <Sekce ikona="star-outline" nadpis="Superlicence">
              <Odstavec>
                Rozšíření nad rámec základní licence. Kupuje se jednou na sezónu a otevírá
                ti dveře do dalších týmů — hodí se, když chceš odehrát víc zápasů, vypomoct
                kamarádům nebo se ukázat víc týmům.
              </Odstavec>

              <View style={s.pravidlo}>
                <View style={s.pravidloHead}>
                  <Ionicons name="repeat-outline" size={15} color={Colors.pu} />
                  <Text style={s.pravidloTitle}>Základní část: až {maxTymu} týmy</Text>
                </View>
                <Text style={s.pravidloTxt}>
                  Se superlicencí smíš v základní části nastupovat celkem za {maxTymu} týmy —
                  svůj kmenový a další dva. Čtvrtý už systém do soupisky nepustí.
                </Text>
              </View>

              <View style={s.pravidlo}>
                <View style={s.pravidloHead}>
                  <Ionicons name="trophy-outline" size={15} color={Colors.pu} />
                  <Text style={s.pravidloTitle}>Playoff: dva týmy, ale postupně</Text>
                </View>
                <Text style={s.pravidloTxt}>
                  Po základní části si zvolíš <Text style={s.tucne}>primární</Text> a
                  volitelně <Text style={s.tucne}>sekundární</Text> tým. Vybírat můžeš jen
                  z týmů, za které jsi odehrál aspoň {minStart} zápasy základní části.
                </Text>
                <Text style={[s.pravidloTxt, { marginTop: 8 }]}>
                  Za sekundární tým smíš nastoupit <Text style={s.tucne}>teprve tehdy, když
                  tvůj primární tým v playoff skončí</Text>. Nikdy tak nehraješ dvě série
                  naráz, nemůžeš rozhodovat vzájemný zápas svých týmů a neřešíš kolizi termínů.
                </Text>
                <Text style={[s.pravidloTxt, { marginTop: 8, color: Colors.go }]}>
                  Prakticky to znamená, že když tvůj tým vypadne, sezóna ti nekončí.
                </Text>
              </View>

              <Bod>Volbu jde měnit, dokud playoff nezačne. Pak je uzamčená.</Bod>
              <Bod>Pokud se tvůj primární tým do playoff vůbec nedostane, sekundární máš volný hned.</Bod>
              <Bod>Superlicence tě také pouští do draft poolu, kde si tě můžou týmy samy oslovit.</Bod>
            </Sekce>

            {/* ── Můj stav ── */}
            {data && (
              <Sekce ikona="person-outline" nadpis={`Můj stav — ${data.season}`}>
                <View style={s.stavRadek}>
                  <Text style={s.stavLabel}>Hráčská licence</Text>
                  <Text style={[s.stavHod, { color: data.licStatus === 'PAID' || data.licStatus === 'WAIVED' ? Colors.green : Colors.red }]}>
                    {data.licStatus === 'PAID' ? 'Zaplaceno'
                      : data.licStatus === 'WAIVED' ? 'Odpuštěno' : 'Nezaplaceno'}
                  </Text>
                </View>
                <View style={s.stavRadek}>
                  <Text style={s.stavLabel}>Superlicence</Text>
                  <Text style={[s.stavHod, { color: maSuper ? Colors.green : Colors.mu }]}>
                    {maSuper ? 'Aktivní' : 'Nemáš'}
                  </Text>
                </View>

                {data.teams.length > 0 && (
                  <>
                    <Text style={s.podnadpis}>Kde letos hraješ</Text>
                    {data.teams.map(t => (
                      <View key={t.id} style={s.tymRadek}>
                        <View style={[s.tecka, { backgroundColor: t.color }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.tymNazev}>{t.name}</Text>
                          <Text style={s.tymMeta}>
                            {t.isHome ? 'kmenový tým' : 'hostování'} · {t.starts}{' '}
                            {t.starts === 1 ? 'start' : t.starts < 5 ? 'starty' : 'startů'}
                          </Text>
                        </View>
                        {t.playoffEligible && (
                          <View style={s.odznak}>
                            <Text style={s.odznakTxt}>playoff</Text>
                          </View>
                        )}
                      </View>
                    ))}
                    <Text style={s.pozn}>
                      Odznak „playoff" znamená, že máš za tým aspoň {minStart} starty,
                      takže si ho můžeš zvolit do playoff.
                    </Text>
                  </>
                )}

                {!maSuper && (
                  <Pressable style={s.cta} onPress={() => router.push('/payments' as any)}>
                    <Ionicons name="star" size={16} color={Colors.wh} />
                    <Text style={s.ctaTxt}>Pořídit superlicenci</Text>
                  </Pressable>
                )}
              </Sekce>
            )}

            {/* ── Volba pro playoff ── */}
            {data && maSuper && (
              <Sekce ikona="git-branch-outline" nadpis="Volba týmů pro playoff">
                {naroky.length === 0 ? (
                  <Odstavec>
                    Zatím nemáš za žádný tým {minStart} starty základní části. Jakmile je
                    nasbíráš, objeví se ti tady výběr.
                  </Odstavec>
                ) : (
                  <>
                    <Text style={s.podnadpis}>Primární tým</Text>
                    {naroky.map(t => (
                      <Pressable
                        key={t.id}
                        style={[s.volba, primarni === t.id && s.volbaActive]}
                        onPress={() => {
                          setPrimarni(t.id);
                          if (sekundarni === t.id) setSekundarni(null);
                        }}
                      >
                        <View style={[s.tecka, { backgroundColor: t.color }]} />
                        <Text style={[s.volbaTxt, primarni === t.id && s.volbaTxtActive]}>{t.name}</Text>
                        <Text style={[s.volbaMeta, primarni === t.id && { color: `${Colors.bg}99` }]}>
                          {t.starts} startů
                        </Text>
                      </Pressable>
                    ))}

                    <Text style={s.podnadpis}>Sekundární tým (nepovinné)</Text>
                    {naroky.filter(t => t.id !== primarni).map(t => (
                      <Pressable
                        key={t.id}
                        style={[s.volba, sekundarni === t.id && s.volbaActive]}
                        onPress={() => setSekundarni(sekundarni === t.id ? null : t.id)}
                      >
                        <View style={[s.tecka, { backgroundColor: t.color }]} />
                        <Text style={[s.volbaTxt, sekundarni === t.id && s.volbaTxtActive]}>{t.name}</Text>
                        <Text style={[s.volbaMeta, sekundarni === t.id && { color: `${Colors.bg}99` }]}>
                          {t.starts} startů
                        </Text>
                      </Pressable>
                    ))}
                    {naroky.filter(t => t.id !== primarni).length === 0 && (
                      <Text style={s.pozn}>Nárok máš zatím jen na jeden tým.</Text>
                    )}

                    {data.playoff.choice && (
                      <View style={[s.pravidlo, { marginTop: 14 }]}>
                        <Text style={s.pravidloTxt}>
                          Aktuálně máš uloženo: <Text style={s.tucne}>{data.playoff.choice.primary?.name}</Text>
                          {data.playoff.choice.secondary
                            ? <> a <Text style={s.tucne}>{data.playoff.choice.secondary.name}</Text>{' '}
                                ({data.playoff.secondaryUnlocked ? 'už odemčený' : 'zatím zamčený'})</>
                            : ' (bez sekundárního týmu)'}
                        </Text>
                      </View>
                    )}

                    <Pressable
                      style={[s.cta, { backgroundColor: Colors.go }, ukladam && { opacity: 0.6 }]}
                      onPress={ulozVolbu}
                      disabled={ukladam}
                    >
                      {ukladam
                        ? <ActivityIndicator color={Colors.bg} />
                        : <Text style={[s.ctaTxt, { color: Colors.bg }]}>Uložit volbu</Text>}
                    </Pressable>
                  </>
                )}
              </Sekce>
            )}
          </>
        )}

        {/* ══════════ PRO VEDOUCÍ ══════════ */}
        {tab === 'vedouci' && jeVedouci && (
          <>
            <View style={s.tldr}>
              <Text style={s.tldrTxt}>
                Na soupisku smíš napsat <Text style={s.tucne}>kmenové hráče s licencí</Text> a{' '}
                <Text style={s.tucne}>hostující hráče se superlicencí</Text>. Ostatní systém odmítne.
              </Text>
            </View>

            <Sekce ikona="clipboard-outline" nadpis="Koho smíš postavit">
              <Bod>
                Hráče ze své soupisky, kteří mají zaplacenou hráčskou licenci. To je základ —
                bez licence sestavu neuložíš.
              </Bod>
              <Bod>
                Hráče z jiného týmu, pokud má superlicenci a ještě nevyčerpal strop
                {' '}{maxTymu} týmů za sezónu.
              </Bod>
              <Bod>
                V playoff jen ty hostující hráče, kteří si tvůj tým zvolili jako primární —
                nebo jako sekundární a jejich primární tým už v playoff skončil.
              </Bod>
            </Sekce>

            <Sekce ikona="alert-circle-outline" nadpis="Proč mi sestava neprošla">
              <View style={s.duvod}>
                <Text style={s.duvodKod}>Hráč nemá platnou licenci</Text>
                <Text style={s.duvodTxt}>Nezaplacená hráčská licence. Řeší to hráč sám v sekci Platby.</Text>
              </View>
              <View style={s.duvod}>
                <Text style={s.duvodKod}>Za cizí tým jen se superlicencí</Text>
                <Text style={s.duvodTxt}>Píšeš hráče, který u tebe není kmenový a superlicenci nemá.</Text>
              </View>
              <View style={s.duvod}>
                <Text style={s.duvodKod}>Hráč už figuruje ve {maxTymu} týmech</Text>
                <Text style={s.duvodTxt}>Strop sezóny je vyčerpaný, tvůj tým by byl čtvrtý.</Text>
              </View>
              <View style={s.duvod}>
                <Text style={s.duvodKod}>Sekundární tým je zamčený</Text>
                <Text style={s.duvodTxt}>
                  Hráč si tě zvolil jako druhý tým, ale jeho primární tým je v playoff pořád ve hře.
                  Uvolní se, až skončí.
                </Text>
              </View>
              <View style={s.duvod}>
                <Text style={s.duvodKod}>Tenhle tým si hráč pro playoff nezvolil</Text>
                <Text style={s.duvodTxt}>
                  V základní části za tebe hrát mohl, do playoff si ale vybral jiné týmy.
                </Text>
              </View>
            </Sekce>

            <Sekce ikona="bulb-outline" nadpis="Na co myslet dopředu">
              <Bod>
                Chceš-li mít hostujícího hráče k dispozici i v playoff, musí za tebe odehrát
                aspoň {minStart} zápasy základní části. Domluvte se včas, po základní části
                už s tím nic neuděláš.
              </Bod>
              <Bod>
                Volba primárního a sekundárního týmu je na hráči, ne na tobě. Ty ji jen uvidíš
                v momentě, kdy ho zkusíš postavit.
              </Bod>
            </Sekce>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  title:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },

  tabs:        { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  tab:         { flex: 1, paddingVertical: 9, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center', backgroundColor: Colors.c1 },
  tabActive:   { backgroundColor: Colors.go, borderColor: Colors.go },
  tabTxt:      { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '700' },
  tabTxtActive:{ color: Colors.bg },

  tldr:    { backgroundColor: Colors.c2, borderRadius: Radius.md, borderWidth: 1, borderColor: `${Colors.go}44`, padding: 14, marginBottom: 16 },
  tldrTxt: { fontSize: Fonts.sizes.sm, color: Colors.wh, lineHeight: 21 },
  tucne:   { fontWeight: '800', color: Colors.go },

  sekce:      { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16, marginBottom: 12 },
  sekceHead:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sekceTitle: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.wh },

  p:       { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 21, marginBottom: 10 },
  bod:     { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 8 },
  odrazka: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.go, marginTop: 7 },
  bodTxt:  { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 20 },

  pravidlo:      { backgroundColor: Colors.c2, borderRadius: Radius.sm, padding: 12, marginTop: 12 },
  pravidloHead:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  pravidloTitle: { fontSize: Fonts.sizes.sm, fontWeight: '800', color: Colors.wh },
  pravidloTxt:   { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 20 },

  podnadpis: { fontSize: 10, color: Colors.di, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  stavRadek: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  stavLabel: { fontSize: Fonts.sizes.sm, color: Colors.mu },
  stavHod:   { fontSize: Fonts.sizes.sm, fontWeight: '700' },

  tymRadek:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: Colors.bd },
  tecka:     { width: 10, height: 10, borderRadius: 5 },
  tymNazev:  { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  tymMeta:   { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 1 },
  odznak:    { backgroundColor: `${Colors.pu}33`, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  odznakTxt: { fontSize: 10, color: Colors.pu, fontWeight: '800' },
  pozn:      { fontSize: Fonts.sizes.xs, color: Colors.di, lineHeight: 17, marginTop: 10 },

  volba:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd, marginBottom: 6 },
  volbaActive:  { backgroundColor: Colors.go, borderColor: Colors.go },
  volbaTxt:     { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  volbaTxtActive: { color: Colors.bg },
  volbaMeta:    { fontSize: Fonts.sizes.xs, color: Colors.mu },

  duvod:    { paddingVertical: 9, borderTopWidth: 1, borderTopColor: Colors.bd },
  duvodKod: { fontSize: Fonts.sizes.sm, color: Colors.red, fontWeight: '700', marginBottom: 3 },
  duvodTxt: { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18 },

  cta:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.pu, borderRadius: Radius.md, padding: 14, marginTop: 16 },
  ctaTxt: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
});
