import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi, leaguesApi, type LeagueNode, type TeamPlacement } from '../../services/api';
import { DatePicker } from '../../components/DatePicker';
import { Colors, Fonts, Radius } from '../../constants/colors';

// ─── typy ────────────────────────────────────────────────────────────────────

type Step = 'structure' | 'scope' | 'config' | 'preview' | 'done';
type Scope = 'league' | 'conference' | 'division' | 'custom';

interface Team {
  id: string; name: string; abbr: string; color: string;
  placement: TeamPlacement | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function plural(n: number, s1: string, s2: string, s5: string) {
  if (n === 1) return `${n} ${s1}`;
  if (n < 5)  return `${n} ${s2}`;
  return `${n} ${s5}`;
}

// ─── komponenta ──────────────────────────────────────────────────────────────

export default function SuperLeagueScreen() {
  const [step, setStep]         = useState<Step>('structure');
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [tree, setTree]         = useState<LeagueNode[]>([]);
  const [season, setSeason]     = useState('');
  const [loading, setLoading]   = useState(true);

  // Scope výběr – pracujeme s ID ze soutěžní struktury
  const [scope, setScope]        = useState<Scope>('league');
  const [selLeague, setSelLeague] = useState<string>('');
  const [selConf,   setSelConf]   = useState<string>('');
  const [selDiv,    setSelDiv]    = useState<string>('');
  const [selTeamIds, setSelTeamIds] = useState<string[]>([]);

  // Konfigurace
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [interval,  setInterval]  = useState('7');
  const [time,      setTime]      = useState('18:00');
  const [venue,     setVenue]     = useState('');
  const [dbl,       setDbl]       = useState(false);
  const [delExist,  setDelExist]  = useState(false);

  // Preview / výsledek
  const [preview,   setPreview]   = useState<any>(null);
  const [prevLoad,  setPrevLoad]  = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result,    setResult]    = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [t, tm] = await Promise.all([leaguesApi.tree(), leaguesApi.teams()]);
      setTree(t.data.leagues ?? []);
      setAllTeams(tm.data.teams ?? []);
      if (t.data.season) setSeason(t.data.season);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst strukturu soutěží');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // Ligy a jejich části pro pickery
  const ligy        = tree;
  const konference  = tree.flatMap(l => l.conferences.map(k => ({ ...k, leagueName: l.name })));
  const divize      = tree.flatMap(l => l.conferences.flatMap(k =>
    k.divisions.map(d => ({ ...d, path: `${l.name} › ${k.name}` }))));

  // Týmy spadající do zvoleného rozsahu
  const scopeTeams = (() => {
    if (scope === 'league')     return allTeams.filter(t => t.placement?.leagueId === selLeague);
    if (scope === 'conference') return allTeams.filter(t => t.placement?.conferenceId === selConf);
    if (scope === 'division')   return allTeams.filter(t => t.placement?.divisionId === selDiv);
    return allTeams.filter(t => selTeamIds.includes(t.id));
  })();

  // Rozsah, který se posílá na backend
  function scopePayload() {
    if (scope === 'league')     return { leagueId: selLeague };
    if (scope === 'conference') return { conferenceId: selConf };
    if (scope === 'division')   return { divisionId: selDiv };
    return { teamIds: selTeamIds, division: 'Mix' };
  }

  const scopeVybran =
    scope === 'league'     ? !!selLeague
    : scope === 'conference' ? !!selConf
    : scope === 'division'   ? !!selDiv
    :                          selTeamIds.length >= 2;

  // ── Generování ─────────────────────────────────────────────────────────────

  async function loadPreview() {
    if (!startDate) { Alert.alert('Chybné datum', 'Vyber datum 1. kola'); return; }
    if (scopeTeams.length < 2) { Alert.alert('Málo týmů', 'Vyber alespoň 2 týmy'); return; }

    setPrevLoad(true);
    try {
      const r = await supervisorApi.previewFixtures({
        ...scopePayload(), season: season || null, doubleRoundRobin: dbl,
      });
      setPreview(r.data);
      setStep('preview');
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se načíst náhled');
    } finally {
      setPrevLoad(false);
    }
  }

  async function generate() {
    if (!startDate) return;
    setGenerating(true);
    try {
      const r = await supervisorApi.generateFixtures({
        ...scopePayload(),
        startDate:         startDate.toISOString(),
        season:            season.trim() || null,
        roundIntervalDays: parseInt(interval) || 7,
        defaultTime:       time,
        defaultVenue:      venue.trim() || null,
        doubleRoundRobin:  dbl,
        deleteExisting:    delExist,
      });
      setResult(r.data);
      setStep('done');
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se vygenerovat');
    } finally {
      setGenerating(false);
    }
  }

  // ── Back button ────────────────────────────────────────────────────────────

  function goBack() {
    if (step === 'structure') { router.back(); return; }
    if (step === 'scope')     { setStep('structure'); return; }
    if (step === 'config')    { setStep('scope'); return; }
    if (step === 'preview')   { setStep('config'); return; }
    setStep('structure');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
    </SafeAreaView>
  );

  const STEP_LABELS = ['Struktura', 'Rozsah', 'Konfig', 'Náhled'];
  const STEP_KEYS: Step[] = ['structure', 'scope', 'config', 'preview'];

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={goBack} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>
          {step === 'structure' ? 'Správa ligy' :
           step === 'scope'     ? 'Rozsah rozlosování' :
           step === 'config'    ? 'Konfigurace' :
           step === 'preview'   ? 'Náhled' : 'Hotovo'}
        </Text>
        {step === 'structure' && (
          <Pressable onPress={() => { load(); }} style={s.back}>
            <Ionicons name="refresh-outline" size={20} color={Colors.mu} />
          </Pressable>
        )}
        {step !== 'structure' && <View style={{ width: 40 }} />}
      </View>

      {/* Step indicator (pro kroky scope → preview) */}
      {step !== 'structure' && step !== 'done' && (
        <View style={s.steps}>
          {STEP_LABELS.map((label, i) => {
            const cur  = STEP_KEYS.indexOf(step);
            const past = cur > i;
            const act  = cur === i;
            return (
              <View key={label} style={s.stepItem}>
                <View style={[s.stepDot, (past || act) && { backgroundColor: Colors.go }]}>
                  {past
                    ? <Ionicons name="checkmark" size={11} color={Colors.bg} />
                    : <Text style={[s.stepNum, (past || act) && { color: Colors.bg }]}>{i + 1}</Text>
                  }
                </View>
                <Text style={[s.stepLabel, (act || past) && { color: Colors.wh }]}>{label}</Text>
                {i < 3 && <View style={[s.stepLine, past && { backgroundColor: Colors.go }]} />}
              </View>
            );
          })}
        </View>
      )}

      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">

        {/* ══ STEP: STRUKTURA ══════════════════════════════════════════════ */}
        {step === 'structure' && (
          <>
            {tree.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="git-network-outline" size={40} color={Colors.mu} />
                <Text style={s.emptyTitle}>Žádná soutěž v sezóně {season}</Text>
                <Text style={s.emptyDesc}>Nejdřív založ ligu ve Struktuře soutěží.</Text>
              </View>
            ) : (
              tree.map(liga => (
                <View key={liga.id} style={{ marginBottom: 18 }}>
                  <View style={s.confHeader}>
                    <View style={s.confIcon}>
                      <Ionicons name="trophy-outline" size={14} color={Colors.go} />
                    </View>
                    <Text style={s.confTitle}>{liga.name}</Text>
                    <Text style={s.confCount}>{plural(liga.teamCount ?? 0, 'tým', 'týmy', 'týmů')}</Text>
                  </View>

                  {liga.conferences.length === 0 && (
                    <View style={s.divBlock}>
                      <View style={s.divHeader}>
                        <Text style={s.divName}>Bez konferencí</Text>
                        <Text style={s.divCount}>{plural(liga.teamCount ?? 0, 'tým', 'týmy', 'týmů')}</Text>
                      </View>
                      {allTeams.filter(t => t.placement?.leagueId === liga.id).map(team => (
                        <View key={team.id} style={s.teamRow}>
                          <View style={[s.teamDot, { backgroundColor: team.color }]} />
                          <Text style={s.teamName} numberOfLines={1}>{team.name}</Text>
                          <Text style={s.teamAbbr}>{team.abbr}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {liga.conferences.map(konf => (
                    <View key={konf.id} style={s.divBlock}>
                      <View style={s.divHeader}>
                        <Text style={s.divName}>{konf.name}</Text>
                        <Text style={s.divCount}>{plural(konf.teamCount ?? 0, 'tým', 'týmy', 'týmů')}</Text>
                      </View>
                      {konf.divisions.map(div => (
                        <View key={div.id}>
                          <View style={s.subDivHeader}>
                            <Ionicons name="grid-outline" size={11} color={Colors.mu} />
                            <Text style={s.subDivName}>{div.name}</Text>
                            <Text style={s.divCount}>{plural(div.teamCount ?? 0, 'tým', 'týmy', 'týmů')}</Text>
                          </View>
                          {allTeams.filter(t => t.placement?.divisionId === div.id).map(team => (
                            <View key={team.id} style={s.teamRow}>
                              <View style={[s.teamDot, { backgroundColor: team.color }]} />
                              <Text style={s.teamName} numberOfLines={1}>{team.name}</Text>
                              <Text style={s.teamAbbr}>{team.abbr}</Text>
                            </View>
                          ))}
                        </View>
                      ))}
                      {allTeams.filter(t => t.placement?.conferenceId === konf.id && !t.placement?.divisionId).map(team => (
                        <View key={team.id} style={s.teamRow}>
                          <View style={[s.teamDot, { backgroundColor: team.color }]} />
                          <Text style={s.teamName} numberOfLines={1}>{team.name}</Text>
                          <Text style={s.teamAbbr}>{team.abbr}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ))
            )}

            {allTeams.some(t => !t.placement) && (
              <View style={s.infoBox}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.go} />
                <Text style={s.infoText}>
                  {plural(allTeams.filter(t => !t.placement).length, 'tým není', 'týmy nejsou', 'týmů není')} zařazen
                  do soutěže — do rozlosování se nedostane.
                </Text>
              </View>
            )}

            <Pressable style={s.secondaryBtn} onPress={() => router.push('/supervisor/leagues' as any)}>
              <Text style={s.secondaryBtnText}>Upravit strukturu a zařazení týmů →</Text>
            </Pressable>

            <Pressable
              style={[s.primaryBtn, tree.length === 0 && s.btnDisabled]}
              onPress={() => setStep('scope')}
              disabled={tree.length === 0}
            >
              <Ionicons name="calendar-outline" size={18} color={Colors.bg} />
              <Text style={s.primaryBtnText}>Generovat rozlosování →</Text>
            </Pressable>
          </>
        )}

        {/* ══ STEP: ROZSAH ══════════════════════════════════════════════════ */}
        {step === 'scope' && (
          <>
            <Text style={s.sectionTitle}>Vyber rozsah rozlosování</Text>

            {/* Liga */}
            <Pressable style={[s.scopeCard, scope === 'league' && s.scopeCardActive]} onPress={() => setScope('league')}>
              <View style={s.scopeIcon}>
                <Ionicons name="trophy-outline" size={20} color={scope === 'league' ? Colors.bg : Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.scopeLabel, scope === 'league' && { color: Colors.bg }]}>Celá liga</Text>
                <Text style={[s.scopeDesc, scope === 'league' && { color: `${Colors.bg}99` }]}>Každý s každým napříč celou ligou</Text>
              </View>
              {scope === 'league' && <Ionicons name="checkmark-circle" size={22} color={Colors.bg} />}
            </Pressable>

            {scope === 'league' && (
              <View style={s.subPicker}>
                <Text style={s.fieldLabel}>Vyber ligu</Text>
                {ligy.map(l => (
                  <Pressable key={l.id} style={[s.pickerChip, selLeague === l.id && s.pickerChipActive]} onPress={() => setSelLeague(l.id)}>
                    <Text style={[s.pickerChipTxt, selLeague === l.id && s.pickerChipTxtActive]}>{l.name}</Text>
                    <Text style={[s.pickerChipCount, selLeague === l.id && { color: `${Colors.bg}99` }]}>
                      {plural(l.teamCount ?? 0, 'tým', 'týmy', 'týmů')}
                    </Text>
                  </Pressable>
                ))}
                {ligy.length === 0 && <Text style={s.noData}>Žádné ligy</Text>}
              </View>
            )}

            {/* Konference */}
            <Pressable style={[s.scopeCard, scope === 'conference' && s.scopeCardActive]} onPress={() => setScope('conference')}>
              <View style={s.scopeIcon}>
                <Ionicons name="git-branch-outline" size={20} color={scope === 'conference' ? Colors.bg : Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.scopeLabel, scope === 'conference' && { color: Colors.bg }]}>Konference</Text>
                <Text style={[s.scopeDesc, scope === 'conference' && { color: `${Colors.bg}99` }]}>Týmy jedné konference hrají křížově</Text>
              </View>
              {scope === 'conference' && <Ionicons name="checkmark-circle" size={22} color={Colors.bg} />}
            </Pressable>

            {scope === 'conference' && (
              <View style={s.subPicker}>
                <Text style={s.fieldLabel}>Vyber konferenci</Text>
                {konference.map(k => (
                  <Pressable key={k.id} style={[s.pickerChip, selConf === k.id && s.pickerChipActive]} onPress={() => setSelConf(k.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.pickerChipTxt, selConf === k.id && s.pickerChipTxtActive]}>{k.name}</Text>
                      <Text style={[s.teamSubtitle, selConf === k.id && { color: `${Colors.bg}99` }]}>{k.leagueName}</Text>
                    </View>
                    <Text style={[s.pickerChipCount, selConf === k.id && { color: `${Colors.bg}99` }]}>
                      {plural(k.teamCount ?? 0, 'tým', 'týmy', 'týmů')}
                    </Text>
                  </Pressable>
                ))}
                {konference.length === 0 && <Text style={s.noData}>Žádné konference — přidej je ve Struktuře soutěží.</Text>}
              </View>
            )}

            {/* Divize */}
            <Pressable style={[s.scopeCard, scope === 'division' && s.scopeCardActive]} onPress={() => setScope('division')}>
              <View style={s.scopeIcon}>
                <Ionicons name="grid-outline" size={20} color={scope === 'division' ? Colors.bg : Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.scopeLabel, scope === 'division' && { color: Colors.bg }]}>Divize</Text>
                <Text style={[s.scopeDesc, scope === 'division' && { color: `${Colors.bg}99` }]}>Zápasy jen v rámci jedné divize</Text>
              </View>
              {scope === 'division' && <Ionicons name="checkmark-circle" size={22} color={Colors.bg} />}
            </Pressable>

            {scope === 'division' && (
              <View style={s.subPicker}>
                <Text style={s.fieldLabel}>Vyber divizi</Text>
                {divize.map(d => (
                  <Pressable key={d.id} style={[s.pickerChip, selDiv === d.id && s.pickerChipActive]} onPress={() => setSelDiv(d.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.pickerChipTxt, selDiv === d.id && s.pickerChipTxtActive]}>{d.name}</Text>
                      <Text style={[s.teamSubtitle, selDiv === d.id && { color: `${Colors.bg}99` }]}>{d.path}</Text>
                    </View>
                    <Text style={[s.pickerChipCount, selDiv === d.id && { color: `${Colors.bg}99` }]}>
                      {plural(d.teamCount ?? 0, 'tým', 'týmy', 'týmů')}
                    </Text>
                  </Pressable>
                ))}
                {divize.length === 0 && <Text style={s.noData}>Žádné divize — přidej je ve Struktuře soutěží.</Text>}
              </View>
            )}

            {/* Vlastní výběr */}
            <Pressable style={[s.scopeCard, scope === 'custom' && s.scopeCardActive]} onPress={() => setScope('custom')}>
              <View style={s.scopeIcon}>
                <Ionicons name="shuffle-outline" size={20} color={scope === 'custom' ? Colors.bg : Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.scopeLabel, scope === 'custom' && { color: Colors.bg }]}>Vlastní výběr</Text>
                <Text style={[s.scopeDesc, scope === 'custom' && { color: `${Colors.bg}99` }]}>Vyber konkrétní týmy napříč soutěžemi</Text>
              </View>
              {scope === 'custom' && <Ionicons name="checkmark-circle" size={22} color={Colors.bg} />}
            </Pressable>

            {scope === 'custom' && (
              <View style={s.subPicker}>
                <Text style={s.fieldLabel}>Vyber týmy ({selTeamIds.length} vybráno)</Text>
                {allTeams.map(t => {
                  const sel = selTeamIds.includes(t.id);
                  const cesta = [t.placement?.league?.name, t.placement?.conference?.name, t.placement?.division?.name]
                    .filter(Boolean).join(' › ') || 'Nezařazeno';
                  return (
                    <Pressable
                      key={t.id}
                      style={[s.teamCheckRow, sel && s.teamCheckRowActive]}
                      onPress={() => setSelTeamIds(prev =>
                        sel ? prev.filter(id => id !== t.id) : [...prev, t.id]
                      )}
                    >
                      <View style={[s.teamDot, { backgroundColor: t.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.teamName, sel && { color: Colors.go }]}>{t.name}</Text>
                        <Text style={s.teamSubtitle}>{cesta}</Text>
                      </View>
                      <Ionicons
                        name={sel ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={sel ? Colors.go : Colors.di}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Info */}
            {scopeVybran && (
              <View style={s.infoBox}>
                <Ionicons name="people-outline" size={16} color={Colors.go} />
                <Text style={s.infoText}>
                  {scopeTeams.length >= 2
                    ? `${plural(scopeTeams.length, 'tým', 'týmy', 'týmů')} vybráno`
                    : 'Ve vybraném rozsahu jsou méně než 2 týmy — zařaď je ve Struktuře soutěží.'}
                </Text>
              </View>
            )}

            <Pressable
              style={[s.primaryBtn, scopeTeams.length < 2 && s.btnDisabled]}
              onPress={() => setStep('config')}
              disabled={scopeTeams.length < 2}
            >
              <Text style={s.primaryBtnText}>Pokračovat →</Text>
            </Pressable>
          </>
        )}

        {/* ══ STEP: KONFIGURACE ══════════════════════════════════════════════ */}
        {step === 'config' && (
          <>
            <Text style={s.sectionTitle}>Nastavení rozpisu</Text>

            <Text style={s.fieldLabel}>Datum 1. kola *</Text>
            <DatePicker value={startDate} onChange={setStartDate} placeholder="Vybrat datum" />

            <Text style={s.fieldLabel}>Sezóna (např. 2025/26)</Text>
            <TextInput
              style={s.input}
              value={season}
              onChangeText={setSeason}
              placeholder="2025/26"
              placeholderTextColor={Colors.di}
              keyboardAppearance="dark"
              autoCapitalize="none"
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Čas zápasů</Text>
                <TextInput
                  style={s.input}
                  value={time}
                  onChangeText={setTime}
                  placeholder="18:00"
                  placeholderTextColor={Colors.di}
                  keyboardType="numbers-and-punctuation"
                  keyboardAppearance="dark"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Interval (dní)</Text>
                <TextInput
                  style={s.input}
                  value={interval}
                  onChangeText={setInterval}
                  placeholder="7"
                  placeholderTextColor={Colors.di}
                  keyboardType="number-pad"
                  keyboardAppearance="dark"
                />
              </View>
            </View>

            <Text style={s.fieldLabel}>Výchozí hřiště (volitelné)</Text>
            <TextInput
              style={s.input}
              value={venue}
              onChangeText={setVenue}
              placeholder="Sportovní hala XY"
              placeholderTextColor={Colors.di}
              keyboardAppearance="dark"
            />

            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLabel}>Dvojité rozlosování</Text>
                <Text style={s.switchDesc}>Každý tým hraje s každým doma i venku</Text>
              </View>
              <Switch value={dbl} onValueChange={setDbl} trackColor={{ true: Colors.go }} />
            </View>

            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchLabel}>Smazat stávající zápasy</Text>
                <Text style={s.switchDesc}>Odstraní UPCOMING zápasy před generováním</Text>
              </View>
              <Switch value={delExist} onValueChange={setDelExist} trackColor={{ true: Colors.red }} />
            </View>

            <View style={s.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.go} />
              <Text style={s.infoText}>
                {scopeTeams.length} týmů · {dbl ? (scopeTeams.length - 1) * 2 : scopeTeams.length - 1} kol ·{' '}
                {dbl
                  ? scopeTeams.length * (scopeTeams.length - 1)
                  : Math.floor(scopeTeams.length * (scopeTeams.length - 1) / 2)
                } zápasů
              </Text>
            </View>

            <Pressable
              style={[s.primaryBtn, prevLoad && { opacity: 0.6 }]}
              onPress={loadPreview}
              disabled={prevLoad}
            >
              {prevLoad
                ? <ActivityIndicator color={Colors.bg} />
                : <Text style={s.primaryBtnText}>Zobrazit náhled →</Text>
              }
            </Pressable>
          </>
        )}

        {/* ══ STEP: NÁHLED ══════════════════════════════════════════════════ */}
        {step === 'preview' && preview && (
          <>
            <View style={s.previewSummary}>
              <Text style={s.previewTitle}>Rozlosování připraveno</Text>
              <View style={s.previewStats}>
                <View style={s.previewStat}>
                  <Text style={s.previewNum}>{preview.teams}</Text>
                  <Text style={s.previewStatLabel}>týmů</Text>
                </View>
                <View style={s.previewStat}>
                  <Text style={s.previewNum}>{preview.rounds}</Text>
                  <Text style={s.previewStatLabel}>kol</Text>
                </View>
                <View style={s.previewStat}>
                  <Text style={s.previewNum}>{preview.matches}</Text>
                  <Text style={s.previewStatLabel}>zápasů</Text>
                </View>
              </View>
            </View>

            {Array.from({ length: preview.rounds }, (_, i) => i + 1).map(r => (
              <View key={r} style={{ marginBottom: 16 }}>
                <Text style={s.roundLabel}>Kolo {r}</Text>
                {preview.fixtures.filter((f: any) => f.round === r).map((f: any, idx: number) => (
                  <View key={idx} style={s.fixtureRow}>
                    <View style={[s.teamDot, { backgroundColor: f.homeTeam?.color ?? Colors.go }]} />
                    <Text style={s.fixtureName}>{f.homeTeam?.abbr}</Text>
                    <Text style={s.fixtureVs}>vs</Text>
                    <Text style={s.fixtureName}>{f.awayTeam?.abbr}</Text>
                    <View style={[s.teamDot, { backgroundColor: f.awayTeam?.color ?? Colors.mu }]} />
                  </View>
                ))}
              </View>
            ))}

            <Pressable
              style={[s.primaryBtn, generating && { opacity: 0.6 }]}
              onPress={generate}
              disabled={generating}
            >
              {generating
                ? <ActivityIndicator color={Colors.bg} />
                : <Text style={s.primaryBtnText}>Vygenerovat ✓</Text>
              }
            </Pressable>
          </>
        )}

        {/* ══ STEP: HOTOVO ══════════════════════════════════════════════════ */}
        {step === 'done' && result && (
          <View style={s.doneBox}>
            <View style={s.doneIcon}>
              <Ionicons name="checkmark" size={40} color={Colors.bg} />
            </View>
            <Text style={s.doneTitle}>Rozlosování vytvořeno!</Text>
            <Text style={s.doneDesc}>
              {result.created} zápasů v {result.rounds} kolech.
            </Text>
            <Pressable style={s.primaryBtn} onPress={() => router.push('/supervisor/matches')}>
              <Text style={s.primaryBtnText}>Zobrazit zápasy →</Text>
            </Pressable>
            <Pressable style={s.secondaryBtn} onPress={() => { setStep('structure'); setPreview(null); setResult(null); }}>
              <Text style={s.secondaryBtnText}>Zpět na strukturu</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── styly ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: Colors.bg },
  header:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:     { width: 40, height: 40, justifyContent: 'center' },
  title:    { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  // Steps
  steps:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  stepItem:  { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepDot:   { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, justifyContent: 'center', alignItems: 'center' },
  stepNum:   { fontSize: 10, fontWeight: '700', color: Colors.mu },
  stepLabel: { fontSize: 9, color: Colors.di, marginLeft: 3, fontWeight: '600' },
  stepLine:  { flex: 1, height: 1, backgroundColor: Colors.bd, marginHorizontal: 3 },

  sectionTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, marginBottom: 16 },
  fieldLabel:   { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, marginTop: 14 },
  input:        { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh },

  // Konference / Divize strom
  confHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  confIcon:   { width: 24, height: 24, borderRadius: 12, backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center' },
  confTitle:  { flex: 1, fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.go },
  confCount:  { fontSize: Fonts.sizes.xs, color: Colors.mu },
  divBlock:   { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, marginBottom: 10, overflow: 'hidden' },
  divHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.c2 },
  divName:    { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  divCount:   { fontSize: Fonts.sizes.xs, color: Colors.mu },
  subDivHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderTopColor: Colors.bd },
  subDivName:   { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700' },
  teamRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.bd },
  teamName:   { flex: 1, fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  teamAbbr:   { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', width: 30, textAlign: 'right' },
  teamDot:    { width: 10, height: 10, borderRadius: 5 },
  moveBtn:    { padding: 6, marginLeft: 4 },

  // Scope karty
  scopeCard:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, marginBottom: 10 },
  scopeCardActive: { backgroundColor: Colors.go, borderColor: Colors.go },
  scopeIcon:       { width: 36, height: 36, borderRadius: Radius.sm, backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center' },
  scopeLabel:      { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  scopeDesc:       { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },

  subPicker:       { backgroundColor: Colors.c2, borderRadius: Radius.md, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: Colors.bd },
  pickerChip:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd, marginBottom: 6 },
  pickerChipActive:{ backgroundColor: Colors.go, borderColor: Colors.go },
  pickerChipTxt:   { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  pickerChipTxtActive: { color: Colors.bg },
  pickerChipCount: { fontSize: Fonts.sizes.xs, color: Colors.mu },
  noData:          { fontSize: Fonts.sizes.sm, color: Colors.di, textAlign: 'center', paddingVertical: 8 },

  teamCheckRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd, marginBottom: 6 },
  teamCheckRowActive:  { borderColor: Colors.go, backgroundColor: `${Colors.go}11` },
  teamSubtitle:        { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 1 },

  infoBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.go}22`, borderRadius: Radius.md, padding: 12, marginTop: 16, borderWidth: 1, borderColor: `${Colors.go}44` },
  infoText: { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.go, fontWeight: '600' },

  switchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, marginTop: 14 },
  switchLabel: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  switchDesc:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },

  primaryBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, marginTop: 20 },
  primaryBtnText:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  secondaryBtn:    { borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 10 },
  secondaryBtnText:{ fontSize: Fonts.sizes.md, color: Colors.mu, fontWeight: '600' },
  btnDisabled:     { opacity: 0.4 },

  previewSummary:  { backgroundColor: Colors.c1, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.bd, padding: 20, alignItems: 'center', marginBottom: 20 },
  previewTitle:    { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 16 },
  previewStats:    { flexDirection: 'row', gap: 32 },
  previewStat:     { alignItems: 'center' },
  previewNum:      { fontSize: 28, fontWeight: '900', color: Colors.go },
  previewStatLabel:{ fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },

  roundLabel:  { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fixtureRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.c1, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4 },
  fixtureName: { flex: 1, fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  fixtureVs:   { fontSize: Fonts.sizes.xs, color: Colors.mu },

  doneBox:   { alignItems: 'center', paddingTop: 24 },
  doneIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.go, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  doneTitle: { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.wh, marginBottom: 10 },
  doneDesc:  { fontSize: Fonts.sizes.md, color: Colors.mu, textAlign: 'center', lineHeight: 22, marginBottom: 20 },

  emptyBox:   { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  emptyDesc:  { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' },

});
