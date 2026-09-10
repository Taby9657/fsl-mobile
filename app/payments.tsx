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

/**
 * Poplatky se od 10. 9. 2026 neplatí po jednom. Tlačítko proto jen přidává
 * do košíku — zaplatí se všechno naráz nahoře, což u každé další položky
 * ušetří pevný poplatek platební brány.
 */
function DoKosiku({
  jeUvnitr, busy, disabled, accent, accentText, onAdd,
}: {
  jeUvnitr: boolean; busy: boolean; disabled: boolean;
  accent: string; accentText: string; onAdd: () => void;
}) {
  if (jeUvnitr) {
    return (
      <View style={[dk.vKosiku, { borderColor: accent }]}>
        <Ionicons name="cart" size={15} color={accent} />
        <Text style={[dk.vKosikuTxt, { color: accent }]}>V košíku nahoře</Text>
      </View>
    );
  }
  return (
    <Pressable
      style={[dk.btn, { backgroundColor: accent }, (busy || disabled) && { opacity: 0.5 }]}
      disabled={busy || disabled}
      onPress={onAdd}
    >
      {busy
        ? <ActivityIndicator color={accentText} />
        : (
          <>
            <Ionicons name="cart-outline" size={16} color={accentText} />
            <Text style={[dk.btnTxt, { color: accentText }]}>Přidat do košíku</Text>
          </>
        )}
    </Pressable>
  );
}

const dk = StyleSheet.create({
  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: Radius.md },
  btnTxt:     { fontSize: Fonts.sizes.md, fontWeight: '700' },
  vKosiku:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: Radius.md, borderWidth: 1, borderStyle: 'dashed' },
  vKosikuTxt: { fontSize: Fonts.sizes.sm, fontWeight: '700' },
});

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
  // Košík: licence, superlicence, balíčky a registrace se od 10. 9. 2026
  // neplatí po jednom. Platební brána si bere pevný poplatek z každé
  // transakce, takže tři platby stojí ligu o dvakrát 6,50 Kč víc než jedna.
  // Pokuta za kontumaci zůstává mimo — blokuje týmu další zápas.
  const [kosik, setKosik]           = useState<any>(null);
  const [kosikBusy, setKosikBusy]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load(isRefresh = false) {
    if (!isRefresh) setLoading(true);
    try {
      const [payRes, methodsRes, packsRes, cartRes] = await Promise.allSettled([
        paymentsApi.me(),
        paymentsApi.methods(),
        paymentsApi.packs(),
        paymentsApi.cart(),
      ]);

      if (packsRes.status === 'fulfilled' && packsRes.value) setPacks(packsRes.value.data);
      if (cartRes.status === 'fulfilled' && cartRes.value) setKosik(cartRes.value.data);

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
          ? `Do začátku zápasu zbývá míň než ${lhuta} h, takže ti tenhle zápas z balíčku propadne. `
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

  // Pokuta je jediná platba, která jde pořád mimo košík: dokud visí, tým
  // další zápas nerozehraje, takže čekat na zbytek nákupu nesmí.
  const openFine     = (fineId: string)  => runCheckout(`fine-${fineId}`, () => paymentsApi.fine(fineId));

  const polozkyKosiku: any[] = kosik?.items ?? [];
  const vKosiku = (kind: string, id?: string | null) =>
    polozkyKosiku.some((i: any) => i.kind === kind && (!id || i.player?.id === id || i.team?.id === id));

  async function doKosiku(klic: string, item: any) {
    setKosikBusy(klic);
    try {
      const r = await paymentsApi.cartAdd(item);
      setKosik(r.data);
      await load(true);
    } catch (err: any) {
      Alert.alert('Nepodařilo se přidat', err?.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setKosikBusy(null);
    }
  }

  async function zKosiku(itemId: string) {
    setKosikBusy(itemId);
    try {
      const r = await paymentsApi.cartRemove(itemId);
      setKosik(r.data);
      await load(true);
    } catch (err: any) {
      Alert.alert('Nepodařilo se odebrat', err?.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setKosikBusy(null);
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

  const hasData = player || teams.length > 0 || fines.length > 0 || isManager;

  return (
    <SafeAreaView style={s.safe}>
      <Header />
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(true); }} tintColor={Colors.go} />}
      >

        {/* ── KOŠÍK ──
            Jediné místo, odkud se doopravdy platí. Karty níž do něj jen
            přidávají. Převodem je celý košík bez poplatku. */}
        {polozkyKosiku.length > 0 && (
          <View style={[s.card, { marginBottom: 12 }]}>
            <View style={s.cardHeader}>
              <View style={s.iconBox}>
                <Ionicons name="cart-outline" size={18} color={Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Košík</Text>
                <Text style={s.cardSub}>jedna platba místo několika</Text>
              </View>
              <Text style={s.kosikCelkem}>{kosik?.total ?? 0} Kč</Text>
            </View>

            <View style={s.hr} />
            {polozkyKosiku.map((i: any) => (
              <View key={i.id} style={s.kosikRadek}>
                <View style={{ flex: 1 }}>
                  <Text style={s.kosikNazev}>{i.label}</Text>
                  {(i.team?.name || (i.zaJineho && i.player)) && (
                    <Text style={s.kosikPopis}>
                      {i.team?.name ?? `za ${i.player.firstName} ${i.player.lastName}`}
                    </Text>
                  )}
                </View>
                <Text style={s.kosikCena}>{i.amount} Kč</Text>
                <Pressable
                  onPress={() => zKosiku(i.id)}
                  disabled={!!kosikBusy}
                  hitSlop={8}
                  style={kosikBusy === i.id && { opacity: 0.4 }}
                >
                  <Ionicons name="trash-outline" size={17} color={Colors.mu} />
                </Pressable>
              </View>
            ))}

            <View style={s.hr} />
            <PayOptions
              qrType="cart"
              qrId={kosik?.id ?? ''}
              amount={kosik?.total ?? 0}
              accent={Colors.go}
              accentText={Colors.bg}
              busy={paying === 'cart'}
              disabled={!!paying}
              methods={methods}
              onCheckout={() => runCheckout('cart', () => paymentsApi.cartCheckout())}
            />
            <Text style={s.kosikPozn}>
              Převodem je platba bez poplatku. U karty si brána bere pevnou částku
              z každé transakce — proto se vyplatí zaplatit všechno najednou.
            </Text>
          </View>
        )}

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
                  style={[s.balicek, kosikBusy === `pack-${b.size}` && { opacity: 0.5 }]}
                  disabled={!!kosikBusy || packs?.hasProfile === false}
                  onPress={() => doKosiku(`pack-${b.size}`, { kind: 'MATCH_PACK', size: b.size })}
                >
                  <Text style={s.balicekPocet}>
                    {b.size} {b.size === 1 ? 'zápas' : b.size < 5 ? 'zápasy' : 'zápasů'}
                  </Text>
                  <Text style={s.balicekCena}>{b.price} Kč</Text>
                  <Text style={s.balicekZa}>{Math.round(b.price / b.size)} Kč / zápas</Text>
                  {polozkyKosiku.some((i: any) => i.packSize === b.size) && (
                    <Text style={s.vKosiku}>v košíku</Text>
                  )}
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
                <DoKosiku
                  jeUvnitr={vKosiku('PLAYER_LICENSE', player.playerId)}
                  busy={kosikBusy === 'lic'}
                  disabled={!!kosikBusy}
                  accent={Colors.go}
                  accentText={Colors.bg}
                  onAdd={() => doKosiku('lic', { kind: 'PLAYER_LICENSE' })}
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
                <DoKosiku
                  jeUvnitr={vKosiku('SUPER_LICENSE', player.playerId)}
                  busy={kosikBusy === 'super'}
                  disabled={!!kosikBusy}
                  accent={Colors.pu}
                  accentText={Colors.wh}
                  onAdd={() => doKosiku('super', { kind: 'SUPER_LICENSE' })}
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
                <DoKosiku
                  jeUvnitr={vKosiku('TEAM_REG', tp.teamId)}
                  busy={kosikBusy === `team-${tp.teamId}`}
                  disabled={!!kosikBusy}
                  accent="#63B3ED"
                  accentText={Colors.bg}
                  onAdd={() => doKosiku(`team-${tp.teamId}`, { kind: 'TEAM_REG', teamId: tp.teamId })}
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

        {/* Zápasy si platí hráči sami v balíčku startů — sekce Balíčky
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
  // Košík
  kosikCelkem:  { fontSize: 20, fontWeight: '800', color: Colors.wh },
  kosikRadek:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  kosikNazev:   { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  kosikPopis:   { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 1 },
  kosikCena:    { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  kosikPozn:    { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 17, marginTop: 10 },
  vKosiku:      { fontSize: 11, fontWeight: '700', color: Colors.go, marginTop: 3 },
});
