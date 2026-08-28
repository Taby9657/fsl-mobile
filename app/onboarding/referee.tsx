// Onboarding rozhodčího – 2 kroky: osobní údaje → souhrn.
//
// Rodné číslo, adresu a bankovní spojení tady záměrně nechceme. Kdo si teprve
// zkouší, jestli chce pískat, nemá důvod je vyplňovat dřív, než ho supervisor
// schválí. Doplní je pak ve svém profilu — backend je má jako volitelné.
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { refereesApi } from '../../services/api';
import { DoneBar, DONE_BAR_ID } from '../../components/DoneBar';
import { useAuthStore } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';

type Step = 1 | 2;

interface FormData {
  firstName: string; lastName: string; phone: string;
}

export default function RefereeOnboardingScreen() {
  const refreshUser = useAuthStore(s => s.refreshUser);
  const [step, setStep]       = useState<Step>(1);
  const [photo, setPhoto]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState<FormData>({
    firstName: '', lastName: '', phone: '',
  });

  function set(key: keyof FormData, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function pickPhoto() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Přístup k fotkám',
          'Pro nahrání fotky potřebuje FSL přístup ke galerii. Povol ho v Nastavení → FSL → Fotky.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, aspect: [1, 1], quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setPhoto(result.assets[0].uri);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se otevřít galerii. Zkus to prosím znovu.');
    }
  }

  function nextStep() {
    if (step === 1) {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        Alert.alert('Vyplň jméno a příjmení'); return;
      }
      setStep(2);
    }
  }

  async function submit() {
    setLoading(true);
    try {
      const res = await refereesApi.register(form);
      if (photo) {
        await refereesApi.uploadPhoto(res.data.id, photo).catch(() => {});
      }
      await refreshUser();
      router.replace('/onboarding/complete');
    } catch (err: any) {
      Alert.alert('Chyba', err.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setLoading(false);
    }
  }

  const STEPS = ['Osobní údaje', 'Souhrn'];

  return (
    <SafeAreaView style={styles.safe}>
      <DoneBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Progress bar */}
      <View style={styles.progressRow}>
        {STEPS.map((label, idx) => (
          <View key={label} style={styles.progressItem}>
            <View style={[styles.progressDot, idx < step && styles.progressDotDone, idx + 1 === step && styles.progressDotActive]}>
              {idx + 1 < step
                ? <Ionicons name="checkmark" size={12} color={Colors.bg} />
                : <Text style={styles.progressNum}>{idx + 1}</Text>
              }
            </View>
            <Text style={[styles.progressLabel, idx + 1 === step && { color: Colors.wh }]}>{label}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* KROK 1 – Osobní údaje */}
        {step === 1 && (
          <>
            <Text style={styles.title}>Přihláška rozhodčího</Text>
            <Text style={styles.subtitle}>
              Zatím po tobě chceme jen jméno a kontakt. Rodné číslo a účet pro výplatu
              odměn doplníš ve svém profilu, až tě supervisor schválí.
            </Text>

            <Pressable style={styles.photoBtn} onPress={pickPhoto}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={28} color={Colors.mu} />
                  <Text style={styles.photoHint}>Foto</Text>
                </View>
              )}
            </Pressable>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Jméno *</Text>
                <TextInput style={styles.input} value={form.firstName} onChangeText={v => set('firstName', v)}
                  placeholder="Jan" placeholderTextColor={Colors.di} keyboardAppearance="dark" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Příjmení *</Text>
                <TextInput style={styles.input} value={form.lastName} onChangeText={v => set('lastName', v)}
                  placeholder="Procházka" placeholderTextColor={Colors.di} keyboardAppearance="dark" />
              </View>
            </View>

            <Text style={styles.label}>Telefon</Text>
            <TextInput style={styles.input} value={form.phone} onChangeText={v => set('phone', v)}
              placeholder="+420 601 234 567" placeholderTextColor={Colors.di}
              keyboardType="phone-pad" keyboardAppearance="dark"
              returnKeyType="done" inputAccessoryViewID={DONE_BAR_ID} />
          </>
        )}

        {/* KROK 2 – Souhrn */}
        {step === 2 && (
          <>
            <Text style={styles.title}>Zkontroluj údaje</Text>

            {photo && <Image source={{ uri: photo }} style={styles.photoLarge} />}

            {[
              { label: 'Jméno',   value: `${form.firstName} ${form.lastName}` },
              { label: 'Telefon', value: form.phone || '—' },
            ].map(row => (
              <View key={row.label} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{row.label}</Text>
                <Text style={styles.summaryValue}>{row.value}</Text>
              </View>
            ))}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle" size={18} color={Colors.go} />
              <Text style={styles.infoText}>
                Přihlášku schvaluje supervisor FSL, obvykle do 48 hodin — přijde ti notifikace.
                Než odpískáš první zápas, budeš v profilu potřebovat doplnit rodné číslo,
                adresu a bankovní spojení pro výplatu odměn.
              </Text>
            </View>
          </>
        )}

        {/* Navigační tlačítka */}
        <View style={styles.btnRow}>
          {step > 1 && (
            <Pressable style={styles.btnBack} onPress={() => setStep(s => (s - 1) as Step)}>
              <Text style={styles.btnBackText}>Zpět</Text>
            </Pressable>
          )}
          {step < 2 ? (
            <Pressable style={[styles.btnPrimary, { flex: 1 }]} onPress={nextStep}>
              <Text style={styles.btnText}>Pokračovat</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.btnPrimary, { flex: 1 }, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnText}>Odeslat registraci</Text>}
            </Pressable>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.bg },
  scroll:          { padding: 24, paddingTop: 8 },
  progressRow:     { flexDirection: 'row', justifyContent: 'center', gap: 0, paddingVertical: 16, paddingHorizontal: 32 },
  progressItem:    { flex: 1, alignItems: 'center', gap: 4 },
  progressDot:     { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, justifyContent: 'center', alignItems: 'center' },
  progressDotDone: { backgroundColor: Colors.go, borderColor: Colors.go },
  progressDotActive:{ borderColor: Colors.go },
  progressNum:     { fontSize: 11, fontWeight: '700', color: Colors.mu },
  progressLabel:   { fontSize: 10, color: Colors.di, fontWeight: '600' },
  title:           { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.wh, marginBottom: 4 },
  subtitle:        { fontSize: Fonts.sizes.sm, color: Colors.mu, marginBottom: 16, lineHeight: 20 },
  photoBtn:        { alignSelf: 'center', marginBottom: 20 },
  photo:           { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: Colors.go },
  photoPlaceholder:{ width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, justifyContent: 'center', alignItems: 'center', gap: 4 },
  photoHint:       { fontSize: Fonts.sizes.xs, color: Colors.mu },
  photoLarge:      { width: 88, height: 88, borderRadius: 44, alignSelf: 'center', marginBottom: 20 },
  row:             { flexDirection: 'row', gap: 12 },
  label:           { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input:           { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, color: Colors.wh, fontSize: Fonts.sizes.md },
  summaryRow:      { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  summaryLabel:    { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  summaryValue:    { fontSize: Fonts.sizes.sm, color: Colors.wh, flex: 1, textAlign: 'right' },
  infoBox:         { flexDirection: 'row', gap: 10, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.go + '44', padding: 14, marginTop: 20, alignItems: 'flex-start' },
  infoText:        { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 20 },
  btnRow:          { flexDirection: 'row', gap: 10, marginTop: 28 },
  btnPrimary:      { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  btnText:         { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  btnBack:         { backgroundColor: Colors.c1, borderRadius: Radius.md, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.bd, paddingHorizontal: 20 },
  btnBackText:     { fontSize: Fonts.sizes.md, color: Colors.mu, fontWeight: '600' },
  btnDisabled:     { opacity: 0.5 },
});
