import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { refereesApi } from '../services/api';
import { DoneBar, DONE_BAR_ID } from '../components/DoneBar';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';
import { validatePhone } from '../utils/validation';

const LEVEL_LABEL: Record<string, string> = { A: 'Úroveň A (senior)', B: 'Úroveň B', C: 'Úroveň C (junior)' };

export default function RefereeProfileScreen() {
  const { user } = useAuthStore();
  const refId    = user?.referee?.id;

  const [loading, setSaving]   = useState(false);
  const [ref, setRef]          = useState<any>(null);
  const [edit, setEdit]        = useState(false);
  const [form, setForm]        = useState({ phone: '', birthNo: '', address: '', city: '', zip: '', bankAccount: '', bankCode: '' });

  useEffect(() => {
    if (!refId) return;
    refereesApi.get(refId).then(r => {
      setRef(r.data);
      setForm({
        phone:       r.data.phone       ?? '',
        birthNo:     r.data.birthNo     ?? '',
        address:     r.data.address     ?? '',
        city:        r.data.city        ?? '',
        zip:         r.data.zip         ?? '',
        bankAccount: r.data.bankAccount ?? '',
        bankCode:    r.data.bankCode    ?? '',
      });
    });
  }, [refId]);

  async function save() {
    if (!refId) return;
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) { Alert.alert('Chyba', phoneErr); return; }
    if (!form.bankAccount.trim()) { Alert.alert('Chyba', 'Číslo účtu je povinné pro výplatu odměn.'); return; }
    setSaving(true);
    try {
      await refereesApi.update(refId, form);
      setRef({ ...ref, ...form });
      setEdit(false);
      Alert.alert('Uloženo');
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se uložit');
    } finally {
      setSaving(false);
    }
  }

  const statusColor = ref?.status === 'APPROVED' ? Colors.green : ref?.status === 'REJECTED' ? Colors.red : '#F59E0B';
  const statusLabel = ref?.status === 'APPROVED' ? 'Schválen' : ref?.status === 'REJECTED' ? 'Zamítnut' : 'Čeká na schválení';

  function Field({ label, field, keyboardType }: { label: string; field: keyof typeof form; keyboardType?: 'default' | 'phone-pad' | 'number-pad' }) {
    const needsDoneBar = keyboardType === 'number-pad' || keyboardType === 'phone-pad';
    return (
      <View style={{ marginBottom: 14 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        {edit ? (
          <TextInput
            style={s.input}
            value={form[field]}
            onChangeText={v => setForm(p => ({ ...p, [field]: v }))}
            placeholderTextColor={Colors.di}
            placeholder={label}
            keyboardType={keyboardType ?? 'default'}
            keyboardAppearance="dark"
            returnKeyType="done"
            inputAccessoryViewID={needsDoneBar ? DONE_BAR_ID : undefined}
          />
        ) : (
          <Text style={s.fieldValue}>{(ref?.[field] as string) || '—'}</Text>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <DoneBar />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Profil rozhodčího</Text>
        <Pressable onPress={() => setEdit(v => !v)}>
          <Text style={{ color: Colors.go, fontWeight: '600', fontSize: Fonts.sizes.sm }}>
            {edit ? 'Zrušit' : 'Upravit'}
          </Text>
        </Pressable>
      </View>

      {!ref ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>

          {/* Stav & úroveň */}
          <View style={s.topCard}>
            <View style={s.avatar}>
              <Ionicons name="person" size={28} color={Colors.go} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.refName}>{ref.firstName} {ref.lastName}</Text>
              <Text style={s.refLevel}>{LEVEL_LABEL[ref.level] ?? ref.level}</Text>
            </View>
            <View style={[s.statusChip, { borderColor: statusColor, backgroundColor: `${statusColor}22` }]}>
              <Text style={[s.statusTxt, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {ref.status === 'PENDING' && (
            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.go} />
              <Text style={s.infoTxt}>Tvoje registrace čeká na schválení supervisorem. Obdržíš notifikaci.</Text>
            </View>
          )}

          {/* Kontaktní údaje */}
          <Text style={s.section}>Kontaktní údaje</Text>
          <View style={s.card}>
            <Field label="Telefon"  field="phone"   keyboardType="phone-pad" />
            {/* Rodné číslo šlo dřív vyplnit jen při registraci z webu */}
            <Field label="Rodné číslo" field="birthNo" />
            <Field label="Adresa"   field="address" />
            <Field label="Město"    field="city" />
            <Field label="PSČ"      field="zip"     keyboardType="number-pad" />
          </View>

          {/* Bankovní spojení */}
          <Text style={[s.section, { marginTop: 20 }]}>Bankovní spojení (výplaty)</Text>
          <View style={s.card}>
            <Field label="Číslo účtu" field="bankAccount" keyboardType="number-pad" />
            <Field label="Kód banky"  field="bankCode"    keyboardType="number-pad" />
          </View>
          <Text style={s.note}>Bankovní údaje jsou potřeba pro výplatu odměn za zápasy.</Text>

          {edit && (
            <Pressable
              style={[s.saveBtn, loading && { opacity: 0.6 }]}
              onPress={save}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.bg} size="small" />
                : <Text style={s.saveBtnText}>Uložit změny</Text>
              }
            </Pressable>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:       { width: 40, height: 40, justifyContent: 'center' },
  title:      { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topCard:    { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar:     { width: 52, height: 52, borderRadius: 26, backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center' },
  refName:    { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  refLevel:   { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  statusChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  statusTxt:  { fontSize: Fonts.sizes.xs, fontWeight: '600' },
  infoBox:    { flexDirection: 'row', gap: 8, backgroundColor: `${Colors.go}15`, borderRadius: Radius.sm, padding: 12, marginBottom: 16 },
  infoTxt:    { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.go, lineHeight: 16 },
  section:    { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  card:       { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16 },
  fieldLabel: { fontSize: Fonts.sizes.xs, color: Colors.di, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldValue: { fontSize: Fonts.sizes.md, color: Colors.wh, fontWeight: '500' },
  input:      { backgroundColor: Colors.c2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd, color: Colors.wh, padding: 10, fontSize: Fonts.sizes.md },
  note:       { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 8, lineHeight: 16 },
  saveBtn:    { backgroundColor: Colors.go, borderRadius: Radius.md, height: 50, justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  saveBtnText:{ fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
