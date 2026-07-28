import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Colors, Radius } from '../constants/colors';

// Základní skeleton blok s pulsující animací
export function SkeletonBlock({ width, height, style }: {
  width?: number | `${number}%`;
  height?: number;
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 900, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        st.block,
        width  !== undefined && { width },
        height !== undefined && { height },
        { opacity },
        style,
      ]}
    />
  );
}

// Skeleton karta zápasu (pro matches + home screen)
export function SkeletonMatchCard() {
  return (
    <View style={st.matchCard}>
      <SkeletonBlock width="40%" height={10} />
      <View style={st.matchRow}>
        <SkeletonBlock height={16} style={{ flex: 1 }} />
        <SkeletonBlock width={36} height={16} />
        <SkeletonBlock height={16} style={{ flex: 1 }} />
      </View>
      <SkeletonBlock width="30%" height={9} style={{ marginTop: 6 }} />
    </View>
  );
}

// Skeleton tabulkový řádek
export function SkeletonTableRow({ last }: { last?: boolean }) {
  return (
    <View style={[st.tableRow, !last && st.tableRowBorder]}>
      <SkeletonBlock width={20} height={12} />
      <SkeletonBlock width={8} height={8} style={{ borderRadius: 4 }} />
      <SkeletonBlock height={12} style={{ flex: 1 }} />
      <SkeletonBlock width={32} height={12} />
    </View>
  );
}

// Skeleton highlight karta
export function SkeletonHighlightCard() {
  return (
    <View style={st.highlightCard}>
      <SkeletonBlock width="60%" height={14} />
      <SkeletonBlock width="100%" height={10} style={{ marginTop: 8 }} />
      <SkeletonBlock width="80%" height={10} style={{ marginTop: 4 }} />
    </View>
  );
}

// Skeleton hero karta (profil hráče apod.)
export function SkeletonHeroCard() {
  return (
    <View style={st.heroCard}>
      <SkeletonBlock width={56} height={56} style={{ borderRadius: 28 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBlock width="60%" height={16} />
        <SkeletonBlock width="40%" height={11} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  block:        { backgroundColor: Colors.c2, borderRadius: Radius.sm },
  matchCard:    { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, marginBottom: 8, gap: 8 },
  matchRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tableRow:     { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  tableRowBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.bd },
  highlightCard:{ backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, marginBottom: 8 },
  heroCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16, marginBottom: 8 },
});
