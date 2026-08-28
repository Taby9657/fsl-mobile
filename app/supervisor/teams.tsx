import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, Modal, TextInput,
  ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi } from '../../services/api';
import { TeamColorPicker } from '../../components/TeamColorPicker';
import { Colors, Fonts, Radius } from '../../constants/colors';


type RegStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPEALING';
type PayFilter = 'ALL' | 'PENDING' | 'PAID' | 'OVERDUE';

interface TeamForm { name: string; abbr: string; division: string; conference: string; color: string; colorSecondary: string | null; }
const EMPTY_FORM: TeamForm = { name: '', abbr: '', division: '', conference: '', color: '#C9A140', colorSecondary: '#F5F5F5' };

const REG_TABS: { id: RegStatus; label: string }[] = [
  { id: 'ALL',       label: 'Vše'       },
  { id: 'PENDING',   label: 'Čekající'  },
  { id: 'APPEALING', label: 'Odvolání'  },
  { id: 'APPROVED',  label: 'Schválené' },
  { id: 'REJECTED',  label: 'Zamítnuté' },
];

const PAY_CHIPS: { id: PayFilter; label: string }[] = [
  { id: 'ALL',     label: 'Platby: vše'      },
  { id: 'PENDING', label: 'Nezaplaceno'       },
  { id: 'PAID',    label: 'Zaplaceno'         },
  { id: 'OVERDUE', label: 'Po splatnosti'     },
];

function regColor(s: string) {
  if (s === 'APPROVED')  return Colors.go;
  if (s === 'REJECTED')  return Colors.red;
  if (s === 'APPEALING') return '#F59E0B';
  return Colors.mu; // PENDING
}
function regLabel(s: string) {
  if (s === 'APPROVED')  return 'Schváleno';
  if (s === 'REJECTED')  return 'Zamítnuto';
  if (s === 'APPEALING') return 'Odvolání';
  return 'Čeká';
}
function payLabel(s?: string) {
  if (s === 'PAID')    return 'Zaplaceno';
  if (s === 'OVERDUE') return 'Po splatnosti';
  return 'Nezaplaceno';
}
function payColor(s?: string) {
  if (s === 'PAID')    return Colors.go;
  if (s === 'OVERDUE') return Colors.red;
  return Colors.mu;
}

export default function SuperTeamsScreen() {
  const [teams, setTeams]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [modal, setModal]           = useState<'create' | 'edit' | 'review' | null>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [form, setForm]             = useState<TeamForm>(EMPTY_FORM);
  const [regTab, setRegTab]         = useState<RegStatus>('ALL');
  const [payFilter, setPayFilter]   = useState<PayFilter>('ALL');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (regTab    !== 'ALL') params.regStatus = regTab;
      if (payFilter !== 'ALL') params.payStatus  = payFilter;
      const r = await supervisorApi.teams(params);
      setTeams(r.data ?? []);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst týmy');
    } finally {
      setLoading(false);
    }
  }, [regTab, payFilter]);

  useEffect(() => { load(); }, [load]);

  // Skupinování podle regStatus (prioritní pořadí)
  const groups: { label: string; teams: any[] }[] = [];
  const pending   = teams.filter(t => t.regStatus === 'PENDING');
  const appealing = teams.filter(t => t.regStatus === 'APPEALING');
  const rejected  = teams.filter(t => t.regStatus === 'REJECTED');
  const approved  = teams.filter(t => t.regStatus === 'APPROVED');

  if (pending.length)   groups.push({ label: `⏳ Čeká na schválení (${pending.length})`,   teams: pending });
  if (appealing.length) groups.push({ label: `⚠️ Odvolání (${appealing.length})`,           teams: appealing });
  if (rejected.length)  groups.push({ label: `❌ Zamítnuto (${rejected.length})`,            teams: rejected });
  if (approved.length)  groups.push({ label: `✅ Schváleno (${approved.length})`,            teams: approved });

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModal('create');
  }

  function openEdit(team: any) {
    setForm({ name: team.name, abbr: team.abbr, division: team.division ?? '', conference: team.conference ?? '', color: team.color, colorSecondary: team.colorSecondary ?? null });
    setEditTarget(team);
    setModal('edit');
  }

  function openReview(team: any) {
    setEditTarget(team);
    setReviewNote('');
    setModal('review');
  }

  async function save() {
    if (!form.name.trim() || !form.abbr.trim()) {
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
        setTeams(prev => [...prev, r.data]);
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

  async function approveTeam() {
    if (!editTarget) return;
    setReviewBusy(true);
    try {
      const r = await supervisorApi.approveTeam(editTarget.id, reviewNote.trim() || undefined);
      setTeams(prev => prev.map(t => t.id === editTarget.id ? { ...t, ...r.data } : t));
      setModal(null);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se schválit');
    } finally {
      setReviewBusy(false);
    }
  }

  async function rejectTeam() {
    if (!editTarget) return;
    if (!reviewNote.trim()) {
      Alert.alert('Chyba', 'Důvod zamítnutí je povinný');
      return;
    }
    setReviewBusy(true);
    try {
      const r = await supervisorApi.rejectTeam(editTarget.id, reviewNote.trim());
      setTeams(prev => prev.map(t => t.id === editTarget.id ? { ...t, ...r.data } : t));
      setModal(null);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se zamítnout');
    } finally {
      setReviewBusy(false);
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

  function renderTeam(team: any) {
    const rs = team.regStatus ?? 'APPROVED';
    const ps = team.payments?.status;
    return (
      <View key={team.id} style={s.teamRow}>
        <View style={[s.teamBadge, { backgroundColor: team.color }]}>
          <Text style={s.teamAbbr}>{team.abbr}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={s.teamName}>{team.name}</Text>
            <View style={[s.statusPill, { backgroundColor: `${regColor(rs)}22` }]}>
              <Text style={[s.statusPillTxt, { color: regColor(rs) }]}>{regLabel(rs)}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 2, alignItems: 'center' }}>
            <Text style={s.teamMeta}>
              {team._count?.players ?? 0} hráčů · {team.division ?? 'Nezařazeno'}
            </Text>
            <Text style={[s.payBadge, { color: payColor(ps) }]}>
              {payLabel(ps)}
            </Text>
          </View>
          {/* Odvolání vedoucího */}
          {rs === 'APPEALING' && team.regAppeal ? (
            <Text style={s.appealText} numberOfLines={2}>
              💬 {team.regAppeal}
            </Text>
          ) : null}
          {/* Důvod zamítnutí */}
          {rs === 'REJECTED' && team.regNote ? (
            <Text style={s.noteText} numberOfLines={2}>
              ℹ️ {team.regNote}
            </Text>
          ) : null}
        </View>
        {/* Přezkoumat – pro PENDING / APPEALING */}
        {(rs === 'PENDING' || rs === 'APPEALING') && (
          <Pressable style={[s.iconBtn, { backgroundColor: `${Colors.pu}22` }]} onPress={() => openReview(team)}>
            <Ionicons name="checkmark-circle-outline" size={20} color={Colors.pu} />
          </Pressable>
        )}
        <Pressable style={s.iconBtn} onPress={() => openEdit(team)}>
          <Ionicons name="pencil-outline" size={18} color={Colors.mu} />
        </Pressable>
        <Pressable style={s.iconBtn} onPress={() => deleteTeam(team)}>
          <Ionicons name="trash-outline" size={18} color={Colors.red} />
        </Pressable>
      </View>
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

      {/* Záložky registrace */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, marginBottom: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}
      >
        {REG_TABS.map(tab => {
          const active = regTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setRegTab(tab.id)}
            >
              <Text style={[s.chipTxt, active && s.chipTxtActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Platební filtr */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 6 }}
      >
        {PAY_CHIPS.map(chip => {
          const active = payFilter === chip.id;
          return (
            <Pressable
              key={chip.id}
              style={[s.chip, s.chipSmall, active && { backgroundColor: Colors.go, borderColor: Colors.go }]}
              onPress={() => setPayFilter(chip.id)}
            >
              <Text style={[s.chipTxt, active && s.chipTxtActive, { fontSize: 11 }]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
          {groups.map(group => (
            <View key={group.label} style={{ marginBottom: 24 }}>
              <Text style={s.divLabel}>{group.label}</Text>
              {group.teams.map(renderTeam)}
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Modal – create / edit */}
      <Modal visible={modal === 'create' || modal === 'edit'} transparent animationType="slide">
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
              </View>

              <View style={s.note}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.mu} />
                <Text style={s.noteTxt}>
                  Divizi a konferenci přiděluješ až v Rozlosování, kde vidíš všechny týmy pohromadě.
                  Halu zadáváš u konkrétního zápasu.
                </Text>
              </View>

              <TeamColorPicker
                primary={form.color}
                onPrimary={c => setForm(p => ({ ...p, color: c }))}
                secondary={form.colorSecondary}
                onSecondary={c => setForm(p => ({ ...p, colorSecondary: c }))}
                abbr={form.abbr}
              />

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

      {/* Modal – review registrace */}
      <Modal visible={modal === 'review'} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={s.backdrop} onPress={() => setModal(null)} />
          <View style={[s.sheet, { maxHeight: '70%' }]}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Přezkoumat registraci</Text>

            {editTarget && (
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <View style={[s.teamBadge, { backgroundColor: editTarget.color, width: 40, height: 40 }]}>
                    <Text style={s.teamAbbr}>{editTarget.abbr}</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh }}>{editTarget.name}</Text>
                    <Text style={{ fontSize: Fonts.sizes.xs, color: Colors.mu }}>{editTarget.division ?? 'Nezařazeno'}</Text>
                  </View>
                </View>

                {/* Odvolání vedoucího – zobrazit pokud existuje */}
                {editTarget.regStatus === 'APPEALING' && editTarget.regAppeal ? (
                  <View style={[s.appealBox]}>
                    <Text style={s.appealBoxLabel}>Odvolání vedoucího:</Text>
                    <Text style={s.appealBoxText}>{editTarget.regAppeal}</Text>
                    {editTarget.regAppealAt && (
                      <Text style={s.appealBoxDate}>
                        {new Date(editTarget.regAppealAt).toLocaleDateString('cs-CZ')}
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>
            )}

            <Text style={s.fieldLabel}>
              Poznámka ke schválení / důvod zamítnutí {editTarget?.regStatus === 'APPEALING' ? '' : '(povinné pro zamítnutí)'}
            </Text>
            <TextInput
              style={[s.input, { height: 80, textAlignVertical: 'top' }]}
              value={reviewNote}
              onChangeText={setReviewNote}
              placeholder="Zadej poznámku nebo důvod..."
              placeholderTextColor={Colors.di}
              keyboardAppearance="dark"
              multiline
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable
                style={[s.rejectBtn, reviewBusy && { opacity: 0.5 }]}
                onPress={rejectTeam}
                disabled={reviewBusy}
              >
                {reviewBusy
                  ? <ActivityIndicator color={Colors.red} size="small" />
                  : <Text style={[s.saveBtnText, { color: Colors.red }]}>Zamítnout</Text>
                }
              </Pressable>
              <Pressable
                style={[s.approveBtn, reviewBusy && { opacity: 0.5 }]}
                onPress={approveTeam}
                disabled={reviewBusy}
              >
                {reviewBusy
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <Text style={s.saveBtnText}>Schválit</Text>
                }
              </Pressable>
            </View>

            <View style={{ height: 16 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex: 1, backgroundColor: Colors.bg },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:           { width: 40, height: 40, justifyContent: 'center' },
  title:          { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  addBtn:         { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.go, justifyContent: 'center', alignItems: 'center' },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText:      { fontSize: Fonts.sizes.md, color: Colors.mu, marginTop: 8 },
  createBtn:      { backgroundColor: Colors.go, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  createBtnText:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  divLabel:       { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  teamRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 12, marginBottom: 8 },
  teamBadge:      { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  teamAbbr:       { fontSize: Fonts.sizes.sm, fontWeight: '900', color: '#fff' },
  teamName:       { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  teamMeta:       { fontSize: Fonts.sizes.xs, color: Colors.mu },
  payBadge:       { fontSize: 10, fontWeight: '700' },
  statusPill:     { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  statusPillTxt:  { fontSize: 10, fontWeight: '700' },
  appealText:     { fontSize: 11, color: '#F59E0B', marginTop: 4, fontStyle: 'italic' },
  noteText:       { fontSize: 11, color: Colors.mu, marginTop: 4, fontStyle: 'italic' },
  iconBtn:        { padding: 7, borderRadius: Radius.sm },

  chip:           { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  chipSmall:      { paddingHorizontal: 10, paddingVertical: 5 },
  chipActive:     { backgroundColor: Colors.pu, borderColor: Colors.pu },
  chipTxt:        { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.mu },
  chipTxtActive:  { color: Colors.bg },

  // Modal
  backdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  sheetHandle:    { width: 40, height: 4, backgroundColor: Colors.bd, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:     { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 16 },
  fieldLabel:     { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input:          { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh },
  note:           { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4, marginBottom: 4 },
  noteTxt:        { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 17 },
  preview:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.bg, borderRadius: Radius.md, padding: 14, marginTop: 16 },
  previewBadge:   { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  previewAbbr:    { fontSize: Fonts.sizes.sm, fontWeight: '900', color: '#fff' },
  previewName:    { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  saveBtn:        { flex: 1, backgroundColor: Colors.go, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText:    { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  rejectBtn:      { flex: 1, borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.md, padding: 14, alignItems: 'center' },
  approveBtn:     { flex: 1, backgroundColor: Colors.go, borderRadius: Radius.md, padding: 14, alignItems: 'center' },

  appealBox:      { backgroundColor: `${'#F59E0B'}22`, borderRadius: Radius.sm, borderWidth: 1, borderColor: '#F59E0B44', padding: 12, marginBottom: 8 },
  appealBoxLabel: { fontSize: Fonts.sizes.xs, color: '#F59E0B', fontWeight: '700', marginBottom: 4 },
  appealBoxText:  { fontSize: Fonts.sizes.sm, color: Colors.wh, lineHeight: 18 },
  appealBoxDate:  { fontSize: 10, color: Colors.mu, marginTop: 4 },
});
