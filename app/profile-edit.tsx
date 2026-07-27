import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { playersApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';
import { validateName, validatePhone, validateJersey, firstError } from '../utils/validation';

const POSITIONS = ['Útočník', 'Obránce', 'Brankář'];
const POS_MAP: Record<string, string> = { F: 'Útočník', D: 'Obránce', GK: 'Brankář' };
const POS_REV: Record<string, string> = { 'Útočník': 'F', 'Obránce': 'D', 'Brankář': 'GK' };

export default function ProfileEditScreen() {
  const { user, refreshUser } = useAuthStore();
  const player = user?.player;
  const [leavingTeam, setLeavingTeam] = useState(false);

  const [form, setForm] = useState({
    firstName: player?.firstName ?? '',
    lastName:  player?.lastName  ?? '',
    jersey:    String(player?.jersey ?? ''),
    position:  POS_MAP[player?.position ?? 'F'] ?? 'Útočník',
    phone:     player?.phone     ?? '',
    birthdate: player?.birthdate ? player.birthdate.split('T')[0] : '',
  });
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [photoUri, setPhotoUri]   = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Oprávnění', 'Potřebuji přístup ke galerii'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const uri = result.assets[0].uri;
    setPhotoUri(uri);
    if (!player?.id) return;
    setUploadingPhoto(true);
    try {
      await playersApi.uploadPhoto(player.id, uri);
      await refreshUser();
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se nahrát fotku');
      setPhotoUri(null);
    } finally {
      setUploadingPhoto(false);
    }
  }

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: '' }));
  }

  async function leaveTeam() {
    Alert.alert(
      'Opustit tým',
      `Opravdu chceš opustit tým ${player?.team?.name ?? ''}? Tuto akci nelze vrátit.`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Opustit', style: 'destructive',
          onPress: async () => {
            if (!player?.id) return;
            setLeavingTeam(true);
            try {
              await playersApi.leaveTeam(player.id);
              await refreshUser();
              Alert.alert('Hotovo', 'Byl jsi odebrán z týmu.');
              router.back();
            } catch (err: any) {
              Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se opustit tým');
            } finally {
              setLeavingTeam(false);
            }
          },
        },
      ],
    );
  }

  async function save() {
    const newErrors: Record<string, string> = {};
    const e1 = validateName(form.firstName, 'Jméno');       if (e1) newErrors.firstName = e1;
    const e2 = validateName(form.lastName, 'Příjmení');     if (e2) newErrors.lastName = e2;
    const e3 = validatePhone(form.phone);                   if (e3) newErrors.phone = e3;
    const e4 = validateJersey(form.jersey);                 if (e4) newErrors.jersey = e4;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const first = firstError([e1, e2, e3, e4]);
      Alert.alert('Chyba ve formuláři', first ?? 'Zkontroluj zadané údaje.');
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

        {/* Foto */}
        <Pressable style={s.avatarWrap} onPress={pickPhoto} disabled={uploadingPhoto}>
          {photoUri || player.photoUrl ? (
            <Image source={{ uri: photoUri ?? player.photoUrl }} style={s.avatarImg} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Text style={s.avatarInitials}>
                {(player.firstName?.[0] ?? '?')}{(player.lastName?.[0] ?? '')}
              </Text>
            </View>
          )}
          <View style={s.cameraIcon}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color={Colors.wh} />
              : <Ionicons name="camera" size={16} color={Colors.wh} />
            }
          </View>
        </Pressable>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Osobní údaje</Text>
          <View style={s.card}>
            <Field label="Jméno *" value={form.firstName} onChange={v => set('firstName', v)} placeholder="Tomáš" error={errors.firstName} />
            <Field label="Příjmení *" value={form.lastName} onChange={v => set('lastName', v)} placeholder="Novák" error={errors.lastName} />
            <Field label="Telefon" value={form.phone} onChange={v => set('phone', v)} placeholder="+420 601 234 567" keyboardType="phone-pad" error={errors.phone} />
            <Field label="Datum narození" value={form.birthdate} onChange={v => set('birthdate', v)} placeholder="DD.MM.RRRR" last />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionLabel}>Hráčské údaje</Text>
          <View style={s.card}>
            <Field label="Číslo dresu" value={form.jersey} onChange={v => set('jersey', v)} placeholder="10" keyboardType="number-pad" error={errors.jersey} />
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

        {/* Opustit tým */}
        {player?.teamId && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Tým</Text>
            <View style={s.card}>
              <View style={s.fieldWrap}>
                <Text style={s.label}>Aktuální tým</Text>
                <Text style={{ fontSize: Fonts.sizes.md, color: Colors.wh, marginTop: 2 }}>{player?.team?.name ?? '—'}</Text>
              </View>
              <Pressable
                style={[s.leaveBtn, leavingTeam && { opacity: 0.5 }]}
                onPress={leaveTeam}
                disabled={leavingTeam}
              >
                {leavingTeam
                  ? <ActivityIndicator color={Colors.red} size="small" />
                  : <>
                      <Ionicons name="exit-outline" size={16} color={Colors.red} />
                      <Text style={s.leaveTxt}>Opustit tým</Text>
                    </>
                }
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad' | 'email-address';
  last?: boolean;
  error?: string;
}

function Field({ label, value, onChange, placeholder, keyboardType, last, error }: FieldProps) {
  return (
    <View style={[s.fieldWrap, !last && s.fieldBorder]}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        style={[s.input, error ? { color: Colors.red } : {}]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.di}
        keyboardType={keyboardType ?? 'default'}
        keyboardAppearance="dark"
      />
      {!!error && <Text style={s.errorTxt}>{error}</Text>}
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
  scroll:     { padding: 16, gap: 16, alignItems: 'center' },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  avatarImg:  { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: Colors.go },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.c2, borderWidth: 2, borderColor: Colors.go, justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.go },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.go, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.bg },
  section:    { gap: 6, width: '100%' },
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
  submitBtn:  { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginTop: 8, width: '100%' },
  submitTxt:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  errorTxt:   { fontSize: Fonts.sizes.xs, color: Colors.red, marginTop: 4 },
  leaveBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderTopWidth: 1, borderTopColor: Colors.bd },
  leaveTxt:   { fontSize: Fonts.sizes.sm, color: Colors.red, fontWeight: '600' },
});
