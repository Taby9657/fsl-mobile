import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { draftApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';

const POSITIONS = ['Útočník', 'Obránce', 'Brankář', 'Univerzál'];

export default function DraftProfileEdit() {
  const { user } = useAuthStore();
  const myPlayer = user?.player;

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);

  const [bio,      setBio]      = useState('');
  const [pubSkill, setPubSkill] = useState('');
  const [position, setPosition] = useState('');
  const [videos,   setVideos]   = useState<any[]>([]);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    draftApi.me()
      .then(r => {
        const p = r.data;
        if (p) {
          setHasProfile(true);
          setBio(p.bio ?? '');
          setPubSkill(p.pubSkill ?? '');
          setPosition(p.position ?? '');
          setVideos(p.videos ?? []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      if (hasProfile) {
        await draftApi.updateProfile({ bio, pubSkill, position });
      } else {
        await draftApi.createProfile({ bio, pubSkill, position });
        setHasProfile(true);
      }
      Alert.alert('Hotovo', 'Profil uložen!', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se uložit');
    } finally {
      setSaving(false);
    }
  }

  async function pickVideo() {
    if (videos.length >= 5) {
      Alert.alert('Limit', 'Maximálně 5 videí na profil');
      return;
    }
    if (!hasProfile) {
      Alert.alert('Nejprve ulož profil', 'Ulož základní info profilu před nahráváním videa.');
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Oprávnění', 'Povol přístup k médiím v nastavení.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['video'] as any,
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const res = await draftApi.uploadVideo(asset.uri);
      setVideos(prev => [...prev, res.data]);
    } catch (err: any) {
      Alert.alert('Chyba nahrávání', err?.response?.data?.error ?? 'Nepodařilo se nahrát video');
    } finally {
      setUploading(false);
    }
  }

  async function deleteVideo(videoId: string) {
    Alert.alert('Smazat video', 'Opravdu smazat?', [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Smazat', style: 'destructive',
        onPress: async () => {
          setDeletingId(videoId);
          try {
            await draftApi.deleteVideo(videoId);
            setVideos(prev => prev.filter(v => v.id !== videoId));
          } catch (err: any) {
            Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se smazat');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  async function deactivate() {
    Alert.alert('Odebrat z draftu', 'Odebereš svůj profil z draft poolu. Nabídky se zruší.', [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Odebrat', style: 'destructive',
        onPress: async () => {
          try {
            await draftApi.deleteProfile();
            router.back();
          } catch (err: any) {
            Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se odebrat');
          }
        },
      },
    ]);
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} style={s.back}>
            <Ionicons name="chevron-back" size={24} color={Colors.wh} />
          </Pressable>
          <Text style={s.title}>{hasProfile ? 'Upravit draft profil' : 'Vytvořit draft profil'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">

          {/* Pozice */}
          <Text style={s.label}>Pozice</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {POSITIONS.map(p => (
                <Pressable
                  key={p}
                  style={[s.posChip, position === p && s.posChipActive]}
                  onPress={() => setPosition(p)}
                >
                  <Text style={[s.posChipTxt, position === p && s.posChipTxtActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Bio */}
          <Text style={s.label}>O sobě</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={bio}
            onChangeText={setBio}
            placeholder="Napiš něco o sobě – zkušenosti, styl hry, co hledáš..."
            placeholderTextColor={Colors.di}
            multiline
            numberOfLines={4}
            keyboardAppearance="dark"
          />

          {/* Pub skill */}
          <Text style={s.label}>Pub skill / Selling point</Text>
          <Text style={s.hint}>Napiš svůj největší skill, trik nebo kontroverzní výrok. Čím víc osobitosti, tím lépe!</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={pubSkill}
            onChangeText={setPubSkill}
            placeholder={'Např. „Největší sekera v české florbalové historii" nebo „Dám gól každý zápas, garantuju."'}
            placeholderTextColor={Colors.di}
            multiline
            numberOfLines={3}
            keyboardAppearance="dark"
          />

          {/* Videa */}
          <Text style={s.label}>Sestřih videí ({videos.length}/5)</Text>
          <Text style={s.hint}>Nahraj videa ze svých zápasů nebo tréninků. Manažeři je uvidí na tvém profilu.</Text>

          {videos.map((v, idx) => (
            <View key={v.id} style={s.videoRow}>
              <Ionicons name="videocam" size={18} color={Colors.go} />
              <Pressable style={{ flex: 1 }} onPress={() => Linking.openURL(v.url)}>
                <Text style={s.videoUrl} numberOfLines={1}>Video {idx + 1}</Text>
              </Pressable>
              {deletingId === v.id
                ? <ActivityIndicator size="small" color={Colors.red} />
                : (
                  <Pressable onPress={() => deleteVideo(v.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={Colors.red} />
                  </Pressable>
                )}
            </View>
          ))}

          {videos.length < 5 && (
            <Pressable style={[s.uploadBtn, uploading && { opacity: 0.5 }]} onPress={pickVideo} disabled={uploading}>
              {uploading
                ? <ActivityIndicator color={Colors.go} size="small" />
                : <>
                    <Ionicons name="cloud-upload-outline" size={18} color={Colors.go} />
                    <Text style={s.uploadBtnTxt}>Nahrát video</Text>
                  </>
              }
            </Pressable>
          )}

          {/* Uložit */}
          <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.bg} />
              : <Text style={s.saveBtnTxt}>{hasProfile ? 'Uložit změny' : 'Vytvořit profil'}</Text>
            }
          </Pressable>

          {/* Odebrat z draftu */}
          {hasProfile && (
            <Pressable style={s.removeBtn} onPress={deactivate}>
              <Text style={s.removeBtnTxt}>Odebrat se z draft poolu</Text>
            </Pressable>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:         { width: 40, height: 40, justifyContent: 'center' },
  title:        { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },

  label:        { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  hint:         { fontSize: Fonts.sizes.xs, color: Colors.di, marginBottom: 8, lineHeight: 17 },

  posChip:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  posChipActive:{ backgroundColor: Colors.go, borderColor: Colors.go },
  posChipTxt:   { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  posChipTxtActive: { color: Colors.bg },

  input:        { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh, marginBottom: 4 },
  inputMulti:   { textAlignVertical: 'top', minHeight: 90 },

  videoRow:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.c1, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd, padding: 12, marginBottom: 6 },
  videoUrl:     { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '500' },

  uploadBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: Colors.go, borderRadius: Radius.md, borderStyle: 'dashed', padding: 14, justifyContent: 'center', marginTop: 4 },
  uploadBtnTxt: { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '600' },

  saveBtn:      { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnTxt:   { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },

  removeBtn:    { alignItems: 'center', padding: 14, marginTop: 10 },
  removeBtnTxt: { fontSize: Fonts.sizes.sm, color: Colors.red, fontWeight: '600' },
});
