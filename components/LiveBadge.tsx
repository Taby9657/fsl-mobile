import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { Colors, Radius } from '../constants/colors';

export function LiveBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1.0,  duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const md = size === 'md';
  return (
    <View style={[st.badge, md && st.badgeMd]}>
      <Animated.View style={[st.dot, md && st.dotMd, { opacity }]} />
      <Text style={[st.txt, md && st.txtMd]}>LIVE</Text>
    </View>
  );
}

const st = StyleSheet.create({
  badge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${Colors.red}22`, borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: `${Colors.red}55` },
  badgeMd:{ paddingHorizontal: 10, paddingVertical: 5 },
  dot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.red },
  dotMd:  { width: 7, height: 7, borderRadius: 4 },
  txt:    { fontSize: 10, fontWeight: '700', color: Colors.red, letterSpacing: 0.5 },
  txtMd:  { fontSize: 12 },
});
