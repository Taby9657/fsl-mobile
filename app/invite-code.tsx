import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Share, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { teamsApi } from '../services/api';
import { useAuthStore } from '../store/auth';
import { Colors, Fonts, Radius } from '../constants/colors';

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data)}&bgcolor=0d0120&color=c9a140&qzone=2&format=png`;
}

export default function InviteCodeScreen() {
  const { user } = useAuthStore();
  const teamId   = user?.manager?.[0]?.teamId;
  const teamName = user?.manager?.[0]?.team?.name ?? 'Tvůj tým';

  const [loading, setLoading] = useState(true);
  const [code, setCode]       = useState('');

  useEffect(() => {
    if (!teamId) { setLoading(false); return; }
    teamsApi.invite(teamId)
      .then(r => setCode(r.data.code))
      .catch(() => Alert.alert('Chyba', 'Nepodařilo se načíst kód'))
      .finally(() => setLoading(false));
  }, [teamId]);

  async function share() {
    try {
      await Share.share({
        message: `Připoj se k týmu ${teamName} ve Floorball Stars Lize! 🏑\n\nPozvánkový kód: ${code}\n\nStáhni appku FSL:\niOS: https://apps.apple.com/app/fsl-liga/id6504321234\nAndroid: https://play.google.com/store/apps/details?id=cz.fsl.app`,
        title:   'Pozvánka do FSL',
      });
    } catch {}
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Pozvánkový kód</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.body}>
        {loading ? (
          <ActivityIndicator color={Colors.go} size="large" />
        ) : !code ? (
          <Text style={s.empty}>Kód není dostupný</Text>
        ) : (
          <>
            <View style={s.codeCard}>
              {/* Skutečný QR kód generovaný přes API */}
              <View style={s.qrWrap}>
                <Image
                  source={{ uri: qrUrl(code) }}
                  style={s.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={s.codeLabel}>Pozvánkový kód</Text>
              <Text style={s.code} selectable>{code}</Text>
              <Text style={s.hint}>Hráč naskenuje QR kód nebo kód zadá ručně při registraci.</Text>
            </View>

            <Pressable style={s.shareBtn} onPress={share}>
              <Ionicons name="share-outline" size={18} color={Colors.bg} />
              <Text style={s.shareBtnText}>Sdílet pozvánku</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:        { width: 40, height: 40, justifyContent: 'center' },
  title:       { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  body:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 20 },
  codeCard:    { width: '100%', backgroundColor: Colors.c1, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.bd, padding: 32, alignItems: 'center', gap: 0 },
  qrWrap:      { width: 220, height: 220, borderRadius: Radius.md, overflow: 'hidden', marginBottom: 24, backgroundColor: '#0d0120', borderWidth: 1, borderColor: Colors.bd },
  qrImage:     { width: 220, height: 220 },
  codeLabel:   { fontSize: Fonts.sizes.sm, color: Colors.mu, marginBottom: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  code:        { fontSize: 28, fontWeight: '900', color: Colors.go, letterSpacing: 4, textAlign: 'center', marginBottom: 16 },
  hint:        { fontSize: Fonts.sizes.xs, color: Colors.di, textAlign: 'center', lineHeight: 18 },
  shareBtn:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.go, borderRadius: Radius.md, paddingHorizontal: 32, paddingVertical: 14 },
  shareBtnText:{ fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  empty:       { fontSize: Fonts.sizes.md, color: Colors.mu },
});
