/**
 * Nastavení nebo změna hesla.
 *
 * Účty založené přes Google nebo Apple žádné heslo nemají — endpoint
 * `PUT /auth/password` s tím počítá a pole „současné heslo" u nich nechce.
 * Web tuhle obrazovku má od 1. 9., aplikace do teď ne, takže kdo přišel přes
 * Google/Apple, neměl jak se přihlásit e-mailem.
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';

/** Shodné s backendem (MIN_HESLO v routes/auth.js). */
const MIN_HESLO = 8;

export default function HesloScreen() {
  const { user, refreshUser } = useAuthStore();
  const maHeslo = user?.hasPassword !== false;

  const [current, setCurrent] = useState('');
  const [novy, setNovy] = useState('');
  const [znovu, setZnovu] = useState('');
  const [saving, setSaving] = useState(false);

  async function uloz() {
    if (maHeslo && !current) {
      Alert.alert('Chybí současné heslo', 'Kvůli bezpečnosti ho potřebujeme ověřit.');
      return;
    }
    if (novy.length < MIN_HESLO) {
      Alert.alert('Krátké heslo', `Heslo musí mít alespoň ${MIN_HESLO} znaků.`);
      return;
    }
    if (novy !== znovu) {
      Alert.alert('Hesla se neshodují', 'Zkontroluj obě pole.');
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword(current, novy);
      // Ať se `hasPassword` propíše — jinak by obrazovka pořád nabízela nastavení
      await refreshUser();
      Alert.alert(
        maHeslo ? 'Heslo změněno' : 'Heslo nastaveno',
        'Od teď se můžeš přihlásit i e-mailem a heslem.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      Alert.alert('Nepovedlo se', err?.response?.data?.error ?? 'Zkus to prosím znovu');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back}>
            <Ionicons name="chevron-back" size={24} color={Colors.wh} />
          </Pressable>
          <Text style={s.title}>{maHeslo ? 'Změna hesla' : 'Nastavení hesla'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.perex}>
            {maHeslo
              ? 'Nové heslo musí mít alespoň osm znaků.'
              : 'Účet je založený přes Google nebo Apple. Když si nastavíš heslo, budeš se moct přihlásit i e-mailem.'}
          </Text>

          <View style={s.card}>
            {maHeslo ? (
              <View style={[s.fieldWrap, s.fieldBorder]}>
                <Text style={s.label}>Současné heslo</Text>
                <TextInput
                  style={s.input}
                  value={current}
                  onChangeText={setCurrent}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholder="••••••••"
                  placeholderTextColor={Colors.di}
                />
              </View>
            ) : null}

            <View style={[s.fieldWrap, s.fieldBorder]}>
              <Text style={s.label}>Nové heslo</Text>
              <TextInput
                style={s.input}
                value={novy}
                onChangeText={setNovy}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Alespoň 8 znaků"
                placeholderTextColor={Colors.di}
              />
            </View>

            <View style={s.fieldWrap}>
              <Text style={s.label}>Nové heslo znovu</Text>
              <TextInput
                style={s.input}
                value={znovu}
                onChangeText={setZnovu}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Pro kontrolu"
                placeholderTextColor={Colors.di}
              />
            </View>
          </View>

          <Pressable style={s.submitBtn} onPress={uloz} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.bg} />
              : <Text style={s.submitTxt}>{maHeslo ? 'Změnit heslo' : 'Nastavit heslo'}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:       { width: 40, height: 40, justifyContent: 'center' },
  title:      { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  scroll:     { padding: 16, gap: 16 },
  perex:      { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 20 },
  card:       { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  fieldWrap:  { padding: 14 },
  fieldBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.bd },
  label:      { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', marginBottom: 6 },
  input:      { fontSize: Fonts.sizes.md, color: Colors.wh, padding: 0 },
  submitBtn:  { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  submitTxt:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
