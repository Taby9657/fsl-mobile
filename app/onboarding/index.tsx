// Výběr role – první obrazovka po přihlášení bez profilu
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';

const ROLES = [
  {
    id:    'player',
    icon:  'person' as const,
    title: 'Jsem hráč',
    desc:  'Vedoucí týmu ti pošle 6místný pozvánkový kód. Zadáš ho tady a okamžitě jsi na soupisce.',
    badge: 'Potřebuješ kód od vedoucího',
    route: '/onboarding/player-code',
    color: Colors.go,
  },
  {
    id:    'manager',
    icon:  'shield' as const,
    title: 'Jsem vedoucí týmu',
    desc:  'Vytvoříš tým, spravuješ soupisku, odesíláš hráče před zápasem a platíš licence.',
    badge: 'Plná správa týmu',
    route: '/onboarding/manager',
    color: Colors.pu,
  },
  {
    id:    'referee',
    icon:  'flag' as const,
    title: 'Chci být rozhodčí',
    desc:  'Vyplníš osobní údaje a bankovní spojení pro výplatu odměn. Supervisor FSL tě do 48 h schválí.',
    badge: 'Čeká na schválení supervisorem',
    route: '/onboarding/referee',
    color: '#3B82F6',
  },
];

export default function OnboardingIndex() {
  const logout = useAuthStore(s => s.logout);

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
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>
        <Text style={styles.title}>Vítej v FSL</Text>
        <Text style={styles.subtitle}>Kdo jsi?</Text>

        <View style={styles.cards}>
          {ROLES.map(role => (
            <Pressable
              key={role.id}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(role.route as any)}
            >
              <View style={[styles.iconBox, { backgroundColor: `${role.color}22` }]}>
                <Ionicons name={role.icon} size={28} color={role.color} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{role.title}</Text>
                <Text style={styles.cardDesc}>{role.desc}</Text>
                <View style={[styles.badge, { backgroundColor: `${role.color}18` }]}>
                  <Text style={[styles.badgeTxt, { color: role.color }]}>{role.badge}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.di} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Přihlásit se jiným účtem</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  inner:       { flex: 1, padding: 24, justifyContent: 'center' },
  title:       { fontSize: Fonts.sizes.h1, fontWeight: '900', color: Colors.wh, marginBottom: 6 },
  subtitle:    { fontSize: Fonts.sizes.xl, color: Colors.mu, marginBottom: 32 },
  cards:       { gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.c1, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.bd, padding: 18,
  },
  cardPressed: { opacity: 0.7 },
  iconBox:     { width: 52, height: 52, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' },
  cardText:    { flex: 1 },
  cardTitle:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 4 },
  cardDesc:    { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 18, marginBottom: 8 },
  badge:       { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeTxt:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  logoutBtn:   { alignItems: 'center', marginTop: 28, paddingVertical: 8 },
  logoutText:  { fontSize: Fonts.sizes.sm, color: Colors.di },
});
