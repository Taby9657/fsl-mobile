import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, Modal, TextInput,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { highlightsApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface HForm { round: string; title: string; body: string; pinned: boolean; }
const EMPTY: HForm = { round: '', title: '', body: '', pinned: false };

export default function SuperHighlightsScreen() {
  const [items,          setItems]          = useState<any[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [modal,          setModal]          = useState<'create' | 'edit' | null>(null);
  const [target,         setTarget]         = useState<any>(null);
  const [form,           setForm]           = useState<HForm>(EMPTY);
  const [videoUri,       setVideoUri]       = useState<string | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await highlightsApi.list();
      setItems(r.data ?? []);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst highlights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(EMPTY);
    setTarget(null);
    setVideoUri(null);
    setModal('create');
  }

  function openEdit(item: any) {
    setForm({
      round:  item.round?.toString() ?? '',
      title:  item.title,
      body:   item.body,
      pinned: item.pinned,
    });
    setTarget(item);
    setVideoUri(null);
    setModal('edit');
  }

  async function pickVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Oprávnění', 'Potřebuji přístup ke galerii');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 180,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) {
      Alert.alert('Chyba', 'Vyplň nadpis a text');
      return;
    }
    setSaving(true);
    try {
      const data = {
        round:  form.round ? parseInt(form.round) : null,
        title:  form.title.trim(),
        body:   form.body.trim(),
        pinned: form.pinned,
      };

      let savedItem: any;
      if (modal === 'create') {
        const r = await highlightsApi.create(data);
        savedItem = r.data;
        setItems(prev => [savedItem, ...prev]);
      } else if (target) {
        const r = await highlightsApi.update(target.id, data);
        savedItem = r.data;
        setItems(prev => prev.map(h => h.id === target.id ? savedItem : h));
      }

      // Nahrát video pokud bylo vybráno
      if (videoUri && savedItem) {
        setUploadingVideo(true);
        try {
          const vr = await highlightsApi.uploadVideo(savedItem.id, videoUri);
          const updated = vr.data;
          setItems(prev => prev.map(h => h.id === savedItem.id ? updated : h));
        } catch {
          Alert.alert('Varování', 'Highlight uložen, ale video se nepodařilo nahrát.\nMůžeš zkusit znovu přes Upravit.');
        } finally {
          setUploadingVideo(false);
        }
      }

      setModal(null);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se uložit');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(item: any) {
    Alert.alert(
      'Smazat highlight',
      `"${item.title}"\n\nOpravdu smazat?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat', style: 'destructive',
          onPress: async () => {
            try {
              await highlightsApi.delete(item.id);
              setItems(prev => prev.filter(h => h.id !== item.id));
            } catch {
              Alert.alert('Chyba', 'Nepodařilo se smazat');
            }
          },
        },
      ],
    );
  }

  async function togglePin(item: any) {
    try {
      const r = await highlightsApi.update(item.id, { pinned: !item.pinned });
      setItems(prev => prev.map(h => h.id === item.id ? r.data : h));
    } catch {}
  }

  const isBusy = saving || uploadingVideo;
  const busyLabel = uploadingVideo ? 'Nahrávám video…' : (modal === 'create' ? 'Přidat highlight' : 'Uložit změny');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Highlights kola</Text>
        <Pressable style={s.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color={Colors.bg} />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={() => (
            <View style={s.center}>
              <Ionicons name="newspaper-outline" size={44} color={Colors.di} />
              <Text style={s.emptyTxt}>Žádné highlights</Text>
              <Text style={s.emptyHint}>Přidej první highlight kola tlačítkem +</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={[s.card, item.pinned && s.cardPinned]}>
              <View style={s.cardTop}>
                {item.round && <Text style={s.round}>Kolo {item.round}</Text>}
                {item.pinned && (
                  <View style={s.pinnedBadge}>
                    <Ionicons name="pin" size={10} color={Colors.bg} />
                    <Text style={s.pinnedTxt}>Připnuto</Text>
                  </View>
                )}
                {item.videoUrl && (
                  <View style={s.videoBadge}>
                    <Ionicons name="videocam" size={10} color={Colors.wh} />
                    <Text style={s.videoBadgeTxt}>Video</Text>
                  </View>
                )}
              </View>
              <Text style={s.itemTitle}>{item.title}</Text>
              <Text style={s.itemBody} numberOfLines={2}>{item.body}</Text>

              <View style={s.actions}>
                <Pressable style={s.actionBtn} onPress={() => togglePin(item)}>
                  <Ionicons name={item.pinned ? 'pin' : 'pin-outline'} size={13} color={item.pinned ? Colors.go : Colors.mu} />
                  <Text style={[s.actionTxt, item.pinned && { color: Colors.go }]}>
                    {item.pinned ? 'Odpnout' : 'Připnout'}
                  </Text>
                </Pressable>
                <Pressable style={s.actionBtn} onPress={() => openEdit(item)}>
                  <Ionicons name="pencil-outline" size={13} color={Colors.go} />
                  <Text style={[s.actionTxt, { color: Colors.go }]}>Upravit</Text>
                </Pressable>
                <Pressable style={s.actionBtn} onPress={() => confirmDelete(item)}>
                  <Ionicons name="trash-outline" size={13} color={Colors.red} />
                  <Text style={[s.actionTxt, { color: Colors.red }]}>Smazat</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal – opravený layout pro klávesnici */}
      <Modal visible={!!modal} transparent animationType="slide">
        {/* Backdrop – separátní element (absoluteFill) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setModal(null)} />

        {/* KAV pozicuje sheet nad klávesnici */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.kavWrap}
        >
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{modal === 'create' ? 'Nový highlight' : 'Upravit highlight'}</Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Kolo (volitelné)</Text>
              <TextInput
                style={s.input}
                value={form.round}
                onChangeText={v => setForm(p => ({ ...p, round: v }))}
                placeholder="5"
                placeholderTextColor={Colors.di}
                keyboardType="number-pad"
                keyboardAppearance="dark"
              />

              <Text style={s.label}>Nadpis *</Text>
              <TextInput
                style={s.input}
                value={form.title}
                onChangeText={v => setForm(p => ({ ...p, title: v }))}
                placeholder="Hattrick kola"
                placeholderTextColor={Colors.di}
                keyboardAppearance="dark"
              />

              <Text style={s.label}>Text *</Text>
              <TextInput
                style={[s.input, s.textarea]}
                value={form.body}
                onChangeText={v => setForm(p => ({ ...p, body: v }))}
                placeholder="Tomáš Novák (HBR) vstřelil hattrick v derby zápase..."
                placeholderTextColor={Colors.di}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                keyboardAppearance="dark"
              />

              {/* Video sekce */}
              <Text style={s.label}>Video (volitelné)</Text>
              <Pressable style={s.videoPicker} onPress={pickVideo}>
                <Ionicons
                  name={videoUri ? 'checkmark-circle' : (target?.videoUrl ? 'checkmark-circle' : 'videocam-outline')}
                  size={20}
                  color={videoUri || target?.videoUrl ? Colors.green : Colors.mu}
                />
                <Text style={[s.videoPickerTxt, (videoUri || target?.videoUrl) && { color: Colors.green }]}>
                  {videoUri
                    ? 'Nové video vybráno ✓'
                    : target?.videoUrl
                      ? 'Máš nahráno video – vybrat nové'
                      : 'Vybrat video z galerie'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.di} />
              </Pressable>

              <View style={s.switchRow}>
                <View>
                  <Text style={s.switchLabel}>Připnout nahoře</Text>
                  <Text style={s.switchHint}>Zobrazí se jako první na home screen</Text>
                </View>
                <Switch
                  value={form.pinned}
                  onValueChange={v => setForm(p => ({ ...p, pinned: v }))}
                  trackColor={{ false: Colors.bd, true: Colors.go }}
                  thumbColor={Colors.wh}
                />
              </View>

              <Pressable style={[s.saveBtn, isBusy && { opacity: 0.6 }]} onPress={save} disabled={isBusy}>
                {isBusy
                  ? <><ActivityIndicator color={Colors.bg} /><Text style={[s.saveBtnTxt, { marginLeft: 8 }]}>{busyLabel}</Text></>
                  : <Text style={s.saveBtnTxt}>{busyLabel}</Text>
                }
              </Pressable>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:        { width: 40, height: 40, justifyContent: 'center' },
  title:       { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  addBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.go, justifyContent: 'center', alignItems: 'center' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 32 },
  emptyTxt:    { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.mu },
  emptyHint:   { fontSize: Fonts.sizes.sm, color: Colors.di, textAlign: 'center' },

  card:        { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14 },
  cardPinned:  { borderColor: Colors.go, borderWidth: 1.5 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  round:       { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.go, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  pinnedTxt:   { fontSize: 10, fontWeight: '700', color: Colors.bg },
  videoBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#3B82F6', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  videoBadgeTxt: { fontSize: 10, fontWeight: '700', color: Colors.wh },
  itemTitle:   { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, marginBottom: 4 },
  itemBody:    { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 19 },

  actions:     { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: Colors.bd, paddingTop: 10, marginTop: 10 },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: Radius.sm, backgroundColor: Colors.bg },
  actionTxt:   { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },

  // Modal – klávesnice fix
  kavWrap:     { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet:       { backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '92%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.bd, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 16 },

  label:       { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input:       { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh },
  textarea:    { minHeight: 110, paddingTop: 12 },

  videoPicker: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14 },
  videoPickerTxt: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.mu },

  switchRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, marginTop: 14 },
  switchLabel: { fontSize: Fonts.sizes.md, color: Colors.wh, fontWeight: '600' },
  switchHint:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },

  saveBtn:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, marginTop: 20 },
  saveBtnTxt:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
