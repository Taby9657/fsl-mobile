import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { playersApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';

const POSITIONS = ['Útočník', 'Obránce', 'Brankář'];
const POS_MAP: Record<string, string> = { F: 'Útočník', D: 'Obránce', GK: 'Brankář' };
const POS_REV: Record<string, string> = { 'Útočník': 'F', 'Obránce': 'D', 'Brankář': 'GK' };

export default function ProfileEditScreen() {
  const { user, refreshUser } = useAuthStore();
  const player = user?.player;

  const [form, setForm] = useState({
    firstName: player?.firstName ?? '',
    lastName:  player?.lastName  ?? '',
    jersey:    String(player?.jersey ?? ''),
    position:  POS_MAP[player?.position ?? 'F'] ?? 'Útočník',
    phone:     player?.phone     ?? '',
    birthdate: player?.birthdate ? player.birthdate.split('T')[0] : '',
  });
  const [saving, setSaving] = useState(false);

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function save() {
    if (!form.firstName || !form.lastName) {
      Alert.alert('Chybí jméno', 'Jméno a příjmení jsou povinné');
      return;
    }
    if (!player?.id) { Alert.alert('Chyba', 'Hráčský profil nenalezen'); return; }
    setSaving(true);
    try {
      await playersApi.update(player.id, {
        firstName: form.firstName,
        lastName:  form.lastName,
        jersey:    form.jersey ? parseInt(form.jersey) : undefined,
        position:  POS_REV[form.position] ?? 'F',
        phone:     form.phone     || undefined,
        birthdate: form.birthdate || undefined,
      });
      await refreshUser();
      Alert.alert('Uloženo', 'Profil byl úspěšně aktualizován');
      router.back();
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se uložit');
    } finally {
      setSaving(false);
    }
  }

  if (!player) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={24} color={Colors.wh} /></Pressable>
      </View>
      <View style={s.center}><Text style={s.empty}>Hráčský profil nenalezen</Text></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Upravit profil</Text>
        <Pressable onPress={save} disabled={saving} style={{ padding: 4 }}>
          {saving
            ? <ActivityIndicator color={Colors.go} size="small" />
            : <Text style={s.saveBtn}>Uložit</Text>
          }
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.section}>
          <Text style={s.sectionLabel}>Osobní údaje</Text>
          <View style={s.card}>
            <Field label="Jméno *" value={form.firstName} onChange={v => set('firstName', v)} placeholder="Tomáš" />
            <Field label="Příjmení *" value={form.lastName} onChange={v => set('lastName', v)} placeholder="Novák" />
            <Field label="Telefon" value={form.phone} onChange={v => set('phone', v)} placeholder="+420 601 234 567" keyboardType="phone-pad" />
            <Field label="Datum narození" value={form.birthdate} onChange={v => set('birthdate', v)} placeholder="1995-06-15" last />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Hráčské údaje</Text>
          <View style={s.card}>
            <Field label="Číslo dresu" value={form.jersey} onChange={v => set('jersey', v)} placeholder="10" keyboardType="number-pad" />
            <View style={s.fieldWrap}>
              <Text style={s.label}>Pozice</Text>
              <View style={s.pills}>
                {POSITIONS.map(p => (
                  <Pressable key={p} style={[s.pill, form.position === p && s.pillActive]} onPress={() => set('position', p)}>
                    <Text style={[s.pillTxt, form.position === p && s.pillTxtActive]}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </View>

        <Pressable style={[s.submitBtn, saving && { opacity: 0.5 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.submitTxt}>Uložit změny</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, last }: any) {
  return (
    <View style={[s.fieldWrap, !last && s.fieldBorder]}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.di}
        keyboardType={keyboardType ?? 'default'}
        keyboardAppearance="dark"
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:       { width: 40, height: 40, justifyContent: 'center' },
  title:      { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  saveBtn:    { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '700' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:      { color: Colors.mu },
  scroll:     { padding: 16, gap: 16 },
  section:    { gap: 6 },
  sectionLabel:{ fontSize: 11, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  card:       { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  fieldWrap:  { padding: 14 },
  fieldBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.bd },
  label:      { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', marginBottom: 6 },
  input:      { fontSize: Fonts.sizes.md, color: Colors.wh, padding: 0 },
  pills:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd },
  pillActive: { backgroundColor: Colors.go, borderColor: Colors.go },
  pillTxt:    { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  pillTxtActive:{ color: Colors.bg },
  submitBtn:  { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginTop: 8 },
  submitTxt:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
