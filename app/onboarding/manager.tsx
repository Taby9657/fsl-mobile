// Vedoucí registruje nový tým – 2 kroky
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { teamsApi, seasonsApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { saveDraft, clearDraft } from '../../utils/draftRegistration';
import { TeamColorPicker } from '../../components/TeamColorPicker';
import { Colors, Fonts, Radius } from '../../constants/colors';

export default function ManagerOnboardingScreen() {
  const refreshUser = useAuthStore(s => s.refreshUser);
  const [step, setStep]       = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [logo, setLogo]       = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');

  // Divizi tým nedostává při registraci — přiděluje ji supervisor při schvalování
  const [form, setForm] = useState<{ name: string; abbr: string; color: string; colorSecondary: string | null }>({
    name: '', abbr: '', color: '#C9A140', colorSecondary: '#F5F5F5',
  });

  // Sezóna, do které se tým přihlašuje. Bez ní by spadl do té, kterou zrovna
  // ukazuje liga, a při přepnutí sezóny by ze soutěže zmizel.
  const [season, setSeason]   = useState<string | null>(null);
  const [sezony, setSezony]   = useState<string[]>([]);

  useEffect(() => {
    seasonsApi.list()
      .then(r => {
        const { current, next, options } = r.data;
        // Nabízíme aktuální a následující — zpětně se tým přihlašovat nemá proč
        const nabidka = [current, next].filter(Boolean) as string[];
        setSezony(nabidka.length > 0 ? nabidka : (options ?? []));
        setSeason(current ?? nabidka[0] ?? null);
      })
      .catch(() => {});
  }, []);

  // Kdyby odešel uprostřed, nabídneme mu příště pokračování
  useEffect(() => { saveDraft({ role: 'manager' }); }, []);

  function set(key: string, val: string | null) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function pickLogo() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Přístup k fotkám',
          'Pro nahrání loga potřebuje FSL přístup ke galerii. Povol ho v Nastavení → FSL → Fotky.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setLogo(result.assets[0].uri);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se otevřít galerii. Zkus to prosím znovu.');
    }
  }

  async function createTeam() {
    if (!form.name || !form.abbr) {
      Alert.alert('Vyplň povinné údaje', 'Název a zkratka týmu jsou povinné.'); return;
    }
    if (form.abbr.length > 3) {
      Alert.alert('Zkratka', 'Zkratka týmu může mít maximálně 3 znaky.'); return;
    }
    if (!season) {
      Alert.alert('Vyber sezónu', 'Urči, do které sezóny tým přihlašuješ.'); return;
    }
    setLoading(true);
    try {
      const res = await teamsApi.create({ ...form, season });
      const teamId = res.data.team.id;
      const code   = res.data.inviteCode;

      // Tým je založený i bez loga — případné selhání uploadu proto jen ohlásíme
      let logoFailed = false;
      if (logo) {
        try {
          await teamsApi.uploadLogo(teamId, logo);
        } catch {
          logoFailed = true;
        }
      }
      setInviteCode(code);
      await clearDraft();
      await refreshUser();
      setStep(2);
      if (logoFailed) {
        Alert.alert(
          'Logo se nenahrálo',
          'Tým je vytvořený, ale logo se nepodařilo uložit. Zkus ho nahrát znovu v soupisce týmu.',
        );
      }
    } catch (err: any) {
      Alert.alert('Chyba', err.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setLoading(false);
    }
  }

  // Krok 2 – pozvánkový kód
  if (step === 2) {
    async function shareCode() {
      try {
        await Share.share({
          message: `Připoj se k týmu ve Floorball Stars Lize! 🏑\n\nPozvánkový kód: ${inviteCode}\n\nStáhni appku FSL a zadej kód při registraci.`,
          title: 'Pozvánka do FSL',
        });
      } catch {}
    }

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

          <Pressable style={styles.btnPrimary} onPress={shareCode}>
            <Ionicons name="share-outline" size={18} color={Colors.bg} style={{ marginRight: 8 }} />
            <Text style={styles.btnText}>Sdílet pozvánku</Text>
          </Pressable>

          <Pressable style={[styles.btnPrimary, { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.bd, marginTop: 10 }]}
            onPress={() => router.replace('/onboarding/complete')}>
            <Text style={[styles.btnText, { color: Colors.mu }]}>Co dál →</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Krok 1 – formulář týmu
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
        <View style={{ marginTop: 20 }}>
          <TeamColorPicker
            primary={form.color}
            onPrimary={c => set('color', c)}
            secondary={form.colorSecondary}
            onSecondary={c => set('colorSecondary', c)}
            abbr={form.abbr}
          />
        </View>

        {/* Sezóna */}
        {sezony.length > 0 && (
          <>
            <Text style={styles.label}>Sezóna *</Text>
            <View style={styles.seasonRow}>
              {sezony.map(sz => (
                <Pressable
                  key={sz}
                  style={[styles.seasonChip, season === sz && styles.seasonChipActive]}
                  onPress={() => setSeason(sz)}
                >
                  <Text style={[styles.seasonTxt, season === sz && styles.seasonTxtActive]}>{sz}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.seasonHint}>
              Tým se přihlašuje na jednu sezónu. Do další se přihlašuje znovu.
            </Text>
          </>
        )}

        {/* Divizi přiděluje supervisor */}
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.mu} />
          <Text style={styles.noteTxt}>
            Divizi týmu přidělí supervisor při schvalování registrace. Uvidíš ji pak ve Správě.
          </Text>
        </View>

        <Pressable style={[styles.btnPrimary, loading && styles.btnDisabled]} onPress={createTeam} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnText}>Vytvořit tým</Text>}
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
      </KeyboardAvoidingView>
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
  seasonRow:        { flexDirection: 'row', gap: 8 },
  seasonChip:       { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  seasonChipActive: { backgroundColor: Colors.go, borderColor: Colors.go },
  seasonTxt:        { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '700' },
  seasonTxtActive:  { color: Colors.bg },
  seasonHint:       { fontSize: Fonts.sizes.xs, color: Colors.di, lineHeight: 16, marginTop: 6 },
  label:           { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input:           { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, color: Colors.wh, fontSize: Fonts.sizes.md },
  note:            { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 20, padding: 12, borderRadius: Radius.md, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd },
  noteTxt:         { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18 },
  btnPrimary:      { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 28, width: '100%' },
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
