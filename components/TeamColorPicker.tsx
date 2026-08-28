// Výběr dresů týmu – primární a volitelná sekundární sada
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/colors';

/**
 * Barvy jsou volené tak, aby se daly rozeznat na tmavém pozadí aplikace
 * i mezi sebou navzájem. Název pomáhá při domluvě „hrajeme v modrých".
 */
export const TEAM_COLORS: { hex: string; name: string }[] = [
  { hex: '#F5F5F5', name: 'Bílá'      },
  { hex: '#C9A140', name: 'Zlatá'     },
  { hex: '#E53935', name: 'Červená'   },
  { hex: '#1E88E5', name: 'Modrá'     },
  { hex: '#43A047', name: 'Zelená'    },
  { hex: '#8B5CF6', name: 'Fialová'   },
  { hex: '#FB8C00', name: 'Oranžová'  },
  { hex: '#00ACC1', name: 'Tyrkysová' },
  { hex: '#EC407A', name: 'Růžová'    },
  { hex: '#5C6BC0', name: 'Indigo'    },
  { hex: '#8D6E63', name: 'Hnědá'     },
  { hex: '#1C1C1E', name: 'Černá'     },
];

const SVETLE = ['#F5F5F5'];

function tickColor(hex: string) {
  return SVETLE.includes(hex) ? Colors.bg : '#FFFFFF';
}

function Jersey({ hex, abbr, popis }: { hex: string; abbr?: string; popis: string }) {
  return (
    <View style={s.jerseyWrap}>
      <View style={[s.jersey, { backgroundColor: hex, borderColor: SVETLE.includes(hex) ? Colors.bd : hex }]}>
        <Text style={[s.jerseyTxt, { color: tickColor(hex) }]}>{abbr || 'TM'}</Text>
      </View>
      <Text style={s.jerseyPopis}>{popis}</Text>
    </View>
  );
}

function Paleta({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  return (
    <View style={s.grid}>
      {TEAM_COLORS.map(c => {
        const active = c.hex.toLowerCase() === value?.toLowerCase();
        return (
          <Pressable
            key={c.hex}
            onPress={() => onChange(c.hex)}
            style={s.cell}
            accessibilityRole="button"
            accessibilityLabel={c.name}
            accessibilityState={{ selected: active }}
          >
            <View style={[s.ring, active && s.ringActive]}>
              <View style={[s.dot, { backgroundColor: c.hex }]}>
                {active && <Ionicons name="checkmark" size={17} color={tickColor(c.hex)} />}
              </View>
            </View>
            <Text style={[s.name, active && s.nameActive]} numberOfLines={1}>{c.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface Props {
  /** Primární sada – povinná. */
  primary: string;
  onPrimary: (hex: string) => void;
  /** Sekundární sada – null znamená, že tým hraje pořád ve stejném. */
  secondary: string | null;
  onSecondary: (hex: string | null) => void;
  /** Zkratka do náhledu dresu. */
  abbr?: string;
}

export function TeamColorPicker({ primary, onPrimary, secondary, onSecondary, abbr }: Props) {
  const dveSady = secondary !== null;

  function prepniSady(zapnuto: boolean) {
    if (!zapnuto) { onSecondary(null); return; }
    // Výchozí sekundární je bílá; když už je primární bílá, tak černá.
    onSecondary(primary.toLowerCase() === '#f5f5f5' ? '#1C1C1E' : '#F5F5F5');
  }

  const primaryName = TEAM_COLORS.find(c => c.hex.toLowerCase() === primary?.toLowerCase())?.name ?? 'Vlastní';
  const secondaryName = secondary
    ? (TEAM_COLORS.find(c => c.hex.toLowerCase() === secondary.toLowerCase())?.name ?? 'Vlastní')
    : null;

  return (
    <View>
      {/* Náhled obou sad */}
      <View style={s.preview}>
        <Jersey hex={primary} abbr={abbr} popis="Primární" />
        {dveSady
          ? <Jersey hex={secondary!} abbr={abbr} popis="Sekundární" />
          : (
            <View style={s.jerseyWrap}>
              <View style={[s.jersey, s.jerseyPrazdny]}>
                <Ionicons name="remove" size={20} color={Colors.di} />
              </View>
              <Text style={s.jerseyPopis}>Bez druhé</Text>
            </View>
          )}
        <Text style={s.previewTxt}>
          Když se barvy soupeřů kryjí, převleče se do sekundární sady tým uvedený jako hostující.
        </Text>
      </View>

      {/* Primární sada */}
      <View style={s.head}>
        <Text style={s.label}>Primární dres</Text>
        <Text style={s.selected}>{primaryName}</Text>
      </View>
      <Paleta value={primary} onChange={onPrimary} />

      {/* Přepínač druhé sady */}
      <View style={s.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.switchLabel}>Máme i sekundární sadu</Text>
          <Text style={s.switchDesc}>Nepovinné. Vypni, pokud tým hraje pořád ve stejných dresech.</Text>
        </View>
        <Switch
          value={dveSady}
          onValueChange={prepniSady}
          trackColor={{ false: Colors.c2, true: `${Colors.go}88` }}
          thumbColor={dveSady ? Colors.go : Colors.mu}
        />
      </View>

      {/* Sekundární sada */}
      {dveSady && (
        <>
          <View style={s.head}>
            <Text style={s.label}>Sekundární dres</Text>
            <Text style={s.selected}>{secondaryName}</Text>
          </View>
          <Paleta value={secondary!} onChange={onSecondary} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  head:        { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 },
  label:       { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  selected:    { fontSize: Fonts.sizes.xs, color: Colors.go, fontWeight: '700' },
  grid:        { flexDirection: 'row', flexWrap: 'wrap' },
  cell:        { width: '25%', alignItems: 'center', marginBottom: 12, gap: 4 },
  ring:        { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  ringActive:  { borderColor: Colors.wh },
  dot:         { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  name:        { fontSize: 10, color: Colors.di },
  nameActive:  { color: Colors.wh, fontWeight: '700' },

  preview:     { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1, marginBottom: 18 },
  jerseyWrap:  { alignItems: 'center', gap: 5 },
  jersey:      { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  jerseyPrazdny:{ backgroundColor: 'transparent', borderColor: Colors.bd, borderStyle: 'dashed' },
  jerseyTxt:   { fontSize: Fonts.sizes.xs, fontWeight: '900' },
  jerseyPopis: { fontSize: 10, color: Colors.di },
  previewTxt:  { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 17 },

  switchRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: Colors.bd, marginTop: 2 },
  switchLabel: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  switchDesc:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2, lineHeight: 16 },
});
