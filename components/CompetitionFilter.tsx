/**
 * Kaskádový filtr soutěže: sezóna → liga → konference → divize.
 *
 * Zobrazuje jen ty úrovně, které v dané sezóně opravdu existují — dokud je
 * v lize jediná soutěž bez konferencí, uživatel žádný přepínač navíc nevidí.
 * Volajícímu vrací rovnou `StatsScope`, který jde poslat do statsApi.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { leaguesApi, statsApi, type LeagueNode, type StatsScope } from '../services/api';
import { Colors, Fonts, Radius } from '../constants/colors';

interface Props {
  onChange: (scope: StatsScope) => void;
  /** Zabalí filtr do skládacího panelu — hodí se, když je nad ním ještě záložková lišta. */
  collapsible?: boolean;
}

interface Chip { id: string | null; label: string; count?: number }

function ChipRow({ items, value, onSelect }: {
  items: Chip[]; value: string | null; onSelect: (id: string | null) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 6, paddingVertical: 4 }}>
      {items.map(it => {
        const act = value === it.id;
        return (
          <Pressable key={it.id ?? '__all__'} style={[s.chip, act && s.chipActive]} onPress={() => onSelect(it.id)}>
            <Text style={[s.chipTxt, act && s.chipTxtActive]}>{it.label}</Text>
            {typeof it.count === 'number' && it.count > 0 && (
              <Text style={[s.chipCount, act && s.chipCountActive]}>{it.count}</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function CompetitionFilter({ onChange, collapsible = false }: Props) {
  const [seasons, setSeasons] = useState<string[]>([]);
  const [season,  setSeason]  = useState<string | undefined>(undefined);
  const [tree,    setTree]    = useState<LeagueNode[]>([]);
  const [ligaId,  setLigaId]  = useState<string | null>(null);
  const [konfId,  setKonfId]  = useState<string | null>(null);
  const [divId,   setDivId]   = useState<string | null>(null);
  const [rozbaleno, setRozbaleno] = useState(!collapsible);

  useEffect(() => {
    statsApi.seasons()
      .then(r => {
        const ss: string[] = r.data ?? [];
        setSeasons(ss);
        if (ss.length > 0) setSeason(ss[0]);
      })
      .catch(() => {});
  }, []);

  // Strom se načítá pro zvolenou sezónu; při změně sezóny výběr resetujeme
  useEffect(() => {
    leaguesApi.tree(season)
      .then(r => setTree(r.data.leagues ?? []))
      .catch(() => setTree([]));
    setLigaId(null); setKonfId(null); setDivId(null);
  }, [season]);

  // S jedinou ligou nemá smysl nabízet výběr — vybereme ji za uživatele
  useEffect(() => {
    if (tree.length === 1 && ligaId === null) setLigaId(tree[0].id);
  }, [tree]);

  const liga = useMemo(() => tree.find(l => l.id === ligaId) ?? null, [tree, ligaId]);
  const konf = useMemo(() => liga?.conferences.find(k => k.id === konfId) ?? null, [liga, konfId]);

  // Scope hlásíme nahoru při každé změně výběru
  useEffect(() => {
    onChange({
      season,
      ...(divId  ? { divisionId: divId }   : {}),
      ...(konfId ? { conferenceId: konfId } : {}),
      ...(ligaId ? { leagueId: ligaId }     : {}),
    });
  }, [season, ligaId, konfId, divId]);

  // Souhrn aktivního výběru do hlavičky skládacího panelu
  const popis = [
    season,
    liga?.name,
    konf?.name,
    konf?.divisions.find(d => d.id === divId)?.name,
  ].filter(Boolean).join(' › ') || 'Vše';

  const maVicLig     = tree.length > 1;
  const maKonference = !!liga && liga.conferences.length > 0;
  const maDivize     = !!konf && konf.divisions.length > 0;

  // Jediná liga bez konferencí a jediná sezóna = není z čeho vybírat
  if (seasons.length <= 1 && (tree.length === 0 || (tree.length === 1 && tree[0].conferences.length === 0))) {
    return null;
  }

  return (
    <View style={s.wrap}>
      {collapsible && (
        <Pressable style={s.summary} onPress={() => setRozbaleno(v => !v)}>
          <Ionicons name="funnel-outline" size={14} color={Colors.go} />
          <Text style={s.summaryTxt} numberOfLines={1}>{popis}</Text>
          <Ionicons name={rozbaleno ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.di} />
        </Pressable>
      )}

      {rozbaleno && (
        <>
          {seasons.length > 1 && (
            <>
              <Text style={s.label}>Sezóna</Text>
              <ChipRow
                items={seasons.map(sz => ({ id: sz, label: sz }))}
                value={season ?? null}
                onSelect={id => setSeason(id ?? undefined)}
              />
            </>
          )}

          {maVicLig && (
            <>
              <Text style={s.label}>Liga</Text>
              <ChipRow
                items={[
                  { id: null, label: 'Všechny' },
                  ...tree.map(l => ({ id: l.id, label: l.name, count: l.teamCount })),
                ]}
                value={ligaId}
                onSelect={id => { setLigaId(id); setKonfId(null); setDivId(null); }}
              />
            </>
          )}

          {maKonference && (
            <>
              <Text style={s.label}>Konference</Text>
              <ChipRow
                items={[
                  { id: null, label: 'Celá liga' },
                  ...liga!.conferences.map(k => ({ id: k.id, label: k.name, count: k.teamCount })),
                ]}
                value={konfId}
                onSelect={id => { setKonfId(id); setDivId(null); }}
              />
            </>
          )}

          {maDivize && (
            <>
              <Text style={s.label}>Divize</Text>
              <ChipRow
                items={[
                  { id: null, label: 'Celá konference' },
                  ...konf!.divisions.map(d => ({ id: d.id, label: d.name, count: d.teamCount })),
                ]}
                value={divId}
                onSelect={setDivId}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap:    { borderTopWidth: 1, borderTopColor: Colors.bd, paddingBottom: 6 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  summaryTxt: { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.wh, fontWeight: '600' },
  label:   { fontSize: 10, color: Colors.di, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 8 },

  chip:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  chipActive:    { backgroundColor: Colors.go, borderColor: Colors.go },
  chipTxt:       { fontSize: Fonts.sizes.xs, lineHeight: 16, color: Colors.mu, fontWeight: '600' },
  chipTxtActive: { color: Colors.bg },
  chipCount:     { fontSize: 10, lineHeight: 14, color: Colors.di, fontWeight: '700' },
  chipCountActive: { color: `${Colors.bg}AA` },
});
