// Výběr barvy dresu – sdílený registrací týmu i supervisorskou správou
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/colors';

/**
 * Barvy jsou vybrané tak, aby šly rozeznat na tmavém pozadí aplikace
 * i vedle sebe v tabulce, a aby odpovídaly tomu, co se reálně nosí na hřišti.
 * Název u každé barvy pomáhá při domluvě „hrajeme v modrých".
 */
export const TEAM_COLORS: { hex: string; name: string }[] = [
  { hex: '#C9A140', name: 'Zlatá'     },
  { hex: '#E53935', name: 'Červená'   },
  { hex: '#1E88E5', name: 'Modrá'     },
  { hex: '#43A047', name: 'Zelená'    },
  { hex: '#8B5CF6', name: 'Fialová'   },
  { hex: '#FB8C00', name: 'Oranžová'  },
  { hex: '#00ACC1', name: 'Tyrkysová' },
  { hex: '#EC407A', name: 'Růžová'    },
  { hex: '#5C6BC0', name: 'Indigo'    },
  { hex: '#7CB342', name: 'Limetková' },
  { hex: '#8D6E63', name: 'Hnědá'     },
  { hex: '#F5F5F5', name: 'Bílá'      },
];

interface Props {
  value: string;
  onChange: (hex: string) => void;
  /** Zkratka do náhledu dresu; když chybí, náhled se nezobrazí. */
  abbr?: string;
}

export function TeamColorPicker({ value, onChange, abbr }: Props) {
  const vybrana = TEAM_COLORS.find(c => c.hex.toLowerCase() === value?.toLowerCase());

  return (
    <View>
      <View style={s.head}>
        <Text style={s.label}>Barva dresu</Text>
        <Text style={s.selected}>{vybrana?.name ?? 'Vlastní'}</Text>
      </View>

      <View style={s.grid}>
        {TEAM_COLORS.map(c => {
          const active = c.hex.toLowerCase() === value?.toLowerCase();
          // Bílá potřebuje tmavou fajfku, ostatní světlou
          const tick = c.hex === '#F5F5F5' ? Colors.bg : '#FFFFFF';
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
                  {active && <Ionicons name="checkmark" size={18} color={tick} />}
                </View>
              </View>
              <Text style={[s.name, active && s.nameActive]} numberOfLines={1}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>

      {abbr !== undefined && (
        <View style={s.preview}>
          <View style={[s.jersey, { backgroundColor: value, borderColor: value === '#F5F5F5' ? Colors.bd : value }]}>
            <Text style={[s.jerseyTxt, { color: value === '#F5F5F5' ? Colors.bg : '#FFFFFF' }]}>
              {abbr || 'TM'}
            </Text>
          </View>
          <Text style={s.previewTxt}>Takhle uvidí tvůj tým ostatní v tabulce a u zápasů.</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  head:      { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 },
  label:     { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  selected:  { fontSize: Fonts.sizes.xs, color: Colors.go, fontWeight: '700' },
  grid:      { flexDirection: 'row', flexWrap: 'wrap' },
  cell:      { width: '25%', alignItems: 'center', marginBottom: 14, gap: 5 },
  ring:      { width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  ringActive:{ borderColor: Colors.wh },
  dot:       { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  name:      { fontSize: 10, color: Colors.di },
  nameActive:{ color: Colors.wh, fontWeight: '700' },
  preview:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2, padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  jersey:    { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  jerseyTxt: { fontSize: Fonts.sizes.sm, fontWeight: '900' },
  previewTxt:{ flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 17 },
});
