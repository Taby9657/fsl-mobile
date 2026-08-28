import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
  Alert, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi, matchesApi, refereesApi, statsApi } from '../../services/api';
import { DatePicker } from '../../components/DatePicker';
import { DoneBar, DONE_BAR_ID } from '../../components/DoneBar';
import { Colors, Fonts, Radius } from '../../constants/colors';

type StatusFilter = 'UPCOMING' | 'LIVE' | 'DONE' | 'ALL';
type ModalType = 'add' | 'edit' | 'referee' | null;

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: 'Nadcházející', LIVE: 'LIVE', DONE: 'Odehráno', CANCELLED: 'Zrušeno',
};
const STATUS_COLOR: Record<string, string> = {
  UPCOMING: Colors.mu, LIVE: Colors.red, DONE: Colors.green, CANCELLED: Colors.di,
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}  ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}


const EMPTY_FORM = {
  homeTeamId: '', awayTeamId: '', time: '18:00',
  venue: '', round: '', division: 'Divize A', competition: 'FSL Liga', season: '',
  phase: 'REGULAR' as 'REGULAR' | 'PLAYOFF',
};

export default function SuperMatchesScreen() {
  const [matches, setMatches]       = useState<any[]>([]);
  const [teams, setTeams]           = useState<any[]>([]);
  const [refs, setRefs]             = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState<StatusFilter>('UPCOMING');
  const [phase, setPhase]           = useState<'ALL' | 'REGULAR' | 'PLAYOFF'>('ALL');
  const [seasons, setSeasons]       = useState<string[]>([]);
  const [season, setSeason]         = useState<string | undefined>(undefined);
  const [modal, setModal]           = useState<ModalType>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [form, setForm]             = useState({ ...EMPTY_FORM });
  const [matchDate, setMatchDate]   = useState<Date | null>(null);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    statsApi.seasons().then(r => {
      const ss: string[] = r.data ?? [];
      setSeasons(ss);
      if (ss.length > 0 && season === undefined) setSeason(ss[0]);
    }).catch(() => {});
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== 'ALL') params.status = filter;
      if (phase !== 'ALL')  params.phase  = phase;
      if (season) params.season = season;
      const [mRes, tRes, rRes] = await Promise.all([
        supervisorApi.matches(params),
        supervisorApi.teams(),
        refereesApi.list({ status: 'APPROVED' }),
      ]);
      setMatches(mRes.data ?? []);
      setTeams(tRes.data ?? []);
      setRefs(rRes.data ?? []);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst zápasy');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, season, phase]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setMatchDate(null);
    setEditTarget(null);
    setModal('add');
  }

  function openEdit(match: any) {
    const d = new Date(match.date);
    setMatchDate(d);
    setForm({
      homeTeamId:  match.homeTeamId ?? '',
      awayTeamId:  match.awayTeamId ?? '',
      time:        `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`,
      venue:       match.venue ?? '',
      round:       match.round?.toString() ?? '',
      division:    match.division ?? 'Divize A',
      competition: match.competition ?? 'FSL Liga',
      season:      match.season ?? '',
      phase:       match.phase === 'PLAYOFF' ? 'PLAYOFF' : 'REGULAR',
    });
    setEditTarget(match);
    setModal('edit');
  }

  async function saveMatch() {
    if (!matchDate) { Alert.alert('Chybí datum', 'Vyber datum zápasu'); return; }
    const tm = form.time.match(/^(\d{1,2}):(\d{2})$/);
    if (!tm) { Alert.alert('Chybný čas', 'Formát: HH:MM'); return; }
    const dt = new Date(matchDate);
    dt.setHours(parseInt(tm[1]), parseInt(tm[2]), 0, 0);
    if (isNaN(dt.getTime())) { Alert.alert('Chybný čas', 'Formát: HH:MM'); return; }
    if (!form.homeTeamId || !form.awayTeamId) { Alert.alert('Chybí týmy', 'Vyber domácí i hostující tým'); return; }
    if (form.homeTeamId === form.awayTeamId) { Alert.alert('Chyba', 'Domácí a hosté musí být různé týmy'); return; }

    setSaving(true);
    try {
      const data = {
        homeTeamId:  form.homeTeamId,
        awayTeamId:  form.awayTeamId,
        date:        dt.toISOString(),
        venue:       form.venue || null,
        round:       form.round ? parseInt(form.round) : null,
        division:    form.division,
        competition: form.competition,
        season:      form.season || null,
        phase:       form.phase,
      };
      if (modal === 'add') {
        await matchesApi.create(data);
        setModal(null);
        load(); // reload celý seznam – response neobsahuje vnořené objekty týmů
      } else if (editTarget) {
        await matchesApi.update(editTarget.id, data);
        setModal(null);
        load();
      }
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se uložit');
    } finally {
      setSaving(false);
    }
  }

  async function prepniFazi(match: any) {
    const nova = match.phase === 'PLAYOFF' ? 'REGULAR' : 'PLAYOFF';
    try {
      await matchesApi.update(match.id, { phase: nova });
      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, phase: nova } : m));
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se změnit fázi');
    }
  }

  function confirmDelete(match: any) {
    Alert.alert(
      'Smazat zápas',
      `${match.homeTeam?.abbr ?? '?'} vs ${match.awayTeam?.abbr ?? '?'}\n${fmtDate(match.date)}\n\nOpravdu smazat?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat', style: 'destructive',
          onPress: async () => {
            try {
              await supervisorApi.deleteMatch(match.id);
              setMatches(prev => prev.filter(m => m.id !== match.id));
            } catch (err: any) {
              Alert.alert('Nelze smazat', err?.response?.data?.error ?? 'Chyba');
            }
          },
        },
      ],
    );
  }

  function confirmEnd(match: any) {
    Alert.alert(
      'Ukončit zápas',
      `${match.homeTeam?.abbr ?? '?'} ${match.homeScore}:${match.awayScore} ${match.awayTeam?.abbr ?? '?'}\n\nUkončit zápas a nastavit stav na Odehráno?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Ukončit', style: 'destructive',
          onPress: async () => {
            try {
              await matchesApi.endMatch(match.id);
              setMatches(prev => prev.map(m => m.id === match.id ? { ...m, status: 'DONE' } : m));
            } catch (err: any) {
              Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se ukončit zápas');
            }
          },
        },
      ],
    );
  }

  async function assignReferee(refereeId: string) {
    if (!assignTarget) return;
    setSaving(true);
    try {
      const r = await supervisorApi.assignReferee(assignTarget.id, refereeId);
      setMatches(prev => prev.map(m => m.id === assignTarget.id ? { ...m, referee: r.data.referee } : m));
      setAssignTarget(null);
      setModal(null);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se přiřadit');
    } finally {
      setSaving(false);
    }
  }

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'UPCOMING', label: 'Nadcházející' },
    { key: 'LIVE',     label: 'LIVE' },
    { key: 'DONE',     label: 'Odehrané' },
    { key: 'ALL',      label: 'Vše' },
  ];

  return (
    <SafeAreaView style={s.safe}>
      <DoneBar />
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Správa zápasů</Text>
        <Pressable style={s.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color={Colors.bg} />
        </Pressable>
      </View>

      {/* Status filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[s.chip, filter === f.key && s.chipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Fáze */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {([['ALL', 'Vše'], ['REGULAR', 'Základní část'], ['PLAYOFF', 'Playoff']] as const).map(([k, label]) => (
          <Pressable key={k} style={[s.chip, phase === k && s.chipActive]} onPress={() => setPhase(k)}>
            <Text style={[s.chipText, phase === k && s.chipTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Season filter */}
      {seasons.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 4 }}>
          {seasons.map(s2 => (
            <Pressable
              key={s2}
              style={[s.chip, season === s2 && s.chipActive]}
              onPress={() => setSeason(s2)}
            >
              <Text style={[s.chipText, season === s2 && s.chipTextActive]}>{s2}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.go} />}
          ListEmptyComponent={() => (
            <View style={s.center}>
              <Ionicons name="football-outline" size={44} color={Colors.di} />
              <Text style={s.emptyText}>Žádné zápasy</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={s.card}>
              {/* Status + kolo */}
              <View style={s.cardTop}>
                <Text style={[s.statusBadge, { color: STATUS_COLOR[item.status] ?? Colors.mu }]}>
                  {STATUS_LABEL[item.status] ?? item.status}
                </Text>
                {item.round ? <Text style={s.roundBadge}>Kolo {item.round}</Text> : null}
                <Pressable onPress={() => prepniFazi(item)} hitSlop={6}>
                  <Text style={[s.phaseBadge, item.phase === 'PLAYOFF' && s.phaseBadgePo]}>
                    {item.phase === 'PLAYOFF' ? 'PLAYOFF' : 'základní'}
                  </Text>
                </Pressable>
                <Text style={s.divisionBadge}>{item.division}</Text>
              </View>

              {/* Týmy + skóre */}
              <View style={s.teamsRow}>
                <View style={[s.dot, { backgroundColor: item.homeTeam?.color ?? Colors.go }]} />
                <Text style={s.abbr}>{item.homeTeam?.abbr ?? '?'}</Text>
                {item.status !== 'UPCOMING'
                  ? <Text style={s.score}>{item.homeScore}:{item.awayScore}</Text>
                  : <Text style={s.vs}>vs</Text>}
                <Text style={s.abbr}>{item.awayTeam?.abbr ?? '?'}</Text>
                <View style={[s.dot, { backgroundColor: item.awayTeam?.color ?? Colors.pu }]} />
              </View>

              {/* Meta */}
              <Text style={s.meta}>{fmtDate(item.date)}{item.venue ? ` · ${item.venue}` : ''}</Text>

              {/* Rozhodčí */}
              {item.referee ? (
                <View style={s.refRow}>
                  <Ionicons name="person-circle-outline" size={14} color={Colors.green} />
                  <Text style={s.refName}>{item.referee.firstName} {item.referee.lastName}</Text>
                  <Pressable onPress={() => { setAssignTarget(item); setModal('referee'); }} style={s.changeBtn}>
                    <Text style={s.changeTxt}>Změnit</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={s.assignBtn} onPress={() => { setAssignTarget(item); setModal('referee'); }}>
                  <Ionicons name="person-add-outline" size={14} color={Colors.pu} />
                  <Text style={s.assignTxt}>Přiřadit rozhodčího</Text>
                </Pressable>
              )}

              {/* Akce */}
              <View style={s.actions}>
                <Pressable style={s.actionBtn} onPress={() => router.push(`/match/${item.id}` as any)}>
                  <Ionicons name="eye-outline" size={13} color={Colors.mu} />
                  <Text style={s.actionTxt}>Detail</Text>
                </Pressable>
                <Pressable style={s.actionBtn} onPress={() => openEdit(item)}>
                  <Ionicons name="pencil-outline" size={13} color={Colors.go} />
                  <Text style={[s.actionTxt, { color: Colors.go }]}>Upravit</Text>
                </Pressable>
                {item.status === 'LIVE' && (
                  <Pressable style={s.actionBtn} onPress={() => confirmEnd(item)}>
                    <Ionicons name="stop-circle-outline" size={13} color={Colors.red} />
                    <Text style={[s.actionTxt, { color: Colors.red }]}>Ukončit</Text>
                  </Pressable>
                )}
                {item.status === 'UPCOMING' && (
                  <Pressable style={s.actionBtn} onPress={() => confirmDelete(item)}>
                    <Ionicons name="trash-outline" size={13} color={Colors.red} />
                    <Text style={[s.actionTxt, { color: Colors.red }]}>Smazat</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}

      {/* ── Modal: přidat / upravit zápas ── */}
      <Modal visible={modal === 'add' || modal === 'edit'} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={s.backdrop} onPress={() => setModal(null)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{modal === 'add' ? 'Nový zápas' : 'Upravit zápas'}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              <Text style={s.label}>Domácí tým *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {teams.map(t => (
                    <Pressable
                      key={t.id}
                      style={[s.teamChip, form.homeTeamId === t.id && { borderColor: t.color ?? Colors.go, backgroundColor: `${(t.color ?? Colors.go)}22` }]}
                      onPress={() => setForm(p => ({ ...p, homeTeamId: t.id }))}
                    >
                      <View style={[s.chipDot, { backgroundColor: t.color ?? Colors.go }]} />
                      <Text style={[s.chipLbl, form.homeTeamId === t.id && { color: Colors.wh }]}>{t.abbr}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <Text style={s.label}>Hostující tým *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {teams.map(t => (
                    <Pressable
                      key={t.id}
                      style={[s.teamChip, form.awayTeamId === t.id && { borderColor: t.color ?? Colors.pu, backgroundColor: `${(t.color ?? Colors.pu)}22` }]}
                      onPress={() => setForm(p => ({ ...p, awayTeamId: t.id }))}
                    >
                      <View style={[s.chipDot, { backgroundColor: t.color ?? Colors.pu }]} />
                      <Text style={[s.chipLbl, form.awayTeamId === t.id && { color: Colors.wh }]}>{t.abbr}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              <Text style={s.label}>Datum *</Text>
              <DatePicker value={matchDate} onChange={setMatchDate} placeholder="Vybrat datum" />

              <Text style={s.label}>Čas</Text>
              <TextInput style={s.input} value={form.time} onChangeText={v => setForm(p => ({ ...p, time: v }))} placeholder="18:00" placeholderTextColor={Colors.di} keyboardType="numbers-and-punctuation" keyboardAppearance="dark" />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 2 }}>
                  <Text style={s.label}>Hřiště</Text>
                  <TextInput style={s.input} value={form.venue} onChangeText={v => setForm(p => ({ ...p, venue: v }))} placeholder="Sportovní hala" placeholderTextColor={Colors.di} keyboardAppearance="dark" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Kolo</Text>
                  <TextInput style={s.input} value={form.round} onChangeText={v => setForm(p => ({ ...p, round: v }))} placeholder="1" placeholderTextColor={Colors.di} keyboardType="number-pad" keyboardAppearance="dark" inputAccessoryViewID={DONE_BAR_ID} returnKeyType="done" />
                  <Text style={s.label}>Fáze</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {([['REGULAR', 'Základní'], ['PLAYOFF', 'Playoff']] as const).map(([k, label]) => (
                      <Pressable
                        key={k}
                        style={[s.chip, form.phase === k && s.chipActive, { flex: 1, alignItems: 'center' }]}
                        onPress={() => setForm(p => ({ ...p, phase: k }))}
                      >
                        <Text style={[s.chipText, form.phase === k && s.chipTextActive]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 2 }}>
                  <Text style={s.label}>Divize</Text>
                  <TextInput style={s.input} value={form.division} onChangeText={v => setForm(p => ({ ...p, division: v }))} placeholder="Divize A" placeholderTextColor={Colors.di} keyboardAppearance="dark" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Sezóna</Text>
                  <TextInput style={s.input} value={form.season} onChangeText={v => setForm(p => ({ ...p, season: v }))} placeholder="2025/26" placeholderTextColor={Colors.di} keyboardAppearance="dark" />
                </View>
              </View>

              <Pressable style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={saveMatch} disabled={saving}>
                {saving
                  ? <ActivityIndicator color={Colors.bg} />
                  : <Text style={s.saveBtnTxt}>{modal === 'add' ? 'Vytvořit zápas' : 'Uložit změny'}</Text>}
              </Pressable>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal: přiřadit rozhodčího ── */}
      <Modal visible={modal === 'referee'} transparent animationType="slide">
        <Pressable style={s.backdrop} onPress={() => { setModal(null); setAssignTarget(null); }} />
        <View style={[s.sheet, { maxHeight: '60%' }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Přiřadit rozhodčího</Text>
          {assignTarget && (
            <Text style={s.sheetSub}>{assignTarget.homeTeam?.abbr} vs {assignTarget.awayTeam?.abbr} · {fmtDate(assignTarget.date)}</Text>
          )}
          <ScrollView>
            {refs.length === 0
              ? <Text style={{ color: Colors.mu, padding: 16 }}>Žádní schválení rozhodčí</Text>
              : refs.map(r => (
                  <Pressable key={r.id} style={s.refOption} onPress={() => assignReferee(r.id)} disabled={saving}>
                    <View style={s.refAv}><Ionicons name="person" size={16} color={Colors.pu} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.refOptName}>{r.firstName} {r.lastName}</Text>
                      <Text style={s.refLvl}>{r.level}</Text>
                    </View>
                    {saving && <ActivityIndicator size="small" color={Colors.go} />}
                  </Pressable>
                ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  phaseBadge:   { fontSize: 10, fontWeight: '800', color: Colors.mu, backgroundColor: Colors.c2, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, overflow: 'hidden' },
  phaseBadgePo: { color: Colors.bg, backgroundColor: Colors.go },
  safe:         { flex: 1, backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:         { width: 40, height: 40, justifyContent: 'center' },
  title:        { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  addBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.go, justifyContent: 'center', alignItems: 'center' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 32 },
  emptyText:    { fontSize: Fonts.sizes.md, color: Colors.mu },

  filterBar:    { flexGrow: 0, marginBottom: 4 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  chipActive:   { backgroundColor: Colors.go, borderColor: Colors.go },
  chipText:     { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  chipTextActive: { color: Colors.bg },

  card:         { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14 },
  cardTop:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  statusBadge:  { fontSize: Fonts.sizes.xs, fontWeight: '700', textTransform: 'uppercase' },
  roundBadge:   { fontSize: Fonts.sizes.xs, color: Colors.mu, backgroundColor: Colors.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  divisionBadge:{ fontSize: Fonts.sizes.xs, color: Colors.di, marginLeft: 'auto' as any },
  teamsRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  dot:          { width: 10, height: 10, borderRadius: 5 },
  abbr:         { fontSize: Fonts.sizes.lg, fontWeight: '800', color: Colors.wh, flex: 1 },
  score:        { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.go, paddingHorizontal: 8 },
  vs:           { fontSize: Fonts.sizes.sm, color: Colors.mu, paddingHorizontal: 8 },
  meta:         { fontSize: Fonts.sizes.xs, color: Colors.mu, marginBottom: 8 },

  refRow:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${Colors.green}11`, borderRadius: Radius.sm, padding: 8, marginBottom: 8 },
  refName:      { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.wh },
  changeBtn:    { backgroundColor: Colors.c2, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  changeTxt:    { fontSize: Fonts.sizes.xs, color: Colors.go, fontWeight: '600' },
  assignBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.pu, borderRadius: Radius.sm, padding: 8, borderStyle: 'dashed', marginBottom: 8 },
  assignTxt:    { fontSize: Fonts.sizes.xs, color: Colors.pu, fontWeight: '600' },

  actions:      { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: Colors.bd, paddingTop: 10 },
  actionBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: Radius.sm, backgroundColor: Colors.bg },
  actionTxt:    { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },

  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  sheetHandle:  { width: 40, height: 4, backgroundColor: Colors.bd, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 4 },
  sheetSub:     { fontSize: Fonts.sizes.sm, color: Colors.mu, marginBottom: 16 },

  label:        { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input:        { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh },
  teamChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.bg },
  chipDot:      { width: 8, height: 8, borderRadius: 4 },
  chipLbl:      { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  saveBtn:      { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginTop: 20 },
  saveBtnTxt:   { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },

  refOption:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  refAv:        { width: 32, height: 32, borderRadius: 16, backgroundColor: `${Colors.pu}22`, justifyContent: 'center', alignItems: 'center' },
  refOptName:   { fontSize: Fonts.sizes.md, color: Colors.wh, fontWeight: '500' },
  refLvl:       { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '600' },
});
