import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, Modal, TextInput,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

const PRESET_COLORS = [
  '#C9A140', '#7C3AED', '#2563EB', '#DC2626', '#16A34A',
  '#EA580C', '#DB2777', '#0891B2', '#65A30D', '#9333EA',
];

interface TeamForm { name: string; abbr: string; division: string; conference: string; color: string; venue: string; }
const EMPTY_FORM: TeamForm = { name: '', abbr: '', division: 'Divize A', conference: '', color: '#C9A140', venue: '' };

export default function SuperTeamsScreen() {
  const [teams, setTeams]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [modal, setModal]       = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm]         = useState<TeamForm>(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const r = await supervisorApi.teams();
      setTeams(r.data ?? []);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst týmy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // Skupinování týmů podle divize
  const divisions = [...new Set(teams.map(t => t.division))].sort();
  const byDivision = divisions.map(d => ({ division: d, teams: teams.filter(t => t.division === d) }));

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModal('create');
  }

  function openEdit(team: any) {
    setForm({ name: team.name, abbr: team.abbr, division: team.division, conference: team.conference ?? '', color: team.color, venue: team.venue ?? '' });
    setEditTarget(team);
    setModal('edit');
  }

  async function save() {
    if (!form.name.trim() || !form.abbr.trim() || !form.division.trim()) {
      Alert.alert('Chyba', 'Vyplň název, zkratku a divizi');
      return;
    }
    if (form.abbr.length > 3) {
      Alert.alert('Chyba', 'Zkratka max 3 znaky');
      return;
    }
    setSaving(true);
    try {
      if (modal === 'create') {
        const r = await supervisorApi.createTeam(form);
        setTeams(prev => [...prev, r.data].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (editTarget) {
        const r = await supervisorApi.updateTeam(editTarget.id, form);
        setTeams(prev => prev.map(t => t.id === editTarget.id ? r.data : t));
      }
      setModal(null);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se uložit tým');
    } finally {
      setSaving(false);
    }
  }

  async function deleteTeam(team: any) {
    Alert.alert(
      'Smazat tým',
      `Opravdu chceš smazat tým "${team.name}"?\n\nToto lze jen pokud nemá žádné hráče ani zápasy.`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat', style: 'destructive',
          onPress: async () => {
            try {
              await supervisorApi.deleteTeam(team.id);
              setTeams(prev => prev.filter(t => t.id !== team.id));
            } catch (err: any) {
              Alert.alert('Nelze smazat', err?.response?.data?.error ?? 'Chyba');
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Správa týmů</Text>
        <Pressable style={s.addBtn} onPress={openCreate}>
          <Ionicons name="add" size={22} color={Colors.bg} />
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
      ) : teams.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="shield-outline" size={48} color={Colors.di} />
          <Text style={s.emptyText}>Žádné týmy</Text>
          <Pressable style={s.createBtn} onPress={openCreate}>
            <Text style={s.createBtnText}>Přidat první tým</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {byDivision.map(({ division, teams: dt }) => (
            <View key={division} style={{ marginBottom: 24 }}>
              <Text style={s.divLabel}>{division} · {dt.length} {dt.length === 1 ? 'tým' : dt.length < 5 ? 'týmy' : 'týmů'}</Text>
              {dt.map(team => (
                <View key={team.id} style={s.teamRow}>
                  <View style={[s.teamBadge, { backgroundColor: team.color }]}>
                    <Text style={s.teamAbbr}>{team.abbr}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.teamName}>{team.name}</Text>
                    <Text style={s.teamMeta}>
                      {team._count?.players ?? 0} hráčů
                      {team.venue ? ` · ${team.venue}` : ''}
                    </Text>
                  </View>
                  <Pressable style={s.iconBtn} onPress={() => openEdit(team)}>
                    <Ionicons name="pencil-outline" size={18} color={Colors.mu} />
                  </Pressable>
                  <Pressable style={s.iconBtn} onPress={() => deleteTeam(team)}>
                    <Ionicons name="trash-outline" size={18} color={Colors.red} />
                  </Pressable>
                </View>
              ))}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Modal – create / edit */}
      <Modal visible={!!modal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={s.backdrop} onPress={() => setModal(null)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{modal === 'create' ? 'Nový tým' : 'Upravit tým'}</Text>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.fieldLabel}>Název týmu *</Text>
              <TextInput
                style={s.input}
                value={form.name}
                onChangeText={v => setForm(p => ({ ...p, name: v }))}
                placeholder="např. Hawks Brno"
                placeholderTextColor={Colors.di}
                keyboardAppearance="dark"
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Zkratka * (max 3)</Text>
                  <TextInput
                    style={s.input}
                    value={form.abbr}
                    onChangeText={v => setForm(p => ({ ...p, abbr: v.toUpperCase().slice(0, 3) }))}
                    placeholder="HBR"
                    placeholderTextColor={Colors.di}
                    autoCapitalize="characters"
                    maxLength={3}
                    keyboardAppearance="dark"
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={s.fieldLabel}>Divize *</Text>
                  <TextInput
                    style={s.input}
                    value={form.division}
                    onChangeText={v => setForm(p => ({ ...p, division: v }))}
                    placeholder="Divize A"
                    placeholderTextColor={Colors.di}
                    keyboardAppearance="dark"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Konference</Text>
                  <TextInput
                    style={s.input}
                    value={form.conference}
                    onChangeText={v => setForm(p => ({ ...p, conference: v }))}
                    placeholder="Konference A"
                    placeholderTextColor={Colors.di}
                    keyboardAppearance="dark"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.fieldLabel}>Domácí hřiště</Text>
                  <TextInput
                    style={s.input}
                    value={form.venue}
                    onChangeText={v => setForm(p => ({ ...p, venue: v }))}
                    placeholder="Hala XY"
                    placeholderTextColor={Colors.di}
                    keyboardAppearance="dark"
                  />
                </View>
              </View>

              <Text style={s.fieldLabel}>Barva týmu</Text>
              <View style={s.colorRow}>
                {PRESET_COLORS.map(c => (
                  <Pressable
                    key={c}
                    style={[s.colorDot, { backgroundColor: c }, form.color === c && s.colorDotActive]}
                    onPress={() => setForm(p => ({ ...p, color: c }))}
                  >
                    {form.color === c && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </Pressable>
                ))}
              </View>

              {/* Náhled */}
              <View style={s.preview}>
                <View style={[s.previewBadge, { backgroundColor: form.color }]}>
                  <Text style={s.previewAbbr}>{form.abbr || '??'}</Text>
                </View>
                <Text style={s.previewName}>{form.name || 'Název týmu'}</Text>
              </View>

              <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={s.saveBtnText}>{modal === 'create' ? 'Vytvořit tým' : 'Uložit změny'}</Text>
                }
              </Pressable>

              <View style={{ height: 32 }} />
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
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText:   { fontSize: Fonts.sizes.md, color: Colors.mu, marginTop: 8 },
  createBtn:   { backgroundColor: Colors.go, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  createBtnText:{ fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  divLabel:    { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  teamRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 12, marginBottom: 8 },
  teamBadge:   { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  teamAbbr:    { fontSize: Fonts.sizes.sm, fontWeight: '900', color: '#fff' },
  teamName:    { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  teamMeta:    { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  iconBtn:     { padding: 6 },

  // Modal
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.bd, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 20 },
  fieldLabel:  { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input:       { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh },
  colorRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  colorDot:    { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  colorDotActive: { borderWidth: 3, borderColor: Colors.wh },
  preview:     { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 14, marginTop: 16 },
  previewBadge:{ width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  previewAbbr: { fontSize: Fonts.sizes.sm, fontWeight: '900', color: '#fff' },
  previewName: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  saveBtn:     { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
