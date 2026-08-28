// Co ještě zbývá udělat – trvalý seznam na domovské obrazovce
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { paymentsApi, teamsApi } from '../services/api';
import { useAuthStore, useIsManager, useIsReferee } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';

/**
 * Nahrazuje jednorázovou obrazovku „Co teď?" po registraci. Ta se ukázala
 * jednou a pak zmizela — kdo si licenci nezaplatil hned, neměl se to jak
 * dozvědět.
 *
 * Kroky se odvozují ze skutečného stavu dat, ne z uloženého příznaku. Jakmile
 * je věc hotová, řádek zmizí sám; když nezbývá nic, nezobrazí se vůbec nic.
 */

interface Krok {
  id:    string;
  icon:  keyof typeof Ionicons.glyphMap;
  label: string;
  desc:  string;
  route?: string;
  /** Informace, se kterou uživatel nic neudělá — jen čeká. */
  cekani?: boolean;
}

export function NextSteps() {
  const { user, isGuest } = useAuthStore();
  const isManager = useIsManager();
  const isReferee = useIsReferee();

  const [platby, setPlatby] = useState<any>(null);
  const [tym,    setTym]    = useState<any>(null);

  const nacti = useCallback(async () => {
    if (isGuest || !user) return;
    const teamId = user.manager?.[0]?.teamId ?? user.player?.teamId ?? null;
    const [p, t] = await Promise.allSettled([
      paymentsApi.me(),
      teamId ? teamsApi.get(teamId) : Promise.resolve(null),
    ]);
    if (p.status === 'fulfilled') setPlatby(p.value.data);
    if (t.status === 'fulfilled' && t.value) setTym(t.value.data);
  }, [isGuest, user?.id, user?.player?.teamId, user?.manager?.length]);

  // Po návratu z plateb nebo soupisky se stav musí přepočítat
  useFocusEffect(useCallback(() => { nacti(); }, [nacti]));
  useEffect(() => { nacti(); }, [nacti]);

  if (isGuest || !user) return null;

  const kroky: Krok[] = [];

  // ── Hráč ────────────────────────────────────────────────────────────────
  const lic = platby?.playerPayment?.licStatus;
  if (user.player && lic && lic !== 'PAID' && lic !== 'WAIVED') {
    kroky.push({
      id: 'licence',
      icon: 'card',
      label: 'Zaplať hráčskou licenci',
      desc: 'Bez ní tě nemůže vedoucí zapsat na soupisku k zápasu.',
      route: '/payments',
    });
  }

  // ── Vedoucí týmu ────────────────────────────────────────────────────────
  if (isManager && tym) {
    if (tym.regStatus === 'PENDING') {
      kroky.push({
        id: 'schvaleni-tymu',
        icon: 'time-outline',
        label: 'Tým čeká na schválení',
        desc: 'Supervisor registraci potvrdí a přidělí divizi. Dáme ti vědět.',
        cekani: true,
      });
    }
    if (tym.regStatus === 'REJECTED') {
      kroky.push({
        id: 'zamitnuty-tym',
        icon: 'close-circle-outline',
        label: 'Registrace týmu byla zamítnuta',
        desc: 'Ve Správě si přečti důvod a můžeš se odvolat.',
        route: '/(tabs)/admin',
      });
    }
    if ((tym._count?.players ?? tym.players?.length ?? 0) === 0) {
      kroky.push({
        id: 'pozvi-hrace',
        icon: 'qr-code',
        label: 'Pozvi hráče do týmu',
        desc: 'Pošli jim pozvánkový kód, jinak zůstane soupiska prázdná.',
        route: '/invite-code',
      });
    }
    const tp = platby?.teamPayment;
    if (tp && tp.status !== 'PAID' && tp.status !== 'WAIVED') {
      kroky.push({
        id: 'registrace-tymu',
        icon: 'cash',
        label: 'Zaplať registraci týmu',
        desc: 'Startovné do ligy. Kartou nebo převodem s QR kódem.',
        route: '/payments',
      });
    }
  }

  // ── Rozhodčí ────────────────────────────────────────────────────────────
  if (isReferee) {
    if (user.referee?.status === 'PENDING') {
      kroky.push({
        id: 'schvaleni-rozhodciho',
        icon: 'time-outline',
        label: 'Přihláška rozhodčího se posuzuje',
        desc: 'Supervisor ji obvykle vyřídí do 48 hodin.',
        cekani: true,
      });
    }
    if (user.referee?.status === 'APPROVED' && !user.referee?.bankAccount) {
      kroky.push({
        id: 'ucet-rozhodciho',
        icon: 'cash-outline',
        label: 'Doplň bankovní spojení',
        desc: 'Bez něj ti nepůjde vyplatit odměna za odpískané zápasy.',
        route: '/referee-profile',
      });
    }
  }

  if (kroky.length === 0) return null;

  return (
    <View style={s.wrap}>
      <Text style={s.head}>Zbývá vyřídit</Text>
      <View style={s.card}>
        {kroky.map((k, i) => {
          const Radek = k.route ? Pressable : View;
          return (
            <Radek
              key={k.id}
              style={[s.row, i < kroky.length - 1 && s.rowBorder]}
              {...(k.route ? { onPress: () => router.push(k.route as any) } : {})}
            >
              <View style={[s.icon, k.cekani && s.iconCekani]}>
                <Ionicons name={k.icon} size={18} color={k.cekani ? Colors.mu : Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{k.label}</Text>
                <Text style={s.desc}>{k.desc}</Text>
              </View>
              {k.route && <Ionicons name="chevron-forward" size={16} color={Colors.di} />}
            </Radek>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { marginBottom: 8 },
  head:       { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  card:       { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowBorder:  { borderBottomWidth: 1, borderBottomColor: Colors.bd },
  icon:       { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center' },
  iconCekani: { backgroundColor: `${Colors.mu}22` },
  label:      { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  desc:       { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 3, lineHeight: 17 },
});
