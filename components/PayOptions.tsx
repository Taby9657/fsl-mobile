import { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import qrcodeGen from 'qrcode-generator';
import { paymentsApi } from '../services/api';
import { Colors, Fonts, Radius } from '../constants/colors';

/**
 * Jednotná nabídka platebních metod pro všechny poplatky FSL.
 * Vždy nabízí tři cesty: peněženka (Apple Pay / Google Pay), karta, převod s QR.
 *
 * Peněženka i karta míří do stejné Stripe Checkout session – Stripe v ní podle
 * zařízení vykreslí Apple Pay (iOS/Safari), Google Pay (Android/Chrome) i kartu.
 */

export type QrType = 'player-license' | 'super-license' | 'team-reg' | 'home-fee';

interface QrData {
  spayd: string;
  vs: string;
  amount: number;
  iban: string;
  message: string;
}

// ─────────────────────────── QR kód (lokálně, bez cizí služby) ───────────────────────────

function QrCode({ value, size = 132 }: { value: string; size?: number }) {
  const data = useMemo(() => {
    try {
      const qr = qrcodeGen(0, 'M');
      qr.addData(value);
      qr.make();
      const n = qr.getModuleCount();
      const rows: { x: number; w: number }[][] = [];
      for (let r = 0; r < n; r++) {
        const row: { x: number; w: number }[] = [];
        let c = 0;
        while (c < n) {
          if (qr.isDark(r, c)) {
            const start = c;
            while (c < n && qr.isDark(r, c)) c++;
            row.push({ x: start, w: c - start });
          } else {
            c++;
          }
        }
        rows.push(row);
      }
      return { n, rows };
    } catch {
      return null;
    }
  }, [value]);

  if (!data) {
    return (
      <View style={[q.wrap, { width: size, height: size, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={q.err}>QR se nepodařilo vytvořit</Text>
      </View>
    );
  }

  const pad   = 8;
  const cell  = Math.max(1, Math.floor((size - pad * 2) / data.n));
  const inner = cell * data.n;

  return (
    <View style={[q.wrap, { width: inner + pad * 2, height: inner + pad * 2 }]}>
      <View style={{ width: inner, height: inner }}>
        {data.rows.map((row, r) =>
          row.map((seg, i) => (
            <View
              key={`${r}-${i}`}
              style={{
                position: 'absolute',
                left: seg.x * cell,
                top: r * cell,
                width: seg.w * cell,
                height: cell,
                backgroundColor: '#000',
              }}
            />
          )),
        )}
      </View>
    </View>
  );
}

const q = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: 8, padding: 8 },
  err:  { fontSize: Fonts.sizes.xs, color: '#000', textAlign: 'center' },
});

// ─────────────────────────── Řádek s údajem ───────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} selectable>{value}</Text>
    </View>
  );
}

// ─────────────────────────── Hlavní komponenta ───────────────────────────

interface Props {
  qrType: QrType;
  qrId: string | null | undefined;
  amount: number;
  /** Otevře Stripe Checkout. Vrací promise, ať víme, kdy dojede. */
  onCheckout: () => Promise<void> | void;
  busy?: boolean;
  disabled?: boolean;
  accent?: string;
  accentText?: string;
  /** Ktere cesty jsou na backendu opravdu zapnute. */
  methods?: { card: boolean; wallet: boolean; transfer: boolean };
}

export default function PayOptions({
  qrType, qrId, amount, onCheckout, busy, disabled,
  accent = Colors.go, accentText = Colors.bg,
  methods,
}: Props) {
  // Dokud stav metod nedorazi, ukazujeme vsechny tri – at obrazovka neposkakuje.
  const showCard     = methods?.card     ?? true;
  const showWallet   = methods?.wallet   ?? true;
  const showTransfer = methods?.transfer ?? true;
  const [open, setOpen]     = useState(false);
  const [qr, setQr]         = useState<QrData | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrErr, setQrErr]   = useState<string | null>(null);

  const isIOS      = Platform.OS === 'ios';
  const walletName = isIOS ? 'Apple Pay' : 'Google Pay';

  async function toggleTransfer() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (qr || !qrId) return;
    setQrBusy(true);
    setQrErr(null);
    try {
      const res = await paymentsApi.qr(qrType, qrId);
      setQr(res.data);
    } catch (err: any) {
      setQrErr(err?.response?.data?.error ?? 'Údaje k převodu se nepodařilo načíst.');
    } finally {
      setQrBusy(false);
    }
  }

  if (!showCard && !showWallet && !showTransfer) {
    return (
      <Text style={s.none}>
        Platby zatím nejsou spuštěné. Ozveme se, jakmile půjde poplatek uhradit.
      </Text>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {/* 1) Apple Pay / Google Pay */}
      {showWallet && <Pressable
        style={[s.btn, isIOS ? s.walletIOS : s.walletAndroid, disabled && s.dim]}
        onPress={onCheckout}
        disabled={disabled}
      >
        {busy ? (
          <ActivityIndicator color={isIOS ? '#fff' : '#1F1F1F'} size="small" />
        ) : (
          <>
            <Ionicons
              name={isIOS ? 'logo-apple' : 'logo-google'}
              size={17}
              color={isIOS ? '#fff' : '#1F1F1F'}
            />
            <Text style={[s.btnText, { color: isIOS ? '#fff' : '#1F1F1F' }]}>{walletName}</Text>
          </>
        )}
      </Pressable>}

      {/* 2) Karta */}
      {showCard && <Pressable
        style={[s.btn, { backgroundColor: accent }, disabled && s.dim]}
        onPress={onCheckout}
        disabled={disabled}
      >
        {busy ? (
          <ActivityIndicator color={accentText} size="small" />
        ) : (
          <>
            <Ionicons name="card-outline" size={16} color={accentText} />
            <Text style={[s.btnText, { color: accentText }]}>Zaplatit kartou</Text>
          </>
        )}
      </Pressable>}

      {/* 3) Převod + QR */}
      {showTransfer && <Pressable style={[s.btn, s.transferBtn]} onPress={toggleTransfer}>
        <Ionicons name="swap-horizontal-outline" size={16} color={Colors.wh} />
        <Text style={[s.btnText, { color: Colors.wh }]}>Zaplatit převodem</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.mu} />
      </Pressable>}

      {showTransfer && open && (
        <View style={s.transferBox}>
          {qrBusy && <ActivityIndicator color={Colors.go} style={{ paddingVertical: 16 }} />}

          {!qrBusy && qrErr && (
            <Text style={s.transferErr}>{qrErr}</Text>
          )}

          {!qrBusy && !qrErr && !qrId && (
            <Text style={s.transferErr}>Údaje k převodu zatím nejsou k dispozici.</Text>
          )}

          {!qrBusy && qr && (
            <>
              <View style={s.transferInner}>
                <View style={{ flex: 1 }}>
                  <Row label="Číslo účtu (IBAN)"  value={qr.iban} />
                  <Row label="Variabilní symbol"  value={qr.vs} />
                  <Row label="Částka"             value={`${qr.amount} Kč`} />
                  <Row label="Zpráva pro příjemce" value={qr.message} />
                </View>
                <QrCode value={qr.spayd} size={132} />
              </View>
              <Text style={s.transferHint}>
                Naskenuj QR kód v bankovní aplikaci, nebo opiš údaje ručně. Platba se spáruje
                automaticky podle variabilního symbolu (obvykle do druhého pracovního dne).
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 46, borderRadius: Radius.md, paddingHorizontal: 12,
  },
  btnText:       { fontSize: Fonts.sizes.md, fontWeight: '700' },
  dim:           { opacity: 0.55 },
  walletIOS:     { backgroundColor: '#000' },
  walletAndroid: { backgroundColor: '#fff' },
  transferBtn:   { backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd },
  transferBox:   { backgroundColor: Colors.c2, borderRadius: Radius.sm, padding: 12 },
  transferInner: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  transferHint:  { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 10, lineHeight: 16 },
  transferErr:   { fontSize: Fonts.sizes.sm, color: Colors.red, textAlign: 'center', paddingVertical: 8 },
  none:          { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', paddingVertical: 10, lineHeight: 20 },
  row:           { paddingVertical: 3 },
  rowLabel:      { fontSize: Fonts.sizes.xs, color: Colors.mu },
  rowValue:      { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
});
