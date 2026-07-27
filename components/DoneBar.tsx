import { InputAccessoryView, Keyboard, Pressable, Text, Platform, View, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../constants/colors';

export const DONE_BAR_ID = 'fsl-done-bar';

/** Tlačítko "Hotovo" nad number-pad / phone-pad klavesnicí (iOS only). */
export function DoneBar() {
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={DONE_BAR_ID}>
      <View style={s.bar}>
        <Pressable onPress={() => Keyboard.dismiss()} style={s.btn} hitSlop={8}>
          <Text style={s.txt}>Hotovo</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: '#38383A',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  btn: { paddingHorizontal: 8, paddingVertical: 4 },
  txt: { color: Colors.go, fontWeight: '700', fontSize: Fonts.sizes.md },
});
