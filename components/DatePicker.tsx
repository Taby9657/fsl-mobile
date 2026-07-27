import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/colors';

const DAYS_CZ   = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
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

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-based weekday (0=Po ... 6=Ne)
function weekdayMon(date: Date) {
  return (date.getDay() + 6) % 7;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDisplay(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function DatePicker({ value, onChange, placeholder = 'Vybrat datum', maxDate, minDate }: Props) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear]   = useState(value?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(value?.getMonth()     ?? today.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day: number) {
    const chosen = new Date(viewYear, viewMonth, day);
    onChange(chosen);
    setOpen(false);
  }

  // Build grid
  const firstDay = startOfMonth(viewYear, viewMonth);
  const offset   = weekdayMon(firstDay);   // blank cells before day 1
  const total    = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  // pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <>
      <Pressable style={s.field} onPress={() => setOpen(true)}>
        <Ionicons name="calendar-outline" size={16} color={value ? Colors.go : Colors.di} />
        <Text style={[s.fieldText, !value && s.placeholder]}>
          {value ? formatDisplay(value) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={14} color={Colors.di} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={prevMonth} style={s.navBtn}>
              <Ionicons name="chevron-back" size={20} color={Colors.wh} />
            </Pressable>
            <Text style={s.monthTitle}>
              {MONTHS_CZ[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={nextMonth} style={s.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={Colors.wh} />
            </Pressable>
          </View>

          {/* Day labels */}
          <View style={s.weekRow}>
            {DAYS_CZ.map(d => (
              <Text key={d} style={s.dayLabel}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={s.grid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={`e${idx}`} style={s.cell} />;
              const date  = new Date(viewYear, viewMonth, day);
              const isToday = isSameDay(date, today);
              const isSel   = value ? isSameDay(date, value) : false;
              const disabled =
                (minDate && date < minDate) ||
                (maxDate && date > maxDate);
              return (
                <Pressable
                  key={day}
                  style={[s.cell, isSel && s.cellSel, isToday && !isSel && s.cellToday]}
                  onPress={() => !disabled && selectDay(day)}
                  disabled={!!disabled}
                >
                  <Text style={[
                    s.dayNum,
                    isSel    && s.dayNumSel,
                    isToday  && !isSel && s.dayNumToday,
                    disabled && s.dayNumDisabled,
                  ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Dnes */}
          <Pressable style={s.todayBtn} onPress={() => {
            onChange(today);
            setViewYear(today.getFullYear());
            setViewMonth(today.getMonth());
            setOpen(false);
          }}>
            <Text style={s.todayTxt}>Dnes</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const CELL = 40;

const s = StyleSheet.create({
  field:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12 },
  fieldText:   { flex: 1, fontSize: Fonts.sizes.md, color: Colors.wh },
  placeholder: { color: Colors.di },

  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.c2, justifyContent: 'center', alignItems: 'center' },
  monthTitle:  { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },

  weekRow:     { flexDirection: 'row', marginBottom: 8 },
  dayLabel:    { width: `${100 / 7}%` as any, textAlign: 'center', fontSize: Fonts.sizes.xs, color: Colors.mu, fontWeight: '600' },

  grid:        { flexDirection: 'row', flexWrap: 'wrap' },
  cell:        { width: `${100 / 7}%` as any, height: CELL, justifyContent: 'center', alignItems: 'center' },
  cellSel:     { backgroundColor: Colors.go, borderRadius: CELL / 2 },
  cellToday:   { borderWidth: 1, borderColor: Colors.go, borderRadius: CELL / 2 },

  dayNum:         { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '500' },
  dayNumSel:      { color: Colors.bg, fontWeight: '800' },
  dayNumToday:    { color: Colors.go, fontWeight: '700' },
  dayNumDisabled: { color: Colors.di },

  todayBtn:    { marginTop: 14, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 10, borderRadius: Radius.full, backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd },
  todayTxt:    { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '700' },
});
