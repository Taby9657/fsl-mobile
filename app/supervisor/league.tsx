import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, Switch, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supervisorApi } from '../../services/api';
import { DatePicker } from '../../components/DatePicker';
import { Colors, Fonts, Radius } from '../../constants/colors';

// ─── typy ────────────────────────────────────────────────────────────────────

type Step = 'structure' | 'scope' | 'config' | 'preview' | 'done';
type Scope = 'division' | 'conference' | 'custom';

interface Team {
  id: string; name: string; abbr: string; color: string;
  division: string; conference: string | null; venue: string | null;
}

interface ConferenceGroup {
  name: string | null;   // null = nepřiřazené
  divisions: { name: string; teams: Team[] }[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return isNaN(d.getTime()) ? null : d;
}

function buildTree(teams: Team[]): ConferenceGroup[] {
  const map: Record<string, Record<string, Team[]>> = {};
  for (const t of teams) {
    const conf = t.conference ?? '__none__';
    const div  = t.division  ?? 'Bez divize';
    if (!map[conf]) map[conf] = {};
    if (!map[conf][div]) map[conf][div] = [];
    map[conf][div].push(t);
  }

  const groups: ConferenceGroup[] = [];

  // Konference seřazené abecedně, nepřiřazené nakonec
  const confKeys = Object.keys(map).sort((a, b) => {
    if (a === '__none__') return 1;
    if (b === '__none__') return -1;
    return a.localeCompare(b);
  });

  for (const conf of confKeys) {
    const divisions = Object.entries(map[conf])
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, ts]) => ({ name, teams: ts.sort((a, b) => a.name.localeCompare(b.name)) }));
    groups.push({ name: conf === '__none__' ? null : conf, divisions });
  }

  return groups;
}

function plural(n: number, s1: string, s2: string, s5: string) {
  if (n === 1) return `${n} ${s1}`;
  if (n < 5)  return `${n} ${s2}`;
  return `${n} ${s5}`;
}

// ─── komponenta ──────────────────────────────────────────────────────────────

export default function SuperLeagueScreen() {
  const [step, setStep]     = useState<Step>('structure');
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [tree, setTree]     = useState<ConferenceGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal pro přesun týmu
  const [moveTeam,  setMoveTeam]  = useState<Team | null>(null);
  const [movingId,  setMovingId]  = useState<string | null>(null);
  const [newDiv,    setNewDiv]    = useState('');
  const [newConf,   setNewConf]   = useState('');

  // Scope výběr
  const [scope, setScope]         = useState<Scope>('division');
  const [selDivision, setSelDiv]  = useState('');
  const [selConf,     setSelConf] = useState('');
  const [selTeamIds,  setSelTeamIds] = useState<string[]>([]);

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
      const r = await supervisorApi.conferences();
      const teams: Team[] = r.data ?? [];
      setAllTeams(teams);
      setTree(buildTree(teams));
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst strukturu ligy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // Všechny konference a divize pro picker
  const confNames = [...new Set(allTeams.map(t => t.conference).filter(Boolean) as string[])].sort();
  const divNames  = [...new Set(allTeams.map(t => t.division))].sort();

  // Počet vybraných týmů
  const scopeTeams = (() => {
    if (scope === 'division')   return allTeams.filter(t => t.division === selDivision);
    if (scope === 'conference') return allTeams.filter(t => t.conference === selConf);
    return allTeams.filter(t => selTeamIds.includes(t.id));
  })();

  // ── Přesun týmu ────────────────────────────────────────────────────────────

  async function doMoveTeam() {
    if (!moveTeam || !newDiv.trim()) return;
    setMovingId(moveTeam.id);
    try {
      await supervisorApi.updateTeam(moveTeam.id, {
        division:   newDiv.trim(),
        conference: newConf.trim() || null,
      });
      const updated = allTeams.map(t =>
        t.id === moveTeam.id ? { ...t, division: newDiv.trim(), conference: newConf.trim() || null } : t
      );
      setAllTeams(updated);
      setTree(buildTree(updated));
      setMoveTeam(null);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se přesunout tým');
    } finally {
      setMovingId(null);
    }
  }

  // ── Generování ─────────────────────────────────────────────────────────────

  async function loadPreview() {
    const d = startDate;
    if (!d) { Alert.alert('Chybné datum', 'Vyber datum 1. kola'); return; }
    if (scopeTeams.length < 2) { Alert.alert('Málo týmů', 'Vyber alespoň 2 týmy'); return; }

    setPrevLoad(true);
    try {
      const payload =
        scope === 'division'   ? { division: selDivision, doubleRoundRobin: dbl }
        : scope === 'conference' ? { conference: selConf,  doubleRoundRobin: dbl }
        :                          { teamIds: selTeamIds,  doubleRoundRobin: dbl };
      const r = await supervisorApi.previewFixtures(payload);
      setPreview(r.data);
      setStep('preview');
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se načíst náhled');
    } finally {
      setPrevLoad(false);
    }
  }

  async function generate() {
    const d = startDate;
    if (!d) return;
    setGenerating(true);
    try {
      const base =
        scope === 'division'   ? { division: selDivision }
        : scope === 'conference' ? { conference: selConf, division: selConf }
        :                          { teamIds: selTeamIds, division: 'Mix' };

      const r = await supervisorApi.generateFixtures({
        ...base,
        startDate:        d.toISOString(),
        roundIntervalDays: parseInt(interval) || 7,
        defaultTime:      time,
        defaultVenue:     venue.trim() || null,
        doubleRoundRobin: dbl,
        deleteExisting:   delExist,
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
                <Text style={s.emptyTitle}>Žádné týmy</Text>
                <Text style={s.emptyDesc}>Nejdřív přidej týmy ve Správě týmů.</Text>
              </View>
            ) : (
              tree.map((group, gi) => (
                <View key={gi} style={{ marginBottom: 20 }}>
                  {/* Konference hlavička */}
                  <View style={s.confHeader}>
                    <View style={s.confIcon}>
                      <Ionicons name="trophy-outline" size={14} color={Colors.go} />
                    </View>
                    <Text style={s.confTitle}>
                      {group.name ?? '⚠ Nepřiřazené týmy'}
                    </Text>
                    <Text style={s.confCount}>
                      {plural(group.divisions.reduce((a, d) => a + d.teams.length, 0), 'tým', 'týmy', 'týmů')}
                    </Text>
                  </View>

                  {group.divisions.map((div, di) => (
                    <View key={di} style={s.divBlock}>
                      {/* Divize hlavička */}
                      <View style={s.divHeader}>
                        <Text style={s.divName}>{div.name}</Text>
                        <Text style={s.divCount}>{plural(div.teams.length, 'tým', 'týmy', 'týmů')}</Text>
                      </View>

                      {/* Týmy */}
                      {div.teams.map(team => (
                        <View key={team.id} style={s.teamRow}>
                          <View style={[s.teamDot, { backgroundColor: team.color }]} />
                          <Text style={s.teamName} numberOfLines={1}>{team.name}</Text>
                          <Text style={s.teamAbbr}>{team.abbr}</Text>
                          <Pressable
                            style={s.moveBtn}
                            onPress={() => {
                              setMoveTeam(team);
                              setNewDiv(team.division);
                              setNewConf(team.conference ?? '');
                            }}
                          >
                            <Ionicons name="swap-horizontal-outline" size={16} color={Colors.go} />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ))
            )}

            <Pressable
              style={[s.primaryBtn, { marginTop: 8 }]}
              onPress={() => setStep('scope')}
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
                {divNames.map(d => (
                  <Pressable key={d} style={[s.pickerChip, selDivision === d && s.pickerChipActive]} onPress={() => setSelDiv(d)}>
                    <Text style={[s.pickerChipTxt, selDivision === d && s.pickerChipTxtActive]}>{d}</Text>
                    <Text style={[s.pickerChipCount, selDivision === d && { color: `${Colors.bg}99` }]}>
                      {plural(allTeams.filter(t => t.division === d).length, 'tým', 'týmy', 'týmů')}
                    </Text>
                  </Pressable>
                ))}
                {divNames.length === 0 && <Text style={s.noData}>Žádné divize</Text>}
              </View>
            )}

            {/* Konference */}
            <Pressable style={[s.scopeCard, scope === 'conference' && s.scopeCardActive]} onPress={() => setScope('conference')}>
              <View style={s.scopeIcon}>
                <Ionicons name="trophy-outline" size={20} color={scope === 'conference' ? Colors.bg : Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.scopeLabel, scope === 'conference' && { color: Colors.bg }]}>Konference</Text>
                <Text style={[s.scopeDesc, scope === 'conference' && { color: `${Colors.bg}99` }]}>Všechny týmy konference hrají křížově</Text>
              </View>
              {scope === 'conference' && <Ionicons name="checkmark-circle" size={22} color={Colors.bg} />}
            </Pressable>

            {scope === 'conference' && (
              <View style={s.subPicker}>
                <Text style={s.fieldLabel}>Vyber konferenci</Text>
                {confNames.map(c => (
                  <Pressable key={c} style={[s.pickerChip, selConf === c && s.pickerChipActive]} onPress={() => setSelConf(c)}>
                    <Text style={[s.pickerChipTxt, selConf === c && s.pickerChipTxtActive]}>{c}</Text>
                    <Text style={[s.pickerChipCount, selConf === c && { color: `${Colors.bg}99` }]}>
                      {plural(allTeams.filter(t => t.conference === c).length, 'tým', 'týmy', 'týmů')}
                    </Text>
                  </Pressable>
                ))}
                {confNames.length === 0 && <Text style={s.noData}>Žádné konference — přiřaď týmům konferenci ve Správě týmů.</Text>}
              </View>
            )}

            {/* Vlastní výběr */}
            <Pressable style={[s.scopeCard, scope === 'custom' && s.scopeCardActive]} onPress={() => setScope('custom')}>
              <View style={s.scopeIcon}>
                <Ionicons name="shuffle-outline" size={20} color={scope === 'custom' ? Colors.bg : Colors.go} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.scopeLabel, scope === 'custom' && { color: Colors.bg }]}>Vlastní výběr</Text>
                <Text style={[s.scopeDesc, scope === 'custom' && { color: `${Colors.bg}99` }]}>Vyber konkrétní týmy napříč divizemi</Text>
              </View>
              {scope === 'custom' && <Ionicons name="checkmark-circle" size={22} color={Colors.bg} />}
            </Pressable>

            {scope === 'custom' && (
              <View style={s.subPicker}>
                <Text style={s.fieldLabel}>Vyber týmy ({selTeamIds.length} vybráno)</Text>
                {allTeams.map(t => {
                  const sel = selTeamIds.includes(t.id);
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
                        <Text style={s.teamSubtitle}>{t.conference ? `${t.conference} · ` : ''}{t.division}</Text>
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
            {scopeTeams.length >= 2 && (
              <View style={s.infoBox}>
                <Ionicons name="people-outline" size={16} color={Colors.go} />
                <Text style={s.infoText}>{plural(scopeTeams.length, 'tým', 'týmy', 'týmů')} vybráno</Text>
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

      {/* ══ MODAL: PŘESUN TÝMU ════════════════════════════════════════════ */}
      <Modal visible={!!moveTeam} transparent animationType="slide">
        <Pressable style={s.backdrop} onPress={() => setMoveTeam(null)} />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Přesunout tým</Text>
          {moveTeam && (
            <View style={s.moveTeamBadge}>
              <View style={[s.teamDot, { width: 12, height: 12, borderRadius: 6, backgroundColor: moveTeam.color }]} />
              <Text style={s.moveTeamName}>{moveTeam.name}</Text>
            </View>
          )}

          <Text style={s.fieldLabel}>Konference (volitelné)</Text>
          <View style={s.confChips}>
            {confNames.map(c => (
              <Pressable
                key={c}
                style={[s.pickerChip, newConf === c && s.pickerChipActive]}
                onPress={() => setNewConf(newConf === c ? '' : c)}
              >
                <Text style={[s.pickerChipTxt, newConf === c && s.pickerChipTxtActive]}>{c}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[s.pickerChip, newConf === '' && s.pickerChipActive]}
              onPress={() => setNewConf('')}
            >
              <Text style={[s.pickerChipTxt, newConf === '' && s.pickerChipTxtActive]}>Bez konference</Text>
            </Pressable>
          </View>
          <TextInput
            style={[s.input, { marginTop: 6 }]}
            value={newConf}
            onChangeText={setNewConf}
            placeholder="nebo napiš novou konferenci…"
            placeholderTextColor={Colors.di}
            keyboardAppearance="dark"
          />

          <Text style={[s.fieldLabel, { marginTop: 16 }]}>Divize *</Text>
          <View style={s.confChips}>
            {divNames.map(d => (
              <Pressable
                key={d}
                style={[s.pickerChip, newDiv === d && s.pickerChipActive]}
                onPress={() => setNewDiv(d)}
              >
                <Text style={[s.pickerChipTxt, newDiv === d && s.pickerChipTxtActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[s.input, { marginTop: 6 }]}
            value={newDiv}
            onChangeText={setNewDiv}
            placeholder="nebo napiš novou divizi…"
            placeholderTextColor={Colors.di}
            keyboardAppearance="dark"
          />

          <Pressable
            style={[s.primaryBtn, (!newDiv.trim() || !!movingId) && s.btnDisabled]}
            onPress={doMoveTeam}
            disabled={!newDiv.trim() || !!movingId}
          >
            {movingId
              ? <ActivityIndicator color={Colors.bg} />
              : <Text style={s.primaryBtnText}>Přesunout</Text>
            }
          </Pressable>
          <Pressable style={s.secondaryBtn} onPress={() => setMoveTeam(null)}>
            <Text style={s.secondaryBtnText}>Zrušit</Text>
          </Pressable>
        </View>
      </Modal>
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

  // Modal
  backdrop:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:         { backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, marginTop: 'auto' },
  sheetHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.bd, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:    { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 16 },
  moveTeamBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.c2, borderRadius: Radius.sm, padding: 10, marginBottom: 4 },
  moveTeamName:  { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  confChips:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
