// Výběr role – první obrazovka po přihlášení bez profilu
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth';
import { useFanStore } from '../../store/fan';
import {
  readDraft, clearDraft, draftRoute, draftAge, DRAFT_LABELS,
  type DraftRegistration,
} from '../../utils/draftRegistration';
import { Colors, Fonts, Radius } from '../../constants/colors';

const ROLES = [
  {
    id:    'fan',
    icon:  'eye' as const,
    title: 'Jsem fanoušek',
    desc:  'Chci jen sledovat ligu — výsledky, tabulku, statistiky a zápasy svého oblíbeného týmu. Žádnou registraci nevyplňuješ, jdeš rovnou do aplikace.',
    need:  'Co budeš potřebovat: nic, hotovo jedním klepnutím',
    route: null,
    color: Colors.mu,
  },
  {
    id:    'player',
    icon:  'person' as const,
    title: 'Jsem hráč',
    desc:  'Chci hrát za tým. Vedoucí týmu ti pošle 6místný pozvánkový kód — zadáš ho na další obrazovce a hned budeš na soupisce.',
    need:  'Co budeš potřebovat: pozvánkový kód od vedoucího týmu',
    route: '/onboarding/player-code',
    color: Colors.go,
  },
  {
    id:    'manager',
    icon:  'shield' as const,
    title: 'Jsem vedoucí týmu',
    desc:  'Zakládám nový tým. Vyplníš název a zkratku, dostaneš pozvánkový kód pro hráče a pak spravuješ soupisku, sestavy a licence.',
    need:  'Co budeš potřebovat: název týmu a jeho zkratku',
    route: '/onboarding/manager',
    color: Colors.pu,
  },
  {
    id:    'referee',
    icon:  'flag' as const,
    title: 'Chci být rozhodčí',
    desc:  'Budu pískat zápasy FSL. Vyplníš osobní údaje a bankovní spojení pro výplatu odměn. Supervisor FSL tvoji přihlášku schválí do 48 hodin.',
    need:  'Co budeš potřebovat: osobní údaje a číslo účtu',
    route: '/onboarding/referee',
    color: '#3B82F6',
  },
];

// POZOR: style NESMÍ být funkce ({ pressed }) => ... — NativeWind (jsxImportSource)
// takový style prop zahodí a karta pak zůstane bez pozadí i bez flexDirection: 'row'.
// Stav stisku proto držíme sami a předáváme pole stylů.
function RoleCard({ role, onPress }: { role: (typeof ROLES)[number]; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${role.title}. ${role.desc}`}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={onPress}
      style={[styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHead}>
        <Ionicons name={role.icon} size={16} color={role.color} style={styles.cardIcon} />
        <Text style={[styles.cardTitle, { color: role.color }]}>{role.title}</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.di} />
      </View>

      <Text style={styles.cardDesc}>{role.desc}</Text>
      <Text style={styles.cardNeed}>{role.need}</Text>
    </Pressable>
  );
}

export default function OnboardingIndex() {
  const logout = useAuthStore(s => s.logout);
  const setFan = useFanStore(s => s.setFan);

  // Rozdělaná registrace z minula – ať nezačíná od nuly
  const [draft, setDraft] = useState<DraftRegistration | null>(null);
  useEffect(() => { readDraft().then(setDraft); }, []);

  function zahodDraft() {
    Alert.alert(
      'Začít znovu',
      'Rozdělanou registraci zahodíme a vybereš si roli od začátku.',
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Začít znovu', style: 'destructive',
          onPress: async () => { await clearDraft(); setDraft(null); },
        },
      ],
    );
  }

  async function choose(role: (typeof ROLES)[number]) {
    if (role.id === 'fan') {
      await setFan(true);
      router.replace('/(tabs)');
      return;
    }
    router.push(role.route as any);
  }

  function handleLogout() {
    Alert.alert(
      'Odhlásit se',
      'Chceš se přihlásit jiným účtem?',
      [
        { text: 'Zrušit', style: 'cancel' },
        { text: 'Odhlásit', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Vítej v FSL</Text>
        <Text style={styles.lead}>
          Ještě nemáš v lize profil. Vyber si níže, kdo jsi — podle toho ti aplikaci nastavíme
          a provedeme tě zbytkem registrace. Zabere to minutu.
        </Text>

        {/* Navázání na rozdělanou registraci */}
        {draft && (
          <View style={styles.draftBox}>
            <View style={styles.draftHead}>
              <Ionicons name="refresh-circle-outline" size={20} color={Colors.go} />
              <Text style={styles.draftTitle}>Máš rozdělanou registraci</Text>
            </View>
            <Text style={styles.draftDesc}>
              Začal jsi registraci {DRAFT_LABELS[draft.role]}
              {draft.teamName ? ` do týmu ${draft.teamName}` : ''} · {draftAge(draft.updatedAt)}.
            </Text>
            <Pressable
              style={styles.draftBtn}
              onPress={() => router.push(draftRoute(draft) as any)}
            >
              <Text style={styles.draftBtnTxt}>Pokračovat</Text>
            </Pressable>
            <Pressable onPress={zahodDraft} style={styles.draftLink}>
              <Text style={styles.draftLinkTxt}>Začít znovu</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.stepLabel}>{draft ? 'Nebo si vyber jinou roli' : 'Vyber jednu možnost'}</Text>

        <View style={styles.cards}>
          {ROLES.map(role => (
            <RoleCard key={role.id} role={role} onPress={() => choose(role)} />
          ))}
        </View>

        <Text style={styles.help}>
          Nevíš, co vybrat? Začni jako fanoušek — uvidíš celou ligu a roli hráče, vedoucího
          nebo rozhodčího si můžeš kdykoli později doplnit ve Správě. Pokud tvůj tým v lize
          ještě není, založí ho vedoucí a ten pak rozešle pozvánkový kód ostatním.
        </Text>

        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Přihlásit se jiným účtem</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  scroll:      { padding: 24, paddingTop: 32, paddingBottom: 40, flexGrow: 1 },
  title:       { fontSize: Fonts.sizes.h1, fontWeight: '900', color: Colors.wh, marginBottom: 10 },
  lead:        { fontSize: Fonts.sizes.md, color: Colors.mu, lineHeight: 22, marginBottom: 24 },
  stepLabel: {
    fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.di,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10,
  },
  cards:       { gap: 12 },
  draftBox:    { backgroundColor: Colors.c2, borderRadius: Radius.lg, borderWidth: 1, borderColor: `${Colors.go}66`, padding: 16, marginBottom: 24 },
  draftHead:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  draftTitle:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  draftDesc:   { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 19, marginBottom: 14 },
  draftBtn:    { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 13, alignItems: 'center' },
  draftBtnTxt: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  draftLink:   { alignItems: 'center', paddingTop: 10 },
  draftLinkTxt:{ fontSize: Fonts.sizes.sm, color: Colors.di, textDecorationLine: 'underline' },
  card: {
    backgroundColor: Colors.c1, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.bd, padding: 18,
  },
  cardPressed: { opacity: 0.7 },
  cardHead:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardIcon:    { marginTop: 1 },
  cardTitle:   { flex: 1, fontSize: Fonts.sizes.xl, fontWeight: '800' },
  cardDesc:    { fontSize: Fonts.sizes.md, color: Colors.wh, lineHeight: 21, marginBottom: 10 },
  cardNeed:    { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 18 },
  help:        { fontSize: Fonts.sizes.sm, color: Colors.di, lineHeight: 19, marginTop: 22 },
  logoutBtn:   { alignItems: 'center', marginTop: 24, paddingVertical: 8 },
  logoutText:  { fontSize: Fonts.sizes.sm, color: Colors.di, textDecorationLine: 'underline' },
});
