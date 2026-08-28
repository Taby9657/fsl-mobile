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

type PayStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';

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

interface TeamPayment {
  id: string;
  teamId: string;
  season: string;
  amount: number;
  status: PayStatus;
  paidAt: string | null;
  variableSymbol: string | null;
}

interface HomeMatch {
  id: string;
  date: string;
  awayTeam: { name: string; abbr: string; color: string };
  homeFeePaid: boolean;
  venue: string | null;
}

const STATUS_LABEL: Record<PayStatus, string> = {
  PENDING: 'Čeká na platbu',
  PAID:    'Zaplaceno',
  OVERDUE: 'Po splatnosti',
  WAIVED:  'Odpuštěno',
};

const STATUS_COLOR: Record<PayStatus, string> = {
  PENDING: '#F59E0B',
  PAID:    Colors.green,
  OVERDUE: Colors.red,
  WAIVED:  Colors.mu,
};

const STATUS_ICON: Record<PayStatus, keyof typeof Ionicons.glyphMap> = {
  PENDING: 'time-outline',
  PAID:    'checkmark-circle',
  OVERDUE: 'alert-circle',
  WAIVED:  'shield-checkmark-outline',
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
  const [homeMatches, setHomeMatches] = useState<HomeMatch[]>([]);
  const [paying, setPaying]         = useState<string | null>(null); // matchId or 'player-license' etc.
  const [openMatch, setOpenMatch]   = useState<string | null>(null);
  const [methods, setMethods]       = useState<{ card: boolean; wallet: boolean; transfer: boolean } | undefined>(undefined);

  useEffect(() => { load(); }, []);

  async function load(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const [payRes, matchRes, methodsRes] = await Promise.allSettled([
        paymentsApi.me(),
        isManager && managerTeamId
          ? matchesApi.list({ homeTeamId: managerTeamId, status: 'UPCOMING', limit: 20 })
          : Promise.resolve(null),
        paymentsApi.methods(),
      ]);

      if (methodsRes.status === 'fulfilled' && methodsRes.value) {
        setMethods(methodsRes.value.data);
      }

      if (payRes.status === 'fulfilled') {
        setPlayer(payRes.value.data.playerPayment ?? null);
        const tp = payRes.value.data.teamPayment;
        if (tp) setTeams(Array.isArray(tp) ? tp : [tp]);
      }

      if (matchRes.status === 'fulfilled' && matchRes.value) {
        const sorted = [...(matchRes.value.data ?? [])].sort(
          (a: HomeMatch, b: HomeMatch) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setHomeMatches(sorted);
      }
    } catch {
      if (!isRefresh) Alert.alert('Chyba', 'Nepodařilo se načíst platby');
    } finally {
      setLoading(false);
      setRefresh(false);
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
  const openHomeFee  = (matchId: string) => runCheckout(matchId, () => paymentsApi.homeFee(matchId));
  const openTeamReg  = (teamId: string)  => runCheckout(`team-${teamId}`, () => paymentsApi.teamRegistration(teamId));

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

  const hasData = player || teams.length > 0 || isManager;

  return (
    <SafeAreaView style={s.safe}>
      <Header />
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(true); }} tintColor={Colors.go} />}
      >

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

        {/* ── DOMÁCÍ ZÁPASY – poplatky (vedoucí) ── */}
        {isManager && (
          <View style={[s.card, { marginTop: 12 }]}>
            <View style={s.cardHeader}>
              <View style={[s.iconBox, { backgroundColor: `${Colors.red}22` }]}>
                <Ionicons name="home" size={18} color={Colors.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Poplatky za domácí zápasy</Text>
                <Text style={s.cardSub}>2 200 Kč / zápas · do 48 h před zápasem</Text>
              </View>
            </View>

            <View style={s.hr} />

            {homeMatches.length === 0 ? (
              <Text style={[s.infoLabel, { textAlign: 'center', paddingVertical: 8 }]}>
                Žádné nadcházející domácí zápasy
              </Text>
            ) : (
              homeMatches.map((m, i) => (
                <View key={m.id} style={i > 0 ? s.matchRowBorder : undefined}>
                  <View style={s.matchRow}>
                    {/* Soupeř + datum */}
                    <View style={s.matchBadge}>
                      <Text style={s.matchAbbr}>{m.awayTeam.abbr}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.matchName}>vs {m.awayTeam.name}</Text>
                      <Text style={s.matchDate}>{formatMatchDate(m.date)}{m.venue ? ` · ${m.venue}` : ''}</Text>
                    </View>

                    {/* Stav / tlačítko */}
                    {m.homeFeePaid ? (
                      <View style={s.paidBadge}>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.green} />
                        <Text style={s.paidText}>Zaplaceno</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={s.payBtn}
                        onPress={() => setOpenMatch(openMatch === m.id ? null : m.id)}
                      >
                        <Text style={s.payBtnText}>{openMatch === m.id ? 'Skrýt' : 'Zaplatit'}</Text>
                        <Ionicons
                          name={openMatch === m.id ? 'chevron-up' : 'chevron-down'}
                          size={13}
                          color={Colors.wh}
                        />
                      </Pressable>
                    )}
                  </View>

                  {!m.homeFeePaid && openMatch === m.id && (
                    <View style={{ paddingBottom: 12 }}>
                      <PayOptions
                        qrType="home-fee"
                        qrId={m.id}
                        amount={2200}
                        accent={Colors.red}
                        accentText={Colors.wh}
                        busy={paying === m.id}
                        disabled={!!paying}
                        methods={methods}
                        onCheckout={() => openHomeFee(m.id)}
                      />
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

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
