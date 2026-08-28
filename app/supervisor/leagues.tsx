/**
 * Struktura soutěží — liga → konference → divize.
 *
 * Hloubka je volitelná: liga bez konferencí je platný stav. Zakládat,
 * přejmenovávat, mazat a přeřazovat týmy smí jen supervisor; ostatní
 * obrazovky strukturu jen čtou.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, TextInput,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { leaguesApi, statsApi, type LeagueNode, type TeamPlacement } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

const MAX_LIG        = 10;
const MAX_KONFERENCI = 2;
const MAX_DIVIZI     = 2;

interface TeamRow {
  id: string; name: string; abbr: string; color: string; regStatus?: string;
  _count?: { players: number };
  placement: TeamPlacement | null;
}

type Sheet =
  | { kind: 'league';     id?: string; name: string; level: string }
  | { kind: 'conference'; id?: string; leagueId: string; name: string }
  | { kind: 'division';   id?: string; conferenceId: string; name: string }
  | { kind: 'placement';  team: TeamRow }
  | null;

function plural(n: number, s1: string, s2: string, s5: string) {
  if (n === 1) return `${n} ${s1}`;
  if (n < 5)   return `${n} ${s2}`;
  return `${n} ${s5}`;
}

export default function LeaguesScreen() {
  const [season,  setSeason]  = useState<string | undefined>(undefined);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [tree,    setTree]    = useState<LeagueNode[]>([]);
  const [teams,   setTeams]   = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [sheet,   setSheet]   = useState<Sheet>(null);
  const [open,    setOpen]    = useState<Record<string, boolean>>({});

  // Rozpracovaný výběr v sheetu pro zařazení týmu
  const [selLeague, setSelLeague] = useState<string | null>(null);
  const [selConf,   setSelConf]   = useState<string | null>(null);
  const [selDiv,    setSelDiv]    = useState<string | null>(null);

  const load = useCallback(async (s?: string, isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [t, tm] = await Promise.all([leaguesApi.tree(s), leaguesApi.teams(s)]);
      setTree(t.data.leagues ?? []);
      setTeams(tm.data.teams ?? []);
      if (!s && t.data.season) setSeason(t.data.season);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se načíst strukturu soutěží');
    } finally {
      setLoading(false);
      setRefresh(false);
    }
  }, []);

  useEffect(() => {
    statsApi.seasons().then(r => setSeasons(r.data ?? [])).catch(() => {});
    load();
  }, []);

  const nezarazene = useMemo(() => teams.filter(t => !t.placement), [teams]);

  function teamyV(predikat: (p: TeamPlacement) => boolean) {
    return teams.filter(t => t.placement && predikat(t.placement));
  }

  // ── Ukládání ───────────────────────────────────────────────────────────────

  async function ulozSheet() {
    if (!sheet || sheet.kind === 'placement') return;
    const nazev = sheet.name.trim();
    if (!nazev) { Alert.alert('Chybí název', 'Zadej název.'); return; }

    setBusy(true);
    try {
      if (sheet.kind === 'league') {
        const level = parseInt(sheet.level, 10);
        const data  = { name: nazev, ...(Number.isInteger(level) ? { level } : {}) };
        if (sheet.id) await leaguesApi.updateLeague(sheet.id, data);
        else          await leaguesApi.createLeague({ ...data, season });
      } else if (sheet.kind === 'conference') {
        if (sheet.id) await leaguesApi.updateConference(sheet.id, nazev);
        else          await leaguesApi.createConference(sheet.leagueId, nazev);
      } else {
        if (sheet.id) await leaguesApi.updateDivision(sheet.id, nazev);
        else          await leaguesApi.createDivision(sheet.conferenceId, nazev);
      }
      setSheet(null);
      await load(season, true);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se uložit');
    } finally {
      setBusy(false);
    }
  }

  function smaz(kind: 'league' | 'conference' | 'division', id: string, nazev: string) {
    const co = kind === 'league' ? 'ligu' : kind === 'conference' ? 'konferenci' : 'divizi';
    Alert.alert(
      `Smazat ${co}?`,
      `„${nazev}" se odstraní. Smazat lze jen prázdnou ${co} — týmy nejdřív přeřaď jinam.`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat', style: 'destructive',
          onPress: async () => {
            try {
              if (kind === 'league')          await leaguesApi.deleteLeague(id);
              else if (kind === 'conference') await leaguesApi.deleteConference(id);
              else                            await leaguesApi.deleteDivision(id);
              await load(season, true);
            } catch (err: any) {
              Alert.alert('Nelze smazat', err?.response?.data?.error ?? 'Zkus to znovu');
            }
          },
        },
      ],
    );
  }

  function otevriZarazeni(team: TeamRow) {
    setSelLeague(team.placement?.leagueId ?? null);
    setSelConf(team.placement?.conferenceId ?? null);
    setSelDiv(team.placement?.divisionId ?? null);
    setSheet({ kind: 'placement', team });
  }

  async function ulozZarazeni() {
    if (!sheet || sheet.kind !== 'placement') return;
    setBusy(true);
    try {
      await leaguesApi.setPlacement(sheet.team.id, {
        leagueId:     selLeague,
        conferenceId: selLeague ? selConf : null,
        divisionId:   selLeague && selConf ? selDiv : null,
        season,
      });
      setSheet(null);
      await load(season, true);
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se zařadit tým');
    } finally {
      setBusy(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
    </SafeAreaView>
  );

  const sheetLiga = selLeague ? tree.find(l => l.id === selLeague) : null;
  const sheetKonf = sheetLiga?.conferences.find(k => k.id === selConf) ?? null;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Struktura soutěží</Text>
        <Pressable onPress={() => load(season, true)} style={s.iconBtn}>
          <Ionicons name="refresh-outline" size={20} color={Colors.mu} />
        </Pressable>
      </View>

      {/* Sezóna */}
      {seasons.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingBottom: 10 }}>
          {seasons.map(sz => (
            <Pressable key={sz} style={[s.chip, season === sz && s.chipActive]}
              onPress={() => { setSeason(sz); load(sz); }}>
              <Text style={[s.chipTxt, season === sz && s.chipTxtActive]}>{sz}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(season, true); }} tintColor={Colors.go} />}
      >
        <View style={s.introBox}>
          <Ionicons name="git-network-outline" size={16} color={Colors.go} />
          <Text style={s.introTxt}>
            Liga může mít až {MAX_KONFERENCI} konference, konference až {MAX_DIVIZI} divize.
            Konference ani divize nejsou povinné — pro jednu soutěž stačí samotná liga.
          </Text>
        </View>

        {tree.length === 0 && (
          <View style={s.emptyBox}>
            <Ionicons name="trophy-outline" size={40} color={Colors.mu} />
            <Text style={s.emptyTitle}>Žádná liga v sezóně {season}</Text>
            <Text style={s.emptyDesc}>Založ první ligu a zařaď do ní týmy.</Text>
          </View>
        )}

        {tree.map(liga => {
          const rozbaleno = open[liga.id] !== false;
          return (
            <View key={liga.id} style={s.ligaCard}>
              {/* Hlavička ligy */}
              <Pressable style={s.ligaHead} onPress={() => setOpen(o => ({ ...o, [liga.id]: !rozbaleno }))}>
                <View style={s.levelBadge}><Text style={s.levelTxt}>{liga.level}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.ligaName}>{liga.name}</Text>
                  <Text style={s.ligaMeta}>
                    {plural(liga.teamCount ?? 0, 'tým', 'týmy', 'týmů')}
                    {liga.conferences.length > 0 && ` · ${plural(liga.conferences.length, 'konference', 'konference', 'konferencí')}`}
                  </Text>
                </View>
                <Pressable style={s.iconMini} onPress={() => setSheet({ kind: 'league', id: liga.id, name: liga.name, level: String(liga.level) })}>
                  <Ionicons name="create-outline" size={17} color={Colors.mu} />
                </Pressable>
                <Pressable style={s.iconMini} onPress={() => smaz('league', liga.id, liga.name)}>
                  <Ionicons name="trash-outline" size={17} color={Colors.red} />
                </Pressable>
                <Ionicons name={rozbaleno ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.di} />
              </Pressable>

              {rozbaleno && (
                <View style={s.ligaBody}>
                  {liga.conferences.map(konf => (
                    <View key={konf.id} style={s.konfBlock}>
                      <View style={s.konfHead}>
                        <Ionicons name="trophy-outline" size={13} color={Colors.go} />
                        <Text style={s.konfName}>{konf.name}</Text>
                        <Text style={s.subCount}>{plural(konf.teamCount ?? 0, 'tým', 'týmy', 'týmů')}</Text>
                        <Pressable style={s.iconMini} onPress={() => setSheet({ kind: 'conference', id: konf.id, leagueId: liga.id, name: konf.name })}>
                          <Ionicons name="create-outline" size={15} color={Colors.mu} />
                        </Pressable>
                        <Pressable style={s.iconMini} onPress={() => smaz('conference', konf.id, konf.name)}>
                          <Ionicons name="trash-outline" size={15} color={Colors.red} />
                        </Pressable>
                      </View>

                      {konf.divisions.map(div => (
                        <View key={div.id} style={s.divRow}>
                          <Ionicons name="grid-outline" size={12} color={Colors.mu} />
                          <Text style={s.divName}>{div.name}</Text>
                          <Text style={s.subCount}>{plural(div.teamCount ?? 0, 'tým', 'týmy', 'týmů')}</Text>
                          <Pressable style={s.iconMini} onPress={() => setSheet({ kind: 'division', id: div.id, conferenceId: konf.id, name: div.name })}>
                            <Ionicons name="create-outline" size={15} color={Colors.mu} />
                          </Pressable>
                          <Pressable style={s.iconMini} onPress={() => smaz('division', div.id, div.name)}>
                            <Ionicons name="trash-outline" size={15} color={Colors.red} />
                          </Pressable>
                        </View>
                      ))}

                      {konf.divisions.length < MAX_DIVIZI && (
                        <Pressable style={s.addRow} onPress={() => setSheet({ kind: 'division', conferenceId: konf.id, name: '' })}>
                          <Ionicons name="add" size={14} color={Colors.go} />
                          <Text style={s.addTxt}>Přidat divizi</Text>
                        </Pressable>
                      )}

                      {/* Týmy přímo v konferenci (bez divize) */}
                      {teamyV(p => p.conferenceId === konf.id && !p.divisionId).map(t => (
                        <Text key={t.id} style={s.teamHint}>· {t.name} (bez divize)</Text>
                      ))}
                    </View>
                  ))}

                  {liga.conferences.length < MAX_KONFERENCI && (
                    <Pressable style={s.addRow} onPress={() => setSheet({ kind: 'conference', leagueId: liga.id, name: '' })}>
                      <Ionicons name="add" size={14} color={Colors.go} />
                      <Text style={s.addTxt}>Přidat konferenci</Text>
                    </Pressable>
                  )}

                  {/* Týmy přímo v lize */}
                  {teamyV(p => p.leagueId === liga.id && !p.conferenceId).length > 0 && (
                    <View style={s.konfBlock}>
                      <Text style={s.plainLabel}>Bez konference</Text>
                      {teamyV(p => p.leagueId === liga.id && !p.conferenceId).map(t => (
                        <Text key={t.id} style={s.teamHint}>· {t.name}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {tree.length < MAX_LIG && (
          <Pressable style={s.primaryBtn} onPress={() => setSheet({ kind: 'league', name: '', level: String(tree.length + 1) })}>
            <Ionicons name="add" size={18} color={Colors.bg} />
            <Text style={s.primaryTxt}>Přidat ligu</Text>
          </Pressable>
        )}
        {tree.length >= MAX_LIG && (
          <Text style={s.limitTxt}>Dosažen limit {MAX_LIG} lig v sezóně.</Text>
        )}

        {/* ── Zařazení týmů ─────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>Zařazení týmů</Text>
        {nezarazene.length > 0 && (
          <View style={s.warnBox}>
            <Ionicons name="alert-circle-outline" size={16} color={Colors.red} />
            <Text style={s.warnTxt}>
              {plural(nezarazene.length, 'tým nemá', 'týmy nemají', 'týmů nemá')} zařazení v této sezóně — nebude
              se {nezarazene.length === 1 ? 'objevovat' : 'objevovat'} v rozlosování ani ve filtrech statistik.
            </Text>
          </View>
        )}

        {teams.map(t => {
          const p = t.placement;
          const cesta = p
            ? [p.league?.name, p.conference?.name, p.division?.name].filter(Boolean).join(' › ')
            : 'Nezařazeno';
          return (
            <Pressable key={t.id} style={s.teamRow} onPress={() => otevriZarazeni(t)}>
              <View style={[s.dot, { backgroundColor: t.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.teamName} numberOfLines={1}>{t.name}</Text>
                <Text style={[s.teamPath, !p && { color: Colors.red }]} numberOfLines={1}>{cesta}</Text>
              </View>
              <Text style={s.teamAbbr}>{t.abbr}</Text>
              <Ionicons name="swap-horizontal-outline" size={17} color={Colors.go} />
            </Pressable>
          );
        })}
        {teams.length === 0 && <Text style={s.noData}>Zatím žádné týmy.</Text>}
      </ScrollView>

      {/* ══ SHEET: název ligy / konference / divize ═══════════════════════ */}
      <Modal visible={!!sheet && sheet.kind !== 'placement'} transparent animationType="slide">
        <Pressable style={s.backdrop} onPress={() => setSheet(null)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          {sheet && sheet.kind !== 'placement' && (
            <>
              <Text style={s.sheetTitle}>
                {sheet.id ? 'Přejmenovat' : 'Nová'}{' '}
                {sheet.kind === 'league' ? 'liga' : sheet.kind === 'conference' ? 'konference' : 'divize'}
              </Text>

              <Text style={s.fieldLabel}>Název</Text>
              <TextInput
                style={s.input}
                value={sheet.name}
                onChangeText={v => setSheet({ ...sheet, name: v } as Sheet)}
                placeholder={sheet.kind === 'league' ? 'FSL Liga A' : sheet.kind === 'conference' ? 'Východ' : 'Divize Sever'}
                placeholderTextColor={Colors.di}
                keyboardAppearance="dark"
                autoFocus
              />

              {sheet.kind === 'league' && (
                <>
                  <Text style={s.fieldLabel}>Úroveň</Text>
                  <TextInput
                    style={s.input}
                    value={sheet.level}
                    onChangeText={v => setSheet({ ...sheet, level: v.replace(/\D/g, '') } as Sheet)}
                    placeholder="1"
                    placeholderTextColor={Colors.di}
                    keyboardType="number-pad"
                    keyboardAppearance="dark"
                  />
                  <Text style={s.hint}>1 = nejvyšší soutěž. Podle úrovně se ligy řadí ve filtrech.</Text>
                </>
              )}

              <Pressable style={[s.primaryBtn, busy && { opacity: 0.6 }]} onPress={ulozSheet} disabled={busy}>
                {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.primaryTxt}>Uložit</Text>}
              </Pressable>
              <Pressable style={s.secondaryBtn} onPress={() => setSheet(null)}>
                <Text style={s.secondaryTxt}>Zrušit</Text>
              </Pressable>
            </>
          )}
        </View>
      </Modal>

      {/* ══ SHEET: zařazení týmu ═════════════════════════════════════════ */}
      <Modal visible={!!sheet && sheet.kind === 'placement'} transparent animationType="slide">
        <Pressable style={s.backdrop} onPress={() => setSheet(null)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          {sheet && sheet.kind === 'placement' && (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
              <Text style={s.sheetTitle}>Zařadit tým</Text>
              <View style={s.teamBadge}>
                <View style={[s.dot, { backgroundColor: sheet.team.color }]} />
                <Text style={s.teamName}>{sheet.team.name}</Text>
              </View>

              <Text style={s.fieldLabel}>Liga</Text>
              {tree.map(l => (
                <Pressable
                  key={l.id}
                  style={[s.pick, selLeague === l.id && s.pickActive]}
                  onPress={() => { setSelLeague(l.id); setSelConf(null); setSelDiv(null); }}
                >
                  <Text style={[s.pickTxt, selLeague === l.id && s.pickTxtActive]}>{l.name}</Text>
                  <Text style={[s.pickMeta, selLeague === l.id && { color: `${Colors.bg}99` }]}>úroveň {l.level}</Text>
                </Pressable>
              ))}
              <Pressable
                style={[s.pick, !selLeague && s.pickActive]}
                onPress={() => { setSelLeague(null); setSelConf(null); setSelDiv(null); }}
              >
                <Text style={[s.pickTxt, !selLeague && s.pickTxtActive]}>Mimo soutěž</Text>
              </Pressable>

              {sheetLiga && sheetLiga.conferences.length > 0 && (
                <>
                  <Text style={s.fieldLabel}>Konference</Text>
                  {sheetLiga.conferences.map(k => (
                    <Pressable
                      key={k.id}
                      style={[s.pick, selConf === k.id && s.pickActive]}
                      onPress={() => { setSelConf(k.id); setSelDiv(null); }}
                    >
                      <Text style={[s.pickTxt, selConf === k.id && s.pickTxtActive]}>{k.name}</Text>
                    </Pressable>
                  ))}
                  <Pressable style={[s.pick, !selConf && s.pickActive]} onPress={() => { setSelConf(null); setSelDiv(null); }}>
                    <Text style={[s.pickTxt, !selConf && s.pickTxtActive]}>Bez konference</Text>
                  </Pressable>
                </>
              )}

              {sheetKonf && sheetKonf.divisions.length > 0 && (
                <>
                  <Text style={s.fieldLabel}>Divize</Text>
                  {sheetKonf.divisions.map(d => (
                    <Pressable key={d.id} style={[s.pick, selDiv === d.id && s.pickActive]} onPress={() => setSelDiv(d.id)}>
                      <Text style={[s.pickTxt, selDiv === d.id && s.pickTxtActive]}>{d.name}</Text>
                    </Pressable>
                  ))}
                  <Pressable style={[s.pick, !selDiv && s.pickActive]} onPress={() => setSelDiv(null)}>
                    <Text style={[s.pickTxt, !selDiv && s.pickTxtActive]}>Bez divize</Text>
                  </Pressable>
                </>
              )}

              <Pressable style={[s.primaryBtn, busy && { opacity: 0.6 }]} onPress={ulozZarazeni} disabled={busy}>
                {busy ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.primaryTxt}>Uložit zařazení</Text>}
              </Pressable>
              <Pressable style={s.secondaryBtn} onPress={() => setSheet(null)}>
                <Text style={s.secondaryTxt}>Zrušit</Text>
              </Pressable>
              <View style={{ height: 20 }} />
            </ScrollView>
          )}
        </View>
      </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center' },
  title:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },

  chip:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd },
  chipActive:   { backgroundColor: Colors.go, borderColor: Colors.go },
  chipTxt:      { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },
  chipTxtActive:{ color: Colors.bg },

  introBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, marginBottom: 16 },
  introTxt: { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 17 },

  ligaCard: { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, marginBottom: 12, overflow: 'hidden' },
  ligaHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  levelBadge:{ width: 26, height: 26, borderRadius: 13, backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center' },
  levelTxt: { fontSize: Fonts.sizes.xs, fontWeight: '900', color: Colors.go },
  ligaName: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.wh },
  ligaMeta: { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 1 },
  ligaBody: { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: Colors.bd, paddingTop: 10 },
  iconMini: { padding: 6 },

  konfBlock:  { backgroundColor: Colors.c2, borderRadius: Radius.sm, padding: 10, marginBottom: 8 },
  konfHead:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  konfName:   { flex: 1, fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.go },
  plainLabel: { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', marginBottom: 4 },
  divRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingTop: 8 },
  divName:    { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  subCount:   { fontSize: Fonts.sizes.xs, color: Colors.mu },
  teamHint:   { fontSize: Fonts.sizes.xs, color: Colors.di, paddingLeft: 14, paddingTop: 4 },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingLeft: 14 },
  addTxt: { fontSize: Fonts.sizes.xs, color: Colors.go, fontWeight: '700' },

  sectionTitle: { fontSize: Fonts.sizes.md, fontWeight: '800', color: Colors.wh, marginTop: 28, marginBottom: 12 },
  warnBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: `${Colors.red}18`, borderWidth: 1, borderColor: `${Colors.red}44`, borderRadius: Radius.md, padding: 12, marginBottom: 12 },
  warnTxt: { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.red, lineHeight: 17 },

  teamRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.sm, padding: 12, marginBottom: 6 },
  dot:      { width: 10, height: 10, borderRadius: 5 },
  teamName: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  teamPath: { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 1 },
  teamAbbr: { fontSize: Fonts.sizes.xs, color: Colors.di, fontWeight: '700' },
  noData:   { fontSize: Fonts.sizes.sm, color: Colors.di, textAlign: 'center', paddingVertical: 12 },
  limitTxt: { fontSize: Fonts.sizes.xs, color: Colors.di, textAlign: 'center', marginTop: 14 },

  emptyBox:   { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  emptyDesc:  { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center' },

  primaryBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.go, borderRadius: Radius.md, padding: 15, marginTop: 16 },
  primaryTxt:   { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  secondaryBtn: { borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 13, alignItems: 'center', marginTop: 8 },
  secondaryTxt: { fontSize: Fonts.sizes.md, color: Colors.mu, fontWeight: '600' },

  backdrop:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:      { backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, marginTop: 'auto' },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.bd, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 14 },
  teamBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.c2, borderRadius: Radius.sm, padding: 10 },
  fieldLabel: { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 16, marginBottom: 6 },
  input:      { backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh },
  hint:       { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 6, lineHeight: 16 },

  pick:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd, marginBottom: 6 },
  pickActive:   { backgroundColor: Colors.go, borderColor: Colors.go },
  pickTxt:      { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600' },
  pickTxtActive:{ color: Colors.bg },
  pickMeta:     { fontSize: Fonts.sizes.xs, color: Colors.mu },
});
