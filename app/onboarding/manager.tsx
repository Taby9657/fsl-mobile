// Vedoucí registruje nový tým – 2 kroky
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { teamsApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';

const TEAM_COLORS = ['#C9A140', '#8B5CF6', '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#FFFFFF'];

export default function ManagerOnboardingScreen() {
  const refreshUser = useAuthStore(s => s.refreshUser);
  const [step, setStep]       = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [logo, setLogo]       = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');

  const [form, setForm] = useState({
    name: '', abbr: '', color: '#C9A140', division: 'Divize A',
  });

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setLogo(result.assets[0].uri);
  }

  async function createTeam() {
    if (!form.name || !form.abbr) {
      Alert.alert('Vyplň povinné údaje', 'Název a zkratka týmu jsou povinné.'); return;
    }
    if (form.abbr.length > 3) {
      Alert.alert('Zkratka', 'Zkratka týmu může mít maximálně 3 znaky.'); return;
    }
    setLoading(true);
    try {
      const res = await teamsApi.create(form);
      const teamId = res.data.team.id;
      const code   = res.data.inviteCode;

      if (logo) {
        await teamsApi.uploadLogo(teamId, logo).catch(() => {});
      }
      setInviteCode(code);
      await refreshUser();
      setStep(2);
    } catch (err: any) {
      Alert.alert('Chyba', err.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setLoading(false);
    }
  }

  // Krok 2 – pozvánkový kód
  if (step === 2) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.go} />
          </View>
          <Text style={styles.title}>Tým vytvořen!</Text>
          <Text style={styles.subtitle}>Sdílej tento kód se svými hráči.</Text>

          <View style={styles.codeBox}>
            <Text style={styles.code}>{inviteCode}</Text>
          </View>

          <Text style={styles.codeHint}>Hráči ho zadají při registraci a automaticky se připojí k tvému týmu.</Text>

          <Pressable style={styles.btnPrimary} onPress={() => router.replace('/onboarding/complete')}>
            <Text style={styles.btnText}>Co dál →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Krok 1 – formulář týmu
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Zpět</Text>
        </Pressable>

        <Text style={styles.title}>Nový tým</Text>
        <Text style={styles.subtitle}>Vyplň základní informace o tvém týmu.</Text>

        {/* Logo */}
        <Pressable style={styles.logoBtn} onPress={pickLogo}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.logo} />
          ) : (
            <View style={[styles.logoPlaceholder, { borderColor: form.color }]}>
              <Text style={[styles.logoAbbr, { color: form.color }]}>
                {form.abbr || 'TM'}
              </Text>
            </View>
          )}
          <Text style={styles.logoHint}>Klepni pro nahrání loga</Text>
        </Pressable>

        {/* Název */}
        <Text style={styles.label}>Název týmu *</Text>
        <TextInput style={styles.input} value={form.name} onChangeText={v => set('name', v)}
          placeholder="Benavidez Eagles" placeholderTextColor={Colors.di} keyboardAppearance="dark" />

        {/* Zkratka */}
        <Text style={styles.label}>Zkratka (max. 3 znaky) *</Text>
        <TextInput style={styles.input} value={form.abbr}
          onChangeText={v => set('abbr', v.toUpperCase().slice(0, 3))}
          placeholder="BE" placeholderTextColor={Colors.di}
          autoCapitalize="characters" maxLength={3} keyboardAppearance="dark" />

        {/* Barva */}
        <Text style={styles.label}>Barva dresu</Text>
        <View style={styles.colorRow}>
          {TEAM_COLORS.map(c => (
            <Pressable key={c} style={[styles.colorDot, { backgroundColor: c }, form.color === c && styles.colorDotActive]}
              onPress={() => set('color', c)} />
          ))}
        </View>

        {/* Divize */}
        <Text style={styles.label}>Divize</Text>
        <View style={styles.pills}>
          {['Divize A', 'Divize B', 'Divize C'].map(d => (
            <Pressable key={d} style={[styles.pill, form.division === d && styles.pillActive]}
              onPress={() => set('division', d)}>
              <Text style={[styles.pillText, form.division === d && styles.pillTextActive]}>{d}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={[styles.btnPrimary, loading && styles.btnDisabled]} onPress={createTeam} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnText}>Vytvořit tým</Text>}
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.bg },
  inner:           { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  scroll:          { padding: 24, paddingTop: 16 },
  back:            { marginBottom: 20 },
  backText:        { color: Colors.go, fontSize: Fonts.sizes.md },
  title:           { fontSize: Fonts.sizes.h1, fontWeight: '900', color: Colors.wh, marginBottom: 4, textAlign: 'center' },
  subtitle:        { fontSize: Fonts.sizes.md, color: Colors.mu, marginBottom: 24, textAlign: 'center', lineHeight: 22 },
  logoBtn:         { alignSelf: 'center', alignItems: 'center', marginBottom: 24, gap: 8 },
  logo:            { width: 96, height: 96, borderRadius: 16 },
  logoPlaceholder: { width: 96, height: 96, borderRadius: 16, backgroundColor: Colors.c1, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  logoAbbr:        { fontSize: Fonts.sizes.xxl, fontWeight: '900' },
  logoHint:        { fontSize: Fonts.sizes.xs, color: Colors.di },
  label:           { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input:           { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, color: Colors.wh, fontSize: Fonts.sizes.md },
  colorRow:        { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 6 },
  colorDot:        { width: 32, height: 32, borderRadius: 16 },
  colorDotActive:  { borderWidth: 3, borderColor: Colors.wh },
  pills:           { flexDirection: 'row', gap: 8, marginTop: 6 },
  pill:            { flex: 1, paddingVertical: 10, borderRadius: Radius.md, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center' },
  pillActive:      { backgroundColor: Colors.go, borderColor: Colors.go },
  pillText:        { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  pillTextActive:  { color: Colors.bg },
  btnPrimary:      { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginTop: 28, width: '100%' },
  btnText:         { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  btnDisabled:     { opacity: 0.5 },
  successIcon:     { marginBottom: 20 },
  codeBox: {
    backgroundColor: Colors.c2, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.go,
    paddingHorizontal: 32, paddingVertical: 20, marginVertical: 20,
  },
  code:      { fontSize: 28, fontWeight: '900', color: Colors.go, letterSpacing: 4, textAlign: 'center' },
  codeHint:  { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
});
