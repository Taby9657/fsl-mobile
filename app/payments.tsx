import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, Linking, Image, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBack } from '../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi, matchesApi } from '../services/api';
import { SkeletonBlock } from '../components/SkeletonCard';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';

type PayStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';

interface PlayerPayment {
  id: string;
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

const BANK_IBAN = 'CZ6508000000192000145399';
const BANK_BIC  = 'GIBACZPX';

function spdQrUrl(vs: string, amount: number, msg: string): string {
  const spd = `SPD*1.0*ACC:${BANK_IBAN}+${BANK_BIC}*AM:${amount}.00*CC:CZK*X-VS:${vs}*MSG:${msg}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(spd)}&bgcolor=0d0120&color=c9a140&qzone=1&format=png`;
}

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

function TransferBox({ vs, amount, msg = 'FSL poplatek' }: { vs: string; amount: number; msg?: string }) {
  return (
    <View style={s.transferBox}>
      <Text style={s.transferTitle}>Platba převodem</Text>
      <View style={s.transferInner}>
        <View style={{ flex: 1 }}>
          <InfoRow label="IBAN"               value={BANK_IBAN} copyable />
          <InfoRow label="BIC/SWIFT"          value={BANK_BIC} copyable />
          <InfoRow label="Variabilní symbol"  value={vs} copyable />
          <InfoRow label="Částka"             value={`${amount} Kč`} />
        </View>
        <Image
          source={{ uri: spdQrUrl(vs, amount, msg) }}
          style={s.qrImg}
          resizeMode="contain"
        />
      </View>
      <Text style={s.transferHint}>Naskenuj QR kód v bankovní aplikaci pro rychlou platbu</Text>
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

  useEffect(() => { load(); }, []);

  async function load(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const [payRes, matchRes] = await Promise.allSettled([
        paymentsApi.me(),
        isManager && managerTeamId
          ? matchesApi.list({ homeTeamId: managerTeamId, status: 'UPCOMING', limit: 20 })
          : Promise.resolve(null),
      ]);

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

  async function openStripe(type: 'player-license' | 'super-license') {
    setPaying(type);
    try {
      const res = type === 'player-license'
        ? await paymentsApi.playerLicense()
        : await paymentsApi.superLicense();
      const url: string = res.data.url;
      if (url) Linking.openURL(url);
    } catch (err: any) {
      Alert.alert('Chyba platby', err?.response?.data?.error ?? 'Zkontrolujte připojení a zkuste znovu.');
    } finally {
      setPaying(null);
    }
  }

  async function openHomeFee(matchId: string) {
    setPaying(matchId);
    try {
      const res = await paymentsApi.homeFee(matchId);
      const url: string = res.data.url;
      if (url) Linking.openURL(url);
    } catch (err: any) {
      Alert.alert('Chyba platby', err?.response?.data?.error ?? 'Zkontrolujte připojení a zkuste znovu.');
    } finally {
      setPaying(null);
    }
  }

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

            {player.licStatus === 'PENDING' && (
              <>
                <View style={s.hr} />
                <Pressable
                  style={[s.btn, { backgroundColor: Colors.go }]}
                  onPress={() => openStripe('player-license')}
                  disabled={!!paying}
                >
                  {paying === 'player-license'
                    ? <ActivityIndicator color={Colors.bg} size="small" />
                    : <><Ionicons name="card-outline" size={16} color={Colors.bg} /><Text style={[s.btnText, { color: Colors.bg }]}>Zaplatit kartou online</Text></>
                  }
                </Pressable>
                {player.variableSymbol && (
                  <TransferBox vs={player.variableSymbol} amount={player.licFee} msg="FSL hracska licence" />
                )}
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

            {player.superStatus === 'PENDING' && (
              <>
                <View style={s.hr} />
                <Pressable
                  style={[s.btn, { backgroundColor: Colors.pu }]}
                  onPress={() => openStripe('super-license')}
                  disabled={!!paying}
                >
                  {paying === 'super-license'
                    ? <ActivityIndicator color={Colors.wh} size="small" />
                    : <><Ionicons name="star-outline" size={16} color={Colors.wh} /><Text style={s.btnText}>Pořídit super licenci</Text></>
                  }
                </Pressable>
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

            {tp.status === 'PENDING' && tp.variableSymbol && (
              <TransferBox vs={tp.variableSymbol} amount={tp.amount} msg="FSL registrace tymu" />
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
                <View key={m.id} style={[s.matchRow, i > 0 && s.matchRowBorder]}>
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
                      style={[s.payBtn, paying === m.id && { opacity: 0.6 }]}
                      onPress={() => openHomeFee(m.id)}
                      disabled={!!paying}
                    >
                      {paying === m.id
                        ? <ActivityIndicator color={Colors.wh} size="small" style={{ width: 52 }} />
                        : <Text style={s.payBtnText}>Zaplatit</Text>
                      }
                    </Pressable>
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
  payBtn:        { backgroundColor: Colors.red, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  payBtnText:    { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
});
