import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBack } from '../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi, matchesApi } from '../services/api';
import { SkeletonBlock } from '../components/SkeletonCard';
import { useAuthStore } from '../store/auth';
import PayOptions from '../components/PayOptions';
import { Colors, Fonts, Radius } from '../constants/colors';

type PayStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED' | 'REFUNDED';

interface PlayerPayment {
  id: string;
  playerId: string;
  season: string;
  licFee: number;
  licStatus: PayStatus;
  licPaidAt: string | null;
  licMethod: string | null;
  superLic: boolean;
  superFee: number;
  superStatus: PayStatus;
  superPaidAt: string | null;
  variableSymbol: string | null;
}

interface Fine {
  id: string;
  teamId: string;
  season: string;
  amount: number;
  paidAmount: number;
  reason: string;
  status: PayStatus;
  variableSymbol: string | null;
  team?: { id: string; name: string; abbr: string };
}

interface TeamPayment {
  id: string;
  teamId: string;
  season: string;
  amount: number;
  status: PayStatus;
  paidAt: string | null;
  variableSymbol: string | null;
}

const STATUS_LABEL: Record<PayStatus, string> = {
  PENDING: 'Čeká na platbu',
  PAID:    'Zaplaceno',
  OVERDUE: 'Po splatnosti',
  WAIVED:  'Odpuštěno',
  REFUNDED:'Vráceno',
};

const STATUS_COLOR: Record<PayStatus, string> = {
  PENDING: '#F59E0B',
  PAID:    Colors.green,
  OVERDUE: Colors.red,
  WAIVED:  Colors.mu,
  REFUNDED:Colors.mu,
};

const STATUS_ICON: Record<PayStatus, keyof typeof Ionicons.glyphMap> = {
  PENDING: 'time-outline',
  PAID:    'checkmark-circle',
  OVERDUE: 'alert-circle',
  WAIVED:  'shield-checkmark-outline',
  REFUNDED:'arrow-undo-outline',
};

function StatusChip({ status }: { status: PayStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <View style={[chip.wrap, { backgroundColor: `${color}22`, borderColor: color }]}>
      <Ionicons name={STATUS_ICON[status]} size={12} color={color} />
      <Text style={[chip.text, { color }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}
const chip = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  text: { fontSize: Fonts.sizes.xs, fontWeight: '600' },
});

function InfoRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} selectable={copyable}>{value}</Text>
    </View>
  );
}

function formatMatchDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
}

export default function PaymentsScreen() {
  const { user } = useAuthStore();
  const isManager = (user?.manager?.length ?? 0) > 0;
  const managerTeamId = user?.manager?.[0]?.teamId ?? null;

  const [loading, setLoading]       = useState(true);
  const [refresh, setRefresh]       = useState(false);
  const [player, setPlayer]         = useState<PlayerPayment | null>(null);
  const [teams, setTeams]           = useState<TeamPayment[]>([]);
  // Pokuty za kontumaci. Do zaplacení tým další zápas nerozehraje.
  const [fines, setFines]           = useState<Fine[]>([]);
  const [paying, setPaying]         = useState<string | null>(null); // matchId or 'player-license' etc.
  const [methods, setMethods]       = useState<{ card: boolean; wallet: boolean; transfer: boolean } | undefined>(undefined);
  // Balíčky zápasů — zápasy si platí hráč, ne tým.
  const [packs, setPacks]           = useState<any>(null);
  const [odhlasuje, setOdhlasuje]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const [payRes, methodsRes, packsRes] = await Promise.allSettled([
        paymentsApi.me(),
        paymentsApi.methods(),
        paymentsApi.packs(),
      ]);

      if (packsRes.status === 'fulfilled' && packsRes.value) setPacks(packsRes.value.data);

      if (methodsRes.status === 'fulfilled' && methodsRes.value) {
        setMethods(methodsRes.value.data);
      }

      if (payRes.status === 'fulfilled') {
        setPlayer(payRes.value.data.playerPayment ?? null);
        const tp = payRes.value.data.teamPayment;
        if (tp) setTeams(Array.isArray(tp) ? tp : [tp]);
        setFines(payRes.value.data.fines ?? []);
      }

    } catch {
      if (!isRefresh) Alert.alert('Chyba', 'Nepodařilo se načíst platby');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }

  /** Odhlášení ze zápasu. Do uzávěrky se start vrátí, potom propadá. */
  async function odhlasSe(polozka: any) {
    const lhuta = packs?.withdrawalHours ?? 12;
    const potvrd = () => new Promise<boolean>((resolve) => {
      Alert.alert(
        'Odhlásit se ze zápasu',
        polozka.locked
          ? `Do výkopu zbývá míň než ${lhuta} h, takže ti tenhle zápas z balíčku propadne. `
            + 'Když se na něj vrátíš, nic dalšího se ti nestrhne.'
          : 'Start se ti vrátí zpátky do balíčku.',
        [
          { text: 'Zpět', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Odhlásit se', style: 'destructive', onPress: () => resolve(true) },
        ],
      );
    });
    if (!await potvrd()) return;

    setOdhlasuje(polozka.matchId);
    try {
      const r = await matchesApi.withdraw(polozka.matchId);
      await load(true);
      Alert.alert(
        r.data.refunded ? 'Odhlášeno' : 'Odhlášeno — zápas propadá',
        r.data.refunded
          ? `Start se ti vrátil. Zbývá ${r.data.remaining} zápasů v balíčku.`
          : (r.data.note ?? 'Odhlášení po uzávěrce start nevrací.'),
      );
    } catch (err: any) {
      Alert.alert('Nepodařilo se odhlásit', err?.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setOdhlasuje(null);
    }
  }

  // Stripe Checkout otevíráme v systémovém prohlížeči (SFSafariViewController /
  // Custom Tabs) – jen tam funguje Apple Pay i Google Pay. Po zavření obnovíme stav.
  async function runCheckout(key: string, call: () => Promise<any>) {
    setPaying(key);
    try {
      const res = await call();
      const url: string = res.data?.url;
      if (!url) throw new Error('no url');
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        dismissButtonStyle: 'close',
        toolbarColor: Colors.bg,
        controlsColor: Colors.go,
      });
      await load(true);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      Alert.alert(
        'Platba online není dostupná',
        code === 'STRIPE_NOT_CONFIGURED'
          ? 'Kartu ani peněženku teď nejde použít. Zaplať prosím převodem – údaje i QR kód najdeš pod tlačítkem „Zaplatit převodem".'
          : (err?.response?.data?.error ?? 'Zkontroluj připojení a zkus to znovu. Případně použij platbu převodem.'),
      );
    } finally {
      setPaying(null);
    }
  }

  const openStripe   = (type: 'player-license' | 'super-license') =>
    runCheckout(type, () => type === 'player-license' ? paymentsApi.playerLicense() : paymentsApi.superLicense());
  const openTeamReg  = (teamId: string)  => runCheckout(`team-${teamId}`, () => paymentsApi.teamRegistration(teamId));
  const openFine     = (fineId: string)  => runCheckout(`fine-${fineId}`, () => paymentsApi.fine(fineId));

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {[1, 2, 3].map(i => (
          <View key={i} style={[s.card, { gap: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <SkeletonBlock width={36} height={36} style={{ borderRadius: 8 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <SkeletonBlock width="50%" height={14} />
                <SkeletonBlock width="30%" height={10} />
              </View>
              <SkeletonBlock width={80} height={24} style={{ borderRadius: 12 }} />
            </View>
            <SkeletonBlock width="100%" height={1} />
            <SkeletonBlock width="60%" height={12} />
            <SkeletonBlock width="80%" height={44} style={{ borderRadius: 8 }} />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );

  const hasData = player || teams.length > 0 || fines.length > 0 || isManager;

  return (
    <SafeAreaView style={s.safe}>
      <Header />
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(true); }} tintColor={Colors.go} />}
      >

        {/* ── BALÍČKY ZÁPASŮ ── */}
        {packs && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.iconBox}>
                <Ionicons name="ticket-outline" size={18} color={Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Balíčky zápasů</Text>
                <Text style={s.cardSub}>odehraný zápas odečte jeden start</Text>
              </View>
            </View>

            <View style={s.hr} />
            <Text style={s.zbyva}>{packs.remaining ?? 0}</Text>
            <Text style={s.zbyvaPopis}>zbývá v balíčku</Text>

            <View style={s.balicky}>
              {(packs.catalog ?? []).map((b: any) => (
                <Pressable
                  key={b.size}
                  style={[s.balicek, paying === `pack-${b.size}` && { opacity: 0.5 }]}
                  disabled={!!paying}
                  onPress={() => runCheckout(`pack-${b.size}`, () => paymentsApi.buyPack(b.size))}
                >
                  <Text style={s.balicekPocet}>
                    {b.size} {b.size === 1 ? 'zápas' : b.size < 5 ? 'zápasy' : 'zápasů'}
                  </Text>
                  <Text style={s.balicekCena}>{b.price} Kč</Text>
                  <Text style={s.balicekZa}>{Math.round(b.price / b.size)} Kč / zápas</Text>
                </Pressable>
              ))}
            </View>

            {(packs.upcoming ?? []).length > 0 && (
              <>
                <View style={s.hr} />
                <Text style={s.podnadpis}>Přihlášené zápasy</Text>
                {packs.upcoming.map((e: any) => {
                  const souper = e.teamId === e.match.homeTeam?.id ? e.match.awayTeam : e.match.homeTeam;
                  return (
                    <View key={e.matchId} style={s.prihlaseny}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.name}>{souper?.name ?? 'Soupeř'}</Text>
                        <Text style={s.pos}>
                          {formatMatchDate(e.match.date)}
                          {e.locked ? ' · po uzávěrce' : ''}
                        </Text>
                      </View>
                      <Pressable
                        style={[s.odhlasitBtn, odhlasuje === e.matchId && { opacity: 0.5 }]}
                        disabled={!!odhlasuje}
                        onPress={() => odhlasSe(e)}
                      >
                        <Text style={s.odhlasitTxt}>Odhlásit</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* ── HRÁČSKÁ LICENCE ── */}
        {player && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <View style={s.iconBox}>
                <Ionicons name="card" size={18} color={Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Hráčská licence</Text>
                <Text style={s.cardSub}>{player.season}</Text>
              </View>
              <StatusChip status={player.licStatus} />
            </View>

            <View style={s.hr} />
            <InfoRow label="Výše poplatku" value={`${player.licFee} Kč`} />
            {player.licPaidAt && (
              <InfoRow label="Datum platby" value={new Date(player.licPaidAt).toLocaleDateString('cs-CZ')} />
            )}
            {player.licMethod && (
              <InfoRow label="Metoda" value={player.licMethod === 'stripe' ? 'Karta online' : 'Bankovní převod'} />
            )}

            {(player.licStatus === 'PENDING' || player.licStatus === 'OVERDUE') && (
              <>
                <View style={s.hr} />
                <PayOptions
                  qrType="player-license"
                  qrId={player.playerId}
                  amount={player.licFee}
                  accent={Colors.go}
                  accentText={Colors.bg}
                  busy={paying === 'player-license'}
                  disabled={!!paying}
                  methods={methods}
                  onCheckout={() => openStripe('player-license')}
                />
              </>
            )}
          </View>
        )}

        {/* ── SUPER LICENCE ── */}
        {player && (
          <View style={[s.card, { marginTop: 12 }]}>
            <View style={s.cardHeader}>
              <View style={[s.iconBox, { backgroundColor: `${Colors.pu}22` }]}>
                <Ionicons name="star" size={18} color={Colors.pu} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Super licence</Text>
                <Text style={s.cardSub}>Hraní i za cizí týmy</Text>
              </View>
              <StatusChip status={player.superStatus} />
            </View>

            <View style={s.hr} />
            <Text style={s.superPopis}>
              Se superlicencí smíš v základní části nastupovat až za 3 týmy a v playoff
              za dva, které si po základní části zvolíš. Otevírá ti taky draft pool.
            </Text>
            <InfoRow label="Výše poplatku" value={`${player.superFee} Kč`} />
            {player.superPaidAt && (
              <InfoRow label="Datum platby" value={new Date(player.superPaidAt).toLocaleDateString('cs-CZ')} />
            )}

            {(player.superStatus === 'PENDING' || player.superStatus === 'OVERDUE') && (
              <>
                <View style={s.hr} />
                <PayOptions
                  qrType="super-license"
                  qrId={player.playerId}
                  amount={player.superFee}
                  accent={Colors.pu}
                  accentText={Colors.wh}
                  busy={paying === 'super-license'}
                  disabled={!!paying}
                  methods={methods}
                  onCheckout={() => openStripe('super-license')}
                />
              </>
            )}
          </View>
        )}

        {/* Vysvětlení pravidel */}
        <Pressable style={s.pravidlaBtn} onPress={() => router.push('/licence' as any)}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.go} />
          <Text style={s.pravidlaTxt}>Jak licence fungují</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.di} />
        </Pressable>

        {/* ── REGISTRACE TÝMU (vedoucí) ── */}
        {teams.map(tp => (
          <View style={[s.card, { marginTop: 12 }]} key={tp.id}>
            <View style={s.cardHeader}>
              <View style={[s.iconBox, { backgroundColor: 'rgba(99,179,237,0.15)' }]}>
                <Ionicons name="trophy" size={18} color="#63B3ED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Registrace týmu</Text>
                <Text style={s.cardSub}>{tp.season}</Text>
              </View>
              <StatusChip status={tp.status} />
            </View>

            <View style={s.hr} />
            <InfoRow label="Výše poplatku" value={`${tp.amount} Kč`} />
            {tp.paidAt && (
              <InfoRow label="Datum platby" value={new Date(tp.paidAt).toLocaleDateString('cs-CZ')} />
            )}

            {(tp.status === 'PENDING' || tp.status === 'OVERDUE') && (
              <>
                <View style={s.hr} />
                <PayOptions
                  qrType="team-reg"
                  qrId={tp.teamId}
                  amount={tp.amount}
                  accent="#63B3ED"
                  accentText={Colors.bg}
                  busy={paying === `team-${tp.teamId}`}
                  disabled={!!paying}
                  methods={methods}
                  onCheckout={() => openTeamReg(tp.teamId)}
                />
              </>
            )}
          </View>
        ))}

        {/* ── POKUTY ZA KONTUMACI (vedoucí) ── */}
        {fines.map(f => (
          <View style={[s.card, { marginTop: 12, borderColor: Colors.red }]} key={f.id}>
            <View style={s.cardHeader}>
              <View style={[s.iconBox, { backgroundColor: `${Colors.red}22` }]}>
                <Ionicons name="hammer" size={18} color={Colors.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Pokuta za kontumaci</Text>
                <Text style={s.cardSub}>{f.team?.name ?? f.season}</Text>
              </View>
              <StatusChip status={f.status} />
            </View>

            <View style={s.hr} />
            <InfoRow label="Výše pokuty" value={`${f.amount} Kč`} />
            {f.paidAmount > 0 && <InfoRow label="Zatím uhrazeno" value={`${f.paidAmount} Kč`} />}
            <Text style={[s.cardSub, { marginTop: 8 }]}>
              {f.reason} Dokud není zaplacená, rozhodčí týmu další zápas nespustí.
            </Text>

            <View style={s.hr} />
            <PayOptions
              qrType="fine"
              qrId={f.id}
              amount={f.amount - f.paidAmount}
              accent={Colors.red}
              accentText={Colors.wh}
              busy={paying === `fine-${f.id}`}
              disabled={!!paying}
              methods={methods}
              onCheckout={() => openFine(f.id)}
            />
          </View>
        ))}

        {/* Poplatek za domácí zápas (2 200 Kč) skončil 9. 9. 2026.
            Zápasy si platí hráči sami v balíčku startů — sekce Balíčky
            zápasů výš. */}

        {/* ── PRÁZDNÝ STAV ── */}
        {!hasData && (
          <View style={[s.center, { marginTop: 80 }]}>
            <Ionicons name="card-outline" size={48} color={Colors.mu} />
            <Text style={s.emptyTitle}>Žádné platby</Text>
            <Text style={s.emptyDesc}>Platby se zobrazí po registraci do týmu nebo jako vedoucí.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={s.header}>
      <Pressable onPress={() => goBack()} style={s.back}>
        <Ionicons name="chevron-back" size={24} color={Colors.wh} />
      </Pressable>
      <Text style={s.title}>Platby</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const s = StyleSheet.create({
  superPopis:  { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18, marginBottom: 10 },
  pravidlaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, marginTop: 12 },
  pravidlaTxt: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  safe:         { flex: 1, backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:         { width: 40, height: 40, justifyContent: 'center' },
  title:        { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  center:       { alignItems: 'center', gap: 12 },
  emptyTitle:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  emptyDesc:    { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' },
  card:         { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox:      { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center' },
  cardTitle:    { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  cardSub:      { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  hr:           { height: 1, backgroundColor: Colors.bd, marginVertical: 12 },

  // Balíčky zápasů
  zbyva:        { fontSize: 30, fontWeight: '800', color: Colors.wh, textAlign: 'center' },
  zbyvaPopis:   { fontSize: 12, color: Colors.mu, textAlign: 'center', marginTop: 2, marginBottom: 14 },
  balicky:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  balicek:      { flexGrow: 1, minWidth: 96, backgroundColor: Colors.c2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 12 },
  balicekPocet: { fontSize: 11, fontWeight: '700', color: Colors.mu, letterSpacing: 0.6, textTransform: 'uppercase' },
  balicekCena:  { fontSize: 17, fontWeight: '800', color: Colors.wh, marginTop: 3 },
  balicekZa:    { fontSize: 11, color: Colors.mu, marginTop: 1 },
  podnadpis:    { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: Colors.mu, textTransform: 'uppercase', marginBottom: 8 },
  prihlaseny:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  name:         { fontSize: 14, fontWeight: '600', color: Colors.wh },
  pos:          { fontSize: 12, color: Colors.mu, marginTop: 1 },
  odhlasitBtn:  { borderWidth: 1, borderColor: Colors.red, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  odhlasitTxt:  { fontSize: 12, fontWeight: '700', color: Colors.red },
  infoRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  infoLabel:    { fontSize: Fonts.sizes.sm, color: Colors.mu, flex: 1, lineHeight: 18 },
  infoValue:    { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '500' },
  btn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: Radius.md },
  btnText:      { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  transferBox:   { backgroundColor: Colors.c2, borderRadius: Radius.sm, padding: 12, marginTop: 10 },
  transferTitle: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.mu, marginBottom: 8 },
  transferInner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  transferHint:  { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 10, textAlign: 'center' },
  qrImg:         { width: 100, height: 100, borderRadius: Radius.sm, backgroundColor: Colors.bg },
  // Domácí zápasy
  matchRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  matchRowBorder:{ borderTopWidth: 1, borderTopColor: Colors.bd },
  matchBadge:    { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.c2, justifyContent: 'center', alignItems: 'center' },
  matchAbbr:     { fontSize: Fonts.sizes.xs, fontWeight: '900', color: Colors.go },
  matchName:     { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  matchDate:     { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  paidBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paidText:      { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.green },
  payBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.red, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  payBtnText:    { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
});
