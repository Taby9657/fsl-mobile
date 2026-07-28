import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { goBack } from '../utils/navigation';
import { searchApi, playersApi } from '../services/api';
import { Colors, Fonts, Radius } from '../constants/colors';

const POS: Record<string, string> = { GK: 'Brankář', F: 'Útočník', D: 'Obránce' };

interface PlayerStats {
  id: string;
  firstName: string;
  lastName: string;
  jersey: number;
  position: string;
  team?: { name: string; color?: string };
  goals?: any[];
  assists?: any[];
  mvpVotes?: any[];
  licensed?: boolean;
}

function PlayerPicker({
  slot,
  player,
  onSelect,
  onClear,
}: {
  slot: 1 | 2;
  player: PlayerStats | null;
  onSelect: (p: PlayerStats) => void;
  onClear: () => void;
}) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen]       = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(text: string) {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchApi.search(text);
        setResults(r.data.players ?? []);
        setOpen(true);
      } catch {}
    }, 300);
  }

  if (player) {
    const color = player.team?.color ?? Colors.go;
    return (
      <View style={ps.selectedCard}>
        <View style={[ps.avatar, { borderColor: color }]}>
          <Text style={[ps.avatarNum, { color }]}>{player.jersey}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ps.name}>{player.firstName} {player.lastName}</Text>
          <Text style={ps.sub}>{player.team?.name ?? '—'}  ·  {POS[player.position] ?? player.position}</Text>
        </View>
        <Pressable onPress={onClear} style={ps.clearBtn}>
          <Ionicons name="close-circle" size={20} color={Colors.mu} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={ps.pickerWrap}>
      <View style={ps.inputRow}>
        <Ionicons name="search" size={16} color={Colors.mu} style={{ marginLeft: 12 }} />
        <TextInput
          style={ps.input}
          placeholder={`Hráč ${slot}`}
          placeholderTextColor={Colors.di}
          value={query}
          onChangeText={handleChange}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setResults([]); setOpen(false); }} style={{ padding: 10 }}>
            <Ionicons name="close-circle" size={16} color={Colors.mu} />
          </Pressable>
        )}
      </View>
      {open && results.length > 0 && (
        <View style={ps.dropdown}>
          {results.slice(0, 6).map((p: any) => (
            <Pressable key={p.id} style={ps.dropItem} onPress={() => {
              setOpen(false); setQuery(''); setResults([]);
              onSelect(p);
            }}>
              <View style={[ps.dropDot, { backgroundColor: p.team?.color ?? Colors.go }]} />
              <View style={{ flex: 1 }}>
                <Text style={ps.dropName}>{p.firstName} {p.lastName}</Text>
                <Text style={ps.dropSub}>#{p.jersey}  ·  {p.team?.name ?? '—'}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const ps = StyleSheet.create({
  pickerWrap:  { flex: 1, position: 'relative', zIndex: 10 },
  inputRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.c2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd },
  input:       { flex: 1, padding: 12, color: Colors.wh, fontSize: Fonts.sizes.sm },
  dropdown:    { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, zIndex: 20, marginTop: 4 },
  dropItem:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.bd },
  dropDot:     { width: 8, height: 8, borderRadius: 4 },
  dropName:    { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  dropSub:     { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 1 },
  selectedCard:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 12 },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.c2, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  avatarNum:   { fontSize: Fonts.sizes.md, fontWeight: '900' },
  name:        { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  sub:         { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  clearBtn:    { padding: 4 },
});

// ── STAT ROW ────────────────────────────────────────────────────────────────

function StatRow({ label, v1, v2 }: { label: string; v1: number; v2: number }) {
  const max = Math.max(v1, v2, 1);
  const w1 = v1 / max;
  const w2 = v2 / max;
  const col1 = v1 > v2 ? Colors.go : v1 === v2 ? Colors.mu : Colors.di;
  const col2 = v2 > v1 ? Colors.go : v1 === v2 ? Colors.mu : Colors.di;

  return (
    <View style={r.row}>
      {/* Hodnota hráče 1 */}
      <Text style={[r.val, { color: col1, textAlign: 'right' }]}>{v1}</Text>

      {/* Bary */}
      <View style={r.bars}>
        <View style={r.bar1Wrap}>
          <View style={[r.bar, { width: `${w1 * 100}%`, backgroundColor: col1, alignSelf: 'flex-end' }]} />
        </View>
        <Text style={r.label}>{label}</Text>
        <View style={r.bar2Wrap}>
          <View style={[r.bar, { width: `${w2 * 100}%`, backgroundColor: col2, alignSelf: 'flex-start' }]} />
        </View>
      </View>

      {/* Hodnota hráče 2 */}
      <Text style={[r.val, { color: col2 }]}>{v2}</Text>
    </View>
  );
}

const r = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  val:     { width: 28, fontSize: Fonts.sizes.md, fontWeight: '700' },
  bars:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bar1Wrap:{ flex: 1 },
  bar2Wrap:{ flex: 1 },
  bar:     { height: 6, borderRadius: 3 },
  label:   { width: 60, fontSize: 10, color: Colors.mu, textAlign: 'center', fontWeight: '600', textTransform: 'uppercase' },
});

// ── MAIN SCREEN ─────────────────────────────────────────────────────────────

export default function CompareScreen() {
  const [player1, setPlayer1] = useState<PlayerStats | null>(null);
  const [player2, setPlayer2] = useState<PlayerStats | null>(null);
  const [detail1, setDetail1] = useState<PlayerStats | null>(null);
  const [detail2, setDetail2] = useState<PlayerStats | null>(null);

  useEffect(() => {
    if (!player1) { setDetail1(null); return; }
    playersApi.get(player1.id).then(r => setDetail1(r.data)).catch(() => {});
  }, [player1?.id]);

  useEffect(() => {
    if (!player2) { setDetail2(null); return; }
    playersApi.get(player2.id).then(r => setDetail2(r.data)).catch(() => {});
  }, [player2?.id]);

  const d1 = detail1 ?? player1;
  const d2 = detail2 ?? player2;

  const goals1   = d1?.goals?.length   ?? 0;
  const goals2   = d2?.goals?.length   ?? 0;
  const assists1 = d1?.assists?.length  ?? 0;
  const assists2 = d2?.assists?.length  ?? 0;
  const mvp1     = d1?.mvpVotes?.length ?? 0;
  const mvp2     = d2?.mvpVotes?.length ?? 0;

  const ready = !!(player1 && player2 && (detail1 || d1) && (detail2 || d2));

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Porovnání hráčů</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {/* Výběr hráčů */}
        <View style={s.pickerRow}>
          <PlayerPicker
            slot={1}
            player={player1}
            onSelect={setPlayer1}
            onClear={() => { setPlayer1(null); setDetail1(null); }}
          />
          <View style={s.vs}><Text style={s.vsTxt}>vs</Text></View>
          <PlayerPicker
            slot={2}
            player={player2}
            onSelect={setPlayer2}
            onClear={() => { setPlayer2(null); setDetail2(null); }}
          />
        </View>

        {/* Záhlaví se jmény */}
        {ready && (
          <View style={s.nameRow}>
            <Text style={s.nameLeft} numberOfLines={1}>{d1!.firstName} {d1!.lastName}</Text>
            <Text style={s.nameRight} numberOfLines={1}>{d2!.firstName} {d2!.lastName}</Text>
          </View>
        )}

        {/* Statistiky */}
        {ready ? (
          <View style={s.statsCard}>
            <StatRow label="Góly"   v1={goals1}   v2={goals2} />
            <StatRow label="Asist." v1={assists1} v2={assists2} />
            <StatRow label="Body"   v1={goals1 + assists1} v2={goals2 + assists2} />
            <StatRow label="MVP"    v1={mvp1}     v2={mvp2} />
          </View>
        ) : (
          <View style={s.emptyState}>
            <Ionicons name="people-outline" size={40} color={Colors.di} />
            <Text style={s.emptyTxt}>Vyber dva hráče pro porovnání</Text>
          </View>
        )}

        {/* Detaily (pozice, tým, licence) */}
        {ready && (
          <View style={s.infoRow}>
            {/* Hráč 1 */}
            <View style={s.infoCard}>
              <View style={[s.infoDot, { backgroundColor: d1!.team?.color ?? Colors.go }]} />
              <Text style={s.infoTeam}>{d1!.team?.name ?? '—'}</Text>
              <Text style={s.infoPos}>{POS[d1!.position] ?? d1!.position}</Text>
              <View style={[s.licBadge, { borderColor: d1!.licensed ? Colors.green : '#F59E0B' }]}>
                <Text style={[s.licTxt, { color: d1!.licensed ? Colors.green : '#F59E0B' }]}>
                  {d1!.licensed ? 'Licencován' : 'Bez licence'}
                </Text>
              </View>
            </View>

            <View style={s.infoSep} />

            {/* Hráč 2 */}
            <View style={[s.infoCard, { alignItems: 'flex-end' }]}>
              <View style={[s.infoDot, { backgroundColor: d2!.team?.color ?? Colors.go }]} />
              <Text style={s.infoTeam}>{d2!.team?.name ?? '—'}</Text>
              <Text style={s.infoPos}>{POS[d2!.position] ?? d2!.position}</Text>
              <View style={[s.licBadge, { borderColor: d2!.licensed ? Colors.green : '#F59E0B' }]}>
                <Text style={[s.licTxt, { color: d2!.licensed ? Colors.green : '#F59E0B' }]}>
                  {d2!.licensed ? 'Licencován' : 'Bez licence'}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:   { width: 40, height: 40, justifyContent: 'center' },
  title:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },

  pickerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginBottom: 8 },
  vs:        { paddingTop: 14 },
  vsTxt:     { fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '700' },

  nameRow:   { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 4 },
  nameLeft:  { flex: 1, fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.go },
  nameRight: { flex: 1, fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.go, textAlign: 'right' },

  statsCard: { margin: 16, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt:   { fontSize: Fonts.sizes.sm, color: Colors.mu },

  infoRow:  { flexDirection: 'row', marginHorizontal: 16, gap: 12 },
  infoCard: { flex: 1, gap: 6 },
  infoSep:  { width: 1, backgroundColor: Colors.bd },
  infoDot:  { width: 10, height: 10, borderRadius: 5 },
  infoTeam: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  infoPos:  { fontSize: Fonts.sizes.xs, color: Colors.mu },
  licBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  licTxt:   { fontSize: 10, fontWeight: '700' },
});
