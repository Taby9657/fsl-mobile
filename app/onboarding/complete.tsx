import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useIsManager, useIsReferee, useIsSupervisor } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';

export default function OnboardingCompleteScreen() {
  const { user } = useAuthStore();
  const isManager    = useIsManager();
  const isReferee    = useIsReferee();
  const isSupervisor = useIsSupervisor();

  const steps = isSupervisor ? [
    { icon: 'shield-checkmark', label: 'Správce ligy',       desc: 'přehled a nastavení', route: '/supervisor/dashboard' },
    { icon: 'football'        , label: 'Správa zápasů',      desc: 'přidat, editovat, výsledky', route: '/supervisor/matches' },
    { icon: 'people'          , label: 'Správa rozhodčích',  desc: 'schvalovat a přiřazovat', route: '/supervisor/referees' },
    { icon: 'calendar'        , label: 'Generovat rozlosování', desc: 'nastavení ligy a kol', route: '/supervisor/league' },
  ] : isManager ? [
    { icon: 'qr-code'        , label: 'Vygeneruj pozvánkový kód', desc: 'a pošli ho hráčům', route: '/invite-code' },
    { icon: 'document-text'  , label: 'Odesílej soupisky',        desc: 'před každým zápasem', route: '/lineup' },
    { icon: 'card'           , label: 'Zaplať registraci',        desc: 'přes Stripe nebo převodem', route: '/payments' },
    { icon: 'clipboard'      , label: 'Po-zápasový formulář',     desc: 'MVP a hodnocení rozhodčího', route: '/postmatch' },
  ] : isReferee ? [
    { icon: 'person'         , label: 'Zkontroluj profil',        desc: 'jméno, telefon a fotka', route: '/referee-profile' },
    { icon: 'football'       , label: 'Prohlédni si zápasy',      desc: 'ať víš, do čeho jdeš', route: '/(tabs)' },
  ] : [
    { icon: 'card'           , label: 'Zaplať licenci',           desc: 'aktivuj svůj hráčský profil', route: '/payments' },
    { icon: 'person'         , label: 'Prohlédni si profil',      desc: 'statistiky a detaily', route: user?.player?.id ? `/player/${user.player.id}` : '/(tabs)' },
    { icon: 'football'       , label: 'Sleduj zápasy',            desc: 'výsledky a tabulka ligy', route: '/(tabs)' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Ikona úspěchu */}
        <View style={s.iconWrap}>
          <Ionicons name="checkmark-circle" size={72} color={Colors.green} />
        </View>

        <Text style={s.title}>Registrace dokončena!</Text>
        <Text style={s.subtitle}>
          {isSupervisor
            ? 'Tvůj účet má oprávnění správce FSL ligy.'
            : isManager
            ? `Tvůj tým ${user?.manager?.[0]?.team?.name ?? ''} je zaregistrovaný ve FSL.`
            : isReferee
            ? 'Tvoje registrace rozhodčího čeká na schválení supervisorem.'
            : `Jsi teď součástí týmu ${user?.player?.team?.name ?? 'FSL'}.`
          }
        </Text>

        <Text style={s.nextLabel}>Co teď?</Text>

        <View style={s.card}>
          {steps.map((step, i) => (
            <Pressable
              key={`${step.icon}-${i}`}
              style={[s.step, i < steps.length - 1 && s.stepBorder]}
              onPress={() => router.push(step.route as any)}
            >
              <View style={s.stepIcon}>
                <Ionicons name={step.icon as any} size={20} color={Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.stepLabel}>{step.label}</Text>
                <Text style={s.stepDesc}>{step.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.di} />
            </Pressable>
          ))}
        </View>

        <Text style={s.poznamka}>
          Nemusíš to řešit hned. Co zbývá, najdeš pak vždycky nahoře na domovské obrazovce.
        </Text>

        <Pressable style={s.btn} onPress={() => router.replace('/(tabs)')}>
          <Text style={s.btnTxt}>Přejít do aplikace</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.bg },
  scroll:    { padding: 24, alignItems: 'center' },
  iconWrap:  { marginTop: 32, marginBottom: 24 },
  title:     { fontSize: Fonts.sizes.h1, fontWeight: '900', color: Colors.wh, textAlign: 'center', marginBottom: 10 },
  subtitle:  { fontSize: Fonts.sizes.md, color: Colors.mu, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  nextLabel: { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'flex-start', marginBottom: 10 },
  card:      { width: '100%', backgroundColor: Colors.c1, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden', marginBottom: 24 },
  step:      { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  stepBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.bd },
  stepIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  stepDesc:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  poznamka:  { fontSize: Fonts.sizes.xs, color: Colors.di, textAlign: 'center', lineHeight: 17, marginTop: -12, marginBottom: 20 },
  btn:       { width: '100%', backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  btnTxt:    { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
