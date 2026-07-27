import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/colors';

const MONTHS_CZ = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec',
];

interface Props {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  maxDate?: Date;
  minDate?: Date;
}

function formatDisplay(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function DatePicker({ value, onChange, placeholder = 'Vybrat datum', maxDate, minDate }: Props) {
  const today = new Date();

  const minYear = minDate?.getFullYear() ?? 1940;
  const maxYear = maxDate?.getFullYear() ?? (today.getFullYear() + 5);

  const [open, setOpen]       = useState(false);
  const [selYear,  setSelYear]  = useState(value?.getFullYear()  ?? today.getFullYear());
  const [selMonth, setSelMonth] = useState(value?.getMonth()     ?? today.getMonth());
  const [selDay,   setSelDay]   = useState(value?.getDate()      ?? today.getDate());

  const yearRef  = useRef<ScrollView>(null);
  const dayRef   = useRef<ScrollView>(null);

  // Generování seznamů
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i); // nejnovější první
  const totalDays = daysInMonth(selYear, selMonth);
  const days  = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Pokud byl vybraný den větší než počet dní v novém měsíci, ořízni
  useEffect(() => {
    const max = daysInMonth(selYear, selMonth);
    if (selDay > max) setSelDay(max);
  }, [selYear, selMonth]);

  // Scroll roku na aktuálně vybraný při otevření
  useEffect(() => {
    if (!open) return;
    const idx = years.indexOf(selYear);
    if (idx >= 0) {
      setTimeout(() => yearRef.current?.scrollTo({ x: idx * 64, animated: false }), 50);
    }
    const dayIdx = selDay - 1;
    setTimeout(() => dayRef.current?.scrollTo({ x: dayIdx * 52, animated: false }), 50);
  }, [open]);

  function confirm() {
    const day = Math.min(selDay, daysInMonth(selYear, selMonth));
    const d   = new Date(selYear, selMonth, day);
    // Zkontroluj minDate / maxDate
    if (minDate && d < minDate) return;
    if (maxDate && d > maxDate) return;
    onChange(d);
    setOpen(false);
  }

  function isDateDisabled(year: number, month: number, day: number) {
    const d = new Date(year, month, day);
    if (minDate && d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  }

  return (
    <>
      {/* Trigger pole */}
      <Pressable style={s.field} onPress={() => setOpen(true)}>
        <Ionicons name="calendar-outline" size={16} color={value ? Colors.go : Colors.di} />
        <Text style={[s.fieldText, !value && s.placeholder]}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color={Colors.di} />
      </Pressable>

      {/* Modal */}
      <Modal visible={open} transparent animationType="fade">
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        <View style={s.sheet}>
          <View style={s.handleRow}>
            <View style={s.handle} />
          </View>

          {/* ROK */}
          <Text style={s.sectionLabel}>Rok</Text>
          <ScrollView
            ref={yearRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
          >
            {years.map(y => (
              <Pressable
                key={y}
                style={[s.chip, selYear === y && s.chipSel]}
                onPress={() => setSelYear(y)}
              >
                <Text style={[s.chipTxt, selYear === y && s.chipTxtSel]}>{y}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* MĚSÍC */}
          <Text style={s.sectionLabel}>Měsíc</Text>
          <View style={s.monthGrid}>
            {MONTHS_CZ.map((m, i) => (
              <Pressable
                key={i}
                style={[s.monthChip, selMonth === i && s.chipSel]}
                onPress={() => setSelMonth(i)}
              >
                <Text style={[s.chipTxt, selMonth === i && s.chipTxtSel]}>
                  {m.slice(0, 3)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* DEN */}
          <Text style={s.sectionLabel}>Den</Text>
          <ScrollView
            ref={dayRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.scrollContent}
          >
            {days.map(d => {
              const disabled = isDateDisabled(selYear, selMonth, d);
              return (
                <Pressable
                  key={d}
                  style={[s.dayChip, selDay === d && s.chipSel, disabled && s.chipDisabled]}
                  onPress={() => !disabled && setSelDay(d)}
                >
                  <Text style={[s.chipTxt, selDay === d && s.chipTxtSel, disabled && s.chipTxtDisabled]}>
                    {d}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Potvrzení */}
          <Pressable style={s.confirmBtn} onPress={confirm}>
            <Text style={s.confirmTxt}>
              Potvrdit — {String(selDay).padStart(2, '0')}. {MONTHS_CZ[selMonth].slice(0, 3)}. {selYear}
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  field:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12 },
  fieldText:   { flex: 1, fontSize: Fonts.sizes.md, color: Colors.wh },
  placeholder: { color: Colors.di },

  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 36 },

  handleRow:   { alignItems: 'center', paddingVertical: 12 },
  handle:      { width: 40, height: 4, backgroundColor: Colors.bd, borderRadius: 2 },

  sectionLabel:{ fontSize: 11, color: Colors.mu, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },

  scrollContent: { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },

  chip:        { height: 36, minWidth: 58, paddingHorizontal: 12, borderRadius: 18, backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd, justifyContent: 'center', alignItems: 'center' },
  dayChip:     { width: 44, height: 36, borderRadius: 18, backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd, justifyContent: 'center', alignItems: 'center' },
  chipSel:     { backgroundColor: Colors.go, borderColor: Colors.go },
  chipDisabled:{ opacity: 0.3 },
  chipTxt:     { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600' },
  chipTxtSel:  { color: Colors.bg, fontWeight: '800' },
  chipTxtDisabled: { color: Colors.di },

  monthGrid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  monthChip:   { width: '22%', height: 36, borderRadius: 18, backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd, justifyContent: 'center', alignItems: 'center' },

  confirmBtn:  { margin: 16, marginTop: 12, backgroundColor: Colors.go, borderRadius: Radius.md, padding: 14, alignItems: 'center' },
  confirmTxt:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
