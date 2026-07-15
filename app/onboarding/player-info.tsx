// Hráč vyplní osobní údaje + foto
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { playersApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';

const POSITIONS = ['Útočník', 'Obránce', 'Brankář'];

export default function PlayerInfoScreen() {
  const { teamId, teamName } = useLocalSearchParams<{ teamId: string; teamName: string }>();
  const refreshUser = useAuthStore(s => s.refreshUser);

  const [form, setForm] = useState({
    firstName: '', lastName: '', jersey: '',
    position: 'Útočník', phone: '', birthdate: '',
  });
  const [photo, setPhoto]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function submit() {
    if (!form.firstName || !form.lastName || !form.jersey) {
      Alert.alert('Vyplň povinné údaje', 'Jméno, příjmení a číslo dresu jsou povinné.'); return;
    }
    setLoading(true);
    try {
      const res = await playersApi.create({
        firstName: form.firstName, lastName: form.lastName,
        jersey: form.jersey, position: form.position,
        phone: form.phone || undefined, birthdate: form.birthdate || undefined,
        teamId,
      });
      if (photo) {
        await playersApi.uploadPhoto(res.data.id, photo).catch(() => {});
      }
      await refreshUser();
      router.replace('/onboarding/complete');
    } catch (err: any) {
      Alert.alert('Chyba', err.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Zpět</Text>
        </Pressable>

        <Text style={styles.title}>Tvůj profil</Text>
        <Text style={styles.subtitle}>Tým: <Text style={{ color: Colors.go }}>{teamName}</Text></Text>

        {/* Foto */}
        <Pressable style={styles.photoBtn} onPress={pickPhoto}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera" size={28} color={Colors.mu} />
              <Text style={styles.photoText}>Přidat foto</Text>
            </View>
          )}
        </Pressable>

        {/* Jméno */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Jméno *</Text>
            <TextInput style={styles.input} value={form.firstName} onChangeText={v => set('firstName', v)}
              placeholder="Tomáš" placeholderTextColor={Colors.di} keyboardAppearance="dark" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Příjmení *</Text>
            <TextInput style={styles.input} value={form.lastName} onChangeText={v => set('lastName', v)}
              placeholder="Novák" placeholderTextColor={Colors.di} keyboardAppearance="dark" />
          </View>
        </View>

        {/* Dres + pozice */}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Číslo dresu *</Text>
            <TextInput style={styles.input} value={form.jersey} onChangeText={v => set('jersey', v)}
              placeholder="10" placeholderTextColor={Colors.di} keyboardType="number-pad" keyboardAppearance="dark" />
          </View>
          <View style={{ flex: 2 }}>
            <Text style={styles.label}>Pozice</Text>
            <View style={styles.pills}>
              {POSITIONS.map(p => (
                <Pressable key={p} style={[styles.pill, form.position === p && styles.pillActive]}
                  onPress={() => set('position', p)}>
                  <Text style={[styles.pillText, form.position === p && styles.pillTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Telefon */}
        <Text style={styles.label}>Telefon</Text>
        <TextInput style={styles.input} value={form.phone} onChangeText={v => set('phone', v)}
          placeholder="+420 601 234 567" placeholderTextColor={Colors.di}
          keyboardType="phone-pad" keyboardAppearance="dark" />

        {/* Datum narození */}
        <Text style={styles.label}>Datum narození</Text>
        <TextInput style={styles.input} value={form.birthdate} onChangeText={v => set('birthdate', v)}
          placeholder="1995-06-15" placeholderTextColor={Colors.di} keyboardAppearance="dark" />

        <Pressable style={[styles.btnPrimary, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnText}>Dokončit registraci</Text>}
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.bg },
  scroll:          { padding: 24, paddingTop: 16 },
  back:            { marginBottom: 20 },
  backText:        { color: Colors.go, fontSize: Fonts.sizes.md },
  title:           { fontSize: Fonts.sizes.h1, fontWeight: '900', color: Colors.wh, marginBottom: 4 },
  subtitle:        { fontSize: Fonts.sizes.md, color: Colors.mu, marginBottom: 24 },
  photoBtn:        { alignSelf: 'center', marginBottom: 24 },
  photo:           { width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: Colors.go },
  photoPlaceholder:{ width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, justifyContent: 'center', alignItems: 'center', gap: 4 },
  photoText:       { fontSize: Fonts.sizes.xs, color: Colors.mu },
  row:             { flexDirection: 'row', gap: 12, marginBottom: 0 },
  label:           { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  input:           { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, color: Colors.wh, fontSize: Fonts.sizes.md },
  pills:           { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  pill:            { paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd },
  pillActive:      { backgroundColor: Colors.go, borderColor: Colors.go },
  pillText:        { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },
  pillTextActive:  { color: Colors.bg },
  btnPrimary:      { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginTop: 28 },
  btnText:         { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  btnDisabled:     { opacity: 0.5 },
});
