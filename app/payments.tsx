import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBack } from '../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';

type PayStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXEMPT';

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

const STATUS_LABEL: Record<PayStatus, string> = {
  PENDING: 'Čeká na platbu',
  PAID:    'Zaplaceno',
  FAILED:  'Neúspěšná platba',
  EXEMPT:  'Osvobozeno',
};

const STATUS_COLOR: Record<PayStatus, string> = {
  PENDING: '#F59E0B',
  PAID:    Colors.green,
  FAILED:  Colors.red,
  EXEMPT:  Colors.mu,
};

const STATUS_ICON: Record<PayStatus, keyof typeof Ionicons.glyphMap> = {
  PENDING: 'time-outline',
  PAID:    'checkmark-circle',
  FAILED:  'close-circle',
  EXEMPT:  'shield-checkmark-outline',
};

const BANK_IBAN = 'CZ6508000000192000145399';
const BANK_BIC  = 'GIBACZPX';

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

function TransferBox({ vs, amount }: { vs: string; amount: number }) {
  return (
    <View style={s.transferBox}>
      <Text style={s.transferTitle}>Platba převodem</Text>
      <InfoRow label="Číslo účtu (IBAN)" value={BANK_IBAN} copyable />
      <InfoRow label="BIC/SWIFT"          value={BANK_BIC} copyable />
      <InfoRow label="Variabilní symbol"  value={vs} copyable />
      <InfoRow label="Částka"             value={`${amount} Kč`} />
    </View>
  );
}

export default function PaymentsScreen() {
  const { user } = useAuthStore();
  const isManager = (user?.manager?.length ?? 0) > 0;

  const [loading, setLoading] = useState(true);
  const [player, setPlayer]   = useState<PlayerPayment | null>(null);
  const [teams, setTeams]     = useState<TeamPayment[]>([]);
  const [paying, setPaying]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const res = await paymentsApi.me();
      setPlayer(res.data.playerPayment ?? null);
      const tp = res.data.teamPayment;
      if (tp) setTeams(Array.isArray(tp) ? tp : [tp]);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst platby');
    } finally {
      setLoading(false);
    }
  }

  async function openStripe(type: 'player-license' | 'super-license' | 'home-fee') {
    setPaying(type);
    try {
      let res;
      if (type === 'player-license') res = await paymentsApi.playerLicense();
      else if (type === 'super-license') res = await paymentsApi.superLicense();
      else res = await paymentsApi.homeFee('');
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
      <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
    </SafeAreaView>
  );

  const hasData = player || teams.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 16 }}>

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
                  <TransferBox vs={player.variableSymbol} amount={player.licFee} />
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
                <Text style={s.cardSub}>Play-off a pohárová soutěž</Text>
              </View>
              <StatusChip status={player.superStatus} />
            </View>

            <View style={s.hr} />
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
                    ? <ActivityIndicator color={Colors.white} size="small" />
                    : <><Ionicons name="star-outline" size={16} color={Colors.white} /><Text style={s.btnText}>Pořídit super licenci</Text></>
                  }
                </Pressable>
              </>
            )}
          </View>
        )}

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
              <TransferBox vs={tp.variableSymbol} amount={tp.amount} />
            )}
          </View>
        ))}

        {/* ── DOMÁCÍ ZÁPAS (vedoucí) ── */}
        {isManager && (
          <View style={[s.card, { marginTop: 12 }]}>
            <View style={s.cardHeader}>
              <View style={[s.iconBox, { backgroundColor: `${Colors.red}22` }]}>
                <Ionicons name="home" size={18} color={Colors.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Poplatek za domácí zápas</Text>
                <Text style={s.cardSub}>2 200 Kč / zápas</Text>
              </View>
            </View>
            <View style={s.hr} />
            <Text style={s.infoLabel}>
              Poplatek se hradí nejpozději 48 hodin před domácím zápasem.
              Po zaplacení obdržíte potvrzení e-mailem.
            </Text>
            <Pressable
              style={[s.btn, { backgroundColor: Colors.red, marginTop: 12 }]}
              onPress={() => openStripe('home-fee')}
              disabled={!!paying}
            >
              {paying === 'home-fee'
                ? <ActivityIndicator color={Colors.white} size="small" />
                : <><Ionicons name="cash-outline" size={16} color={Colors.white} /><Text style={s.btnText}>Zaplatit kartou</Text></>
              }
            </Pressable>
          </View>
        )}

        {/* ── PRÁZDNÝ STAV ── */}
        {!hasData && (
          <View style={[s.center, { marginTop: 80 }]}>
            <Ionicons name="card-outline" size={48} color={Colors.mu} />
            <Text style={s.emptyTitle}>Žádné platby</Text>
            <Text style={s.emptyDesc}>Zatím nemáš žádný hráčský profil ani roli vedoucího.</Text>
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
  infoValueRow: { flexDirection: 'row', alignItems: 'center' },
  infoValue:    { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '500' },
  btn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: Radius.md },
  btnText:      { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.white },
  transferBox:  { backgroundColor: Colors.c2, borderRadius: Radius.sm, padding: 12, marginTop: 10 },
  transferTitle:{ fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.mu, marginBottom: 8 },
  infoValueRow: { flexDirection: 'row', alignItems: 'center' },
});
