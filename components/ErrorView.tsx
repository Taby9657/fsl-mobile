import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Fonts, Radius } from '../constants/colors';

interface Props {
  message?: string;
  onRetry: () => void;
}

export function ErrorView({ message = 'Nepodařilo se načíst data.', onRetry }: Props) {
  return (
    <View style={s.wrap}>
      <Ionicons name="cloud-offline-outline" size={48} color={Colors.mu} />
      <Text style={s.msg}>{message}</Text>
      <Pressable style={s.btn} onPress={onRetry}>
        <Ionicons name="refresh" size={16} color={Colors.bg} />
        <Text style={s.btnTxt}>Zkusit znovu</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  msg:  { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', lineHeight: 20 },
  btn:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.go, borderRadius: Radius.md,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  btnTxt: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },
});
