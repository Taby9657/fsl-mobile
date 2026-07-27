import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Alert, Modal, FlatList, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { matchesApi } from '../../../services/api';
import { Colors, Fonts, Radius } from '../../../constants/colors';
import * as Haptics from 'expo-haptics';

type EventType = 'GOAL' | 'PENALTY';
type ModalType = 'goal' | 'penalty' | null;

const PENALTY_TYPES = ['2 min', '5 min', '10 min', 'DT'];

export default function LiveScoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading]     = useState(true);
  const [match, setMatch]         = useState<any>(null);
  const [modal, setModal]         = useState<ModalType>(null);

  // formulář gól
  const [goalTeam,    setGoalTeam]    = useState<'home' | 'away'>('home');
  const [goalMinute,  setGoalMinute]  = useState('');
  const [goalPeriod,  setGoalPeriod]  = useState('1');
  const [goalScorer,  setGoalScorer]  = useState('');
  const [goalAssist,  setGoalAssist]  = useState('');

  // formulář trest
  const [penTeam,     setPenTeam]     = useState<'home' | 'away'>('home');
  const [penMinute,   setPenMinute]   = useState('');
  const [penPlayer,   setPenPlayer]   = useState('');
  const [penType,     setPenType]     = useState('2 min');

  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    matchesApi.get(id)
      .then(r => setMatch(r.data))
      .catch(() => Alert.alert('Chyba', 'Nepodařilo se načíst zápas'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // poll každých 15s (live refresh)
  useEffect(() => {
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  async function handleStart() {
    Alert.alert('Zahájit zápas?', 'Tím se zápas přepne na LIVE stav.', [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Zahájit',
        onPress: async () => {
          setSaving(true);
          try {
            await matchesApi.startMatch(id!);
            load();
          } catch (e: any) {
            Alert.alert('Chyba', e?.response?.data?.error ?? 'Nepodařilo se zahájit');
          } finally { setSaving(false); }
        },
      },
    ]);
  }

  async function handleEnd() {
    Alert.alert('Ukončit zápas?', `Skóre: ${match.homeScore ?? 0}:${match.awayScore ?? 0}\nToto nelze vrátit zpět.`, [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Ukončit',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await matchesApi.endMatch(id!);
            load();
            Alert.alert('Zápas ukončen', 'Vedoucí týmů byli upozorněni k vyplnění postmatch formuláře.');
          } catch (e: any) {
            Alert.alert('Chyba', e?.response?.data?.error ?? 'Nepodařilo se ukončit');
          } finally { setSaving(false); }
        },
      },
    ]);
  }

  async function submitGoal() {
    if (!goalMinute || !goalScorer) {
      Alert.alert('Chybí údaje', 'Zadej minutu a střelce');
      return;
    }
    const teamId = goalTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    setSaving(true);
    try {
      await matchesApi.addEvent(id!, {
        type:    'GOAL',
        minute:  parseInt(goalMinute),
        period:  parseInt(goalPeriod),
        teamId,
        scorerId:  goalScorer  || undefined,
        assistId:  goalAssist  || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModal(null);
      resetGoalForm();
      load();
    } catch (e: any) {
      Alert.alert('Chyba', e?.response?.data?.error ?? 'Nepodařilo se přidat gól');
    } finally { setSaving(false); }
  }

  async function submitPenalty() {
    if (!penMinute || !penPlayer) {
      Alert.alert('Chybí údaje', 'Zadej minutu a hráče');
      return;
    }
    const teamId = penTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    setSaving(true);
    try {
      await matchesApi.addEvent(id!, {
        type:        'PENALTY',
        minute:      parseInt(penMinute),
        period:      1,
        teamId,
        penaltyId:   penPlayer   || undefined,
        penaltyType: penType,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setModal(null);
      resetPenForm();
      load();
    } catch (e: any) {
      Alert.alert('Chyba', e?.response?.data?.error ?? 'Nepodařilo se přidat trest');
    } finally { setSaving(false); }
  }

  async function deleteEvent(eventId: string) {
    Alert.alert('Smazat událost?', '', [
      { text: 'Zrušit', style: 'cancel' },
      {
        text: 'Smazat', style: 'destructive',
        onPress: async () => {
          try {
            await matchesApi.deleteEvent(id!, eventId);
            load();
          } catch (e: any) {
            Alert.alert('Chyba', e?.response?.data?.error ?? 'Nepodařilo se smazat');
          }
        },
      },
    ]);
  }

  function resetGoalForm() {
    setGoalTeam('home'); setGoalMinute(''); setGoalPeriod('1');
    setGoalScorer(''); setGoalAssist('');
  }
  function resetPenForm() {
    setPenTeam('home'); setPenMinute(''); setPenPlayer(''); setPenType('2 min');
  }

  const homeLineupPlayers: any[] = match?.lineups?.find((l: any) => l.teamId === match?.homeTeamId)?.players ?? [];
  const awayLineupPlayers: any[] = match?.lineups?.find((l: any) => l.teamId === match?.awayTeamId)?.players ?? [];
  const scorerPlayers = (goalTeam === 'home' ? homeLineupPlayers : awayLineupPlayers).map((lp: any) => lp.player).filter(Boolean);
  const penPlayers    = (penTeam  === 'home' ? homeLineupPlayers : awayLineupPlayers).map((lp: any) => lp.player).filter(Boolean);

  const goals    = (match?.events ?? []).filter((e: any) => e.type === 'GOAL');
  const penalties= (match?.events ?? []).filter((e: any) => e.type === 'PENALTY');
  const isLive   = match?.status === 'LIVE';
  const isPlayed = match?.status === 'DONE';

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={24} color={Colors.wh} /></Pressable></View>
      <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Live scoring</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Scoreboard */}
        <View style={s.scoreboard}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={[s.teamBadge, { backgroundColor: match?.homeTeam?.color ?? Colors.go }]}>
              <Text style={s.teamAbbr}>{match?.homeTeam?.abbr}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{match?.homeTeam?.name}</Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.score}>{match?.homeScore ?? 0}:{match?.awayScore ?? 0}</Text>
            <View style={[s.statusPill, { backgroundColor: isLive ? `${Colors.red}33` : `${Colors.mu}22` }]}>
              <Text style={[s.statusTxt, { color: isLive ? Colors.red : Colors.mu }]}>
                {isLive ? '● LIVE' : isPlayed ? 'Ukončen' : 'Před zápasem'}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <View style={[s.teamBadge, { backgroundColor: match?.awayTeam?.color ?? Colors.pu }]}>
              <Text style={s.teamAbbr}>{match?.awayTeam?.abbr}</Text>
            </View>
            <Text style={s.teamName} numberOfLines={1}>{match?.awayTeam?.name}</Text>
          </View>
        </View>

        {/* Akce */}
        {!isPlayed && (
          <View style={s.actionRow}>
            {!isLive ? (
              <Pressable style={s.startBtn} onPress={handleStart} disabled={saving}>
                {saving ? <ActivityIndicator color={Colors.bg} /> : (
                  <>
                    <Ionicons name="play" size={16} color={Colors.bg} />
                    <Text style={s.startBtnTxt}>Zahájit zápas</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <>
                <Pressable style={s.goalBtn} onPress={() => setModal('goal')}>
                  <Ionicons name="football" size={16} color={Colors.bg} />
                  <Text style={s.goalBtnTxt}>Gól</Text>
                </Pressable>
                <Pressable style={s.penBtn} onPress={() => setModal('penalty')}>
                  <Ionicons name="warning" size={16} color={Colors.wh} />
                  <Text style={s.penBtnTxt}>Trest</Text>
                </Pressable>
                <Pressable style={s.endBtn} onPress={handleEnd} disabled={saving}>
                  <Ionicons name="stop" size={16} color={Colors.wh} />
                  <Text style={s.endBtnTxt}>Ukončit</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* Góly */}
        {goals.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Góly</Text>
            {goals.map((g: any) => {
              const isHome = g.teamId === match.homeTeamId;
              return (
                <View key={g.id} style={[s.eventRow, !isHome && s.eventRowAway]}>
                  <Text style={s.eventMin}>{g.minute}'</Text>
                  <View style={s.eventIcon}><Ionicons name="football" size={12} color={Colors.go} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.eventName, !isHome && { textAlign: 'right' }]}>
                      {g.scorer?.firstName} {g.scorer?.lastName}
                    </Text>
                    {g.assist && (
                      <Text style={[s.eventSub, !isHome && { textAlign: 'right' }]}>
                        Asist: {g.assist.firstName} {g.assist.lastName}
                      </Text>
                    )}
                  </View>
                  {!isPlayed && (
                    <Pressable onPress={() => deleteEvent(g.id)} style={s.delBtn}>
                      <Ionicons name="close" size={14} color={Colors.red} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Tresty */}
        {penalties.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Tresty</Text>
            {penalties.map((p: any) => {
              const isHome = p.teamId === match.homeTeamId;
              return (
                <View key={p.id} style={[s.eventRow, !isHome && s.eventRowAway]}>
                  <Text style={s.eventMin}>{p.minute}'</Text>
                  <View style={[s.eventIcon, { backgroundColor: `${Colors.red}22` }]}>
                    <Ionicons name="warning" size={12} color={Colors.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.eventName, !isHome && { textAlign: 'right' }]}>
                      {p.penalty?.firstName} {p.penalty?.lastName}
                    </Text>
                    <Text style={[s.eventSub, !isHome && { textAlign: 'right' }]}>{p.penaltyType}</Text>
                  </View>
                  {!isPlayed && (
                    <Pressable onPress={() => deleteEvent(p.id)} style={s.delBtn}>
                      <Ionicons name="close" size={14} color={Colors.red} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {goals.length === 0 && penalties.length === 0 && (
          <View style={s.center}>
            <Ionicons name="football-outline" size={40} color={Colors.di} />
            <Text style={s.empty}>Zatím žádné události</Text>
          </View>
        )}
      </ScrollView>

      {/* MODAL GÓL */}
      <Modal visible={modal === 'goal'} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Přidat gól</Text>
              <Pressable onPress={() => { setModal(null); resetGoalForm(); }}>
                <Ionicons name="close" size={22} color={Colors.mu} />
              </Pressable>
            </View>

            {/* Team toggle */}
            <View style={s.toggleRow}>
              <Pressable style={[s.toggle, goalTeam === 'home' && s.toggleActive]} onPress={() => setGoalTeam('home')}>
                <Text style={[s.toggleTxt, goalTeam === 'home' && s.toggleTxtActive]}>{match?.homeTeam?.abbr}</Text>
              </Pressable>
              <Pressable style={[s.toggle, goalTeam === 'away' && s.toggleActive]} onPress={() => setGoalTeam('away')}>
                <Text style={[s.toggleTxt, goalTeam === 'away' && s.toggleTxtActive]}>{match?.awayTeam?.abbr}</Text>
              </Pressable>
            </View>

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Minuta</Text>
                <TextInput style={s.input} value={goalMinute} onChangeText={setGoalMinute}
                  keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.di} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Poločas</Text>
                <View style={s.toggleRow}>
                  {['1','2','3'].map(p => (
                    <Pressable key={p} style={[s.toggle, goalPeriod === p && s.toggleActive]} onPress={() => setGoalPeriod(p)}>
                      <Text style={[s.toggleTxt, goalPeriod === p && s.toggleTxtActive]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Text style={s.label}>Střelec *</Text>
            <ScrollView style={s.playerList} nestedScrollEnabled>
              {scorerPlayers.length === 0 ? (
                <Text style={s.empty}>Soupiska nebyla odeslána – zadej ID ručně</Text>
              ) : (
                scorerPlayers.map((p: any) => (
                  <Pressable key={p.id} style={[s.playerOpt, goalScorer === p.id && s.playerOptActive]}
                    onPress={() => setGoalScorer(p.id)}>
                    <Text style={s.playerOptNum}>{p.jersey}</Text>
                    <Text style={[s.playerOptName, goalScorer === p.id && { color: Colors.bg }]}>
                      {p.firstName} {p.lastName}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <Text style={s.label}>Asistence (volitelně)</Text>
            <ScrollView style={[s.playerList, { maxHeight: 100 }]} nestedScrollEnabled>
              <Pressable style={[s.playerOpt, !goalAssist && s.playerOptActive]} onPress={() => setGoalAssist('')}>
                <Text style={[s.playerOptName, !goalAssist && { color: Colors.bg }]}>— bez asistence</Text>
              </Pressable>
              {scorerPlayers.filter((p: any) => p.id !== goalScorer).map((p: any) => (
                <Pressable key={p.id} style={[s.playerOpt, goalAssist === p.id && s.playerOptActive]}
                  onPress={() => setGoalAssist(p.id)}>
                  <Text style={s.playerOptNum}>{p.jersey}</Text>
                  <Text style={[s.playerOptName, goalAssist === p.id && { color: Colors.bg }]}>
                    {p.firstName} {p.lastName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable style={[s.submitBtn, saving && { opacity: 0.5 }]} onPress={submitGoal} disabled={saving}>
              {saving ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.submitTxt}>Potvrdit gól</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* MODAL TREST */}
      <Modal visible={modal === 'penalty'} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Přidat trest</Text>
              <Pressable onPress={() => { setModal(null); resetPenForm(); }}>
                <Ionicons name="close" size={22} color={Colors.mu} />
              </Pressable>
            </View>

            <View style={s.toggleRow}>
              <Pressable style={[s.toggle, penTeam === 'home' && s.toggleActive]} onPress={() => setPenTeam('home')}>
                <Text style={[s.toggleTxt, penTeam === 'home' && s.toggleTxtActive]}>{match?.homeTeam?.abbr}</Text>
              </Pressable>
              <Pressable style={[s.toggle, penTeam === 'away' && s.toggleActive]} onPress={() => setPenTeam('away')}>
                <Text style={[s.toggleTxt, penTeam === 'away' && s.toggleTxtActive]}>{match?.awayTeam?.abbr}</Text>
              </Pressable>
            </View>

            <Text style={s.label}>Minuta</Text>
            <TextInput style={s.input} value={penMinute} onChangeText={setPenMinute}
              keyboardType="numeric" placeholder="0" placeholderTextColor={Colors.di} />

            <Text style={s.label}>Druh trestu</Text>
            <View style={s.toggleRow}>
              {PENALTY_TYPES.map(t => (
                <Pressable key={t} style={[s.toggle, penType === t && s.toggleActive]} onPress={() => setPenType(t)}>
                  <Text style={[s.toggleTxt, penType === t && s.toggleTxtActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.label}>Hráč *</Text>
            <ScrollView style={s.playerList} nestedScrollEnabled>
              {penPlayers.length === 0 ? (
                <Text style={s.empty}>Soupiska nebyla odeslána</Text>
              ) : (
                penPlayers.map((p: any) => (
                  <Pressable key={p.id} style={[s.playerOpt, penPlayer === p.id && s.playerOptActive]}
                    onPress={() => setPenPlayer(p.id)}>
                    <Text style={s.playerOptNum}>{p.jersey}</Text>
                    <Text style={[s.playerOptName, penPlayer === p.id && { color: Colors.bg }]}>
                      {p.firstName} {p.lastName}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>

            <Pressable style={[s.submitBtn, saving && { opacity: 0.5 }]} onPress={submitPenalty} disabled={saving}>
              {saving ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.submitTxt}>Potvrdit trest</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: Colors.bg },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:          { width: 40, height: 40, justifyContent: 'center' },
  title:         { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  center:        { padding: 32, alignItems: 'center', gap: 8 },
  empty:         { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' },
  scoreboard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16 },
  teamBadge:     { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  teamAbbr:      { fontSize: Fonts.sizes.sm, fontWeight: '900', color: Colors.bg },
  teamName:      { fontSize: 10, color: Colors.mu, textAlign: 'center', maxWidth: 80 },
  score:         { fontSize: 40, fontWeight: '900', color: Colors.wh, marginHorizontal: 12 },
  statusPill:    { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  statusTxt:     { fontSize: 11, fontWeight: '700' },
  actionRow:     { flexDirection: 'row', gap: 8 },
  startBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.green, borderRadius: Radius.md, paddingVertical: 12 },
  startBtnTxt:   { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },
  goalBtn:       { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.go, borderRadius: Radius.md, paddingVertical: 12 },
  goalBtnTxt:    { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },
  penBtn:        { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.c1, borderRadius: Radius.md, paddingVertical: 12, borderWidth: 1, borderColor: Colors.red },
  penBtnTxt:     { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  endBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.red, borderRadius: Radius.md, paddingVertical: 12 },
  endBtnTxt:     { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  section:       { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 12, gap: 8 },
  sectionLabel:  { fontSize: 10, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventRowAway:  { flexDirection: 'row-reverse' },
  eventIcon:     { width: 24, height: 24, borderRadius: 12, backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center' },
  eventMin:      { width: 28, fontSize: Fonts.sizes.xs, color: Colors.di, textAlign: 'center' },
  eventName:     { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  eventSub:      { fontSize: Fonts.sizes.xs, color: Colors.mu },
  delBtn:        { padding: 4 },
  // modals
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: Colors.c1, borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, padding: 20, gap: 12, maxHeight: '85%' },
  sheetHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle:    { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  toggleRow:     { flexDirection: 'row', gap: 8 },
  toggle:        { flex: 1, paddingVertical: 8, borderRadius: Radius.sm, backgroundColor: Colors.c2, alignItems: 'center', borderWidth: 1, borderColor: Colors.bd },
  toggleActive:  { backgroundColor: Colors.go, borderColor: Colors.go },
  toggleTxt:     { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  toggleTxtActive:{ color: Colors.bg },
  row2:          { flexDirection: 'row', gap: 12 },
  label:         { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', marginBottom: 4 },
  input:         { backgroundColor: Colors.c2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd, padding: 10, color: Colors.wh, fontSize: Fonts.sizes.md },
  playerList:    { maxHeight: 160, backgroundColor: Colors.c2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd },
  playerOpt:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  playerOptActive:{ backgroundColor: Colors.go },
  playerOptNum:  { width: 24, fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.go, textAlign: 'center' },
  playerOptName: { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh },
  submitBtn:     { backgroundColor: Colors.go, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  submitTxt:     { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
