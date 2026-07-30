import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator,
         Image, RefreshControl, Alert, DeviceEventEmitter } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { draftApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';

function pluralOffer(n: number) {
  if (n === 1) return '1 nabídka';
  if (n >= 2 && n <= 4) return `${n} nabídky`;
  return `${n} nabídek`;
}

function timeLeft(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Vyprší brzy';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function DraftScreen() {
  const { user, isGuest } = useAuthStore();
  const isManager   = !!(user?.manager?.length);
  const myPlayer    = user?.player;
  const hasTeam     = !!myPlayer?.teamId;
  const canJoinDraft = myPlayer && !hasTeam;

  const [profiles,    setProfiles]    = useState<any[]>([]);
  const [myProfile,   setMyProfile]   = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [listRes, meRes] = await Promise.allSettled([
        draftApi.list(),
        canJoinDraft ? draftApi.me() : Promise.resolve(null),
      ]);
      if (listRes.status === 'fulfilled') setProfiles(listRes.value.data ?? []);
      if (meRes.status === 'fulfilled' && meRes.value) setMyProfile(meRes.value.data);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst draft');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canJoinDraft]);

  // Načti při prvním zobrazení i při návratu z profile-edit nebo [playerId]
  // Guard pro guest – load by selhal s 401 a zobrazil chybový alert
  useFocusEffect(useCallback(() => {
    if (!isGuest && user) load();
  }, [load, isGuest, user]));

  // Fallback: draft/profile-edit je v root Stacku – useFocusEffect ne vždy spustí po router.back()
  // DeviceEventEmitter zajistí reload i bez focus eventu
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('draftProfileChanged', () => {
      if (!isGuest && user) load(true);
    });
    return () => sub.remove();
  }, [load, isGuest, user]);

  if (isGuest || !user) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Draft</Text>
      </View>
      <View style={s.center}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.di} />
        <Text style={[s.emptyTitle, { marginTop: 12 }]}>Přihlas se pro přístup</Text>
        <Text style={s.emptyHint}>Draft je dostupný pouze přihlášeným uživatelům.</Text>
        <Pressable style={[s.emptyBtn, { marginTop: 16 }]} onPress={() => router.push('/(auth)/login' as any)}>
          <Text style={s.emptyBtnTxt}>Přihlásit se</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Draft</Text>
          <Text style={s.subtitle}>Volní hráči hledající tým</Text>
        </View>
        {canJoinDraft && (
          <Pressable
            style={[s.myBtn, myProfile?.isActive && s.myBtnActive]}
            onPress={() => router.push('/draft/profile-edit' as any)}
          >
            <Ionicons
              name={myProfile?.isActive ? 'person' : 'person-add-outline'}
              size={16}
              color={myProfile?.isActive ? Colors.bg : Colors.go}
            />
            <Text style={[s.myBtnTxt, myProfile?.isActive && { color: Colors.bg }]}>
              {myProfile?.isActive ? 'Můj profil' : 'Přidat se'}
            </Text>
          </Pressable>
        )}
      </View>

      {profiles.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="people-outline" size={52} color={Colors.di} />
          <Text style={s.emptyTitle}>Draft pool je prázdný</Text>
          <Text style={s.emptyHint}>
            {canJoinDraft
              ? 'Buď první – přidej svůj draft profil'
              : 'Momentálně žádní volní hráči'}
          </Text>
          {canJoinDraft && (
            <Pressable style={s.emptyBtn} onPress={() => router.push('/draft/profile-edit' as any)}>
              <Text style={s.emptyBtnTxt}>Vytvořit profil</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.go} />}
          renderItem={({ item }) => {
            const isMe = myPlayer?.id === item.player?.id;
            const hasWindow = !!item.windowExpiresAt;
            return (
              <Pressable style={s.card} onPress={() => router.push(`/draft/${item.player?.id}` as any)}>
                {/* Avatar + základní info */}
                <View style={s.cardTop}>
                  <View style={s.avatar}>
                    {item.player?.photoUrl
                      ? <Image source={{ uri: item.player.photoUrl }} style={s.avatarImg} />
                      : <Ionicons name="person" size={28} color={Colors.mu} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={s.playerName}>
                        {item.player?.firstName} {item.player?.lastName}
                      </Text>
                      {isMe && (
                        <View style={s.meBadge}><Text style={s.meBadgeTxt}>Já</Text></View>
                      )}
                    </View>
                    <Text style={s.position}>{item.position ?? item.player?.position ?? '—'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    {item.videos?.length > 0 && (
                      <View style={s.videoBadge}>
                        <Ionicons name="videocam" size={11} color={Colors.go} />
                        <Text style={s.videoCnt}>{item.videos.length}</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={Colors.di} />
                  </View>
                </View>

                {/* Pub skill preview */}
                {item.pubSkill ? (
                  <Text style={s.pubSkill} numberOfLines={2}>
                    💬 {item.pubSkill}
                  </Text>
                ) : null}

                {/* Telefon pro manažery */}
                {isManager && item.player?.phone && (
                  <View style={s.phoneRow}>
                    <Ionicons name="call-outline" size={13} color={Colors.green} />
                    <Text style={s.phone}>{item.player.phone}</Text>
                  </View>
                )}

                {/* Draft window status */}
                {hasWindow && (
                  <View style={s.windowBadge}>
                    <Ionicons name="timer-outline" size={12} color={Colors.go} />
                    <Text style={s.windowTxt}>
                      {pluralOffer(item.offerCount)} · vyprší za {timeLeft(item.windowExpiresAt)}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  title:       { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh },
  subtitle:    { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },

  myBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.go, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  myBtnActive: { backgroundColor: Colors.go, borderColor: Colors.go },
  myBtnTxt:    { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.go },

  card:        { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, gap: 8 },
  cardTop:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.c2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:   { width: 52, height: 52 },
  playerName:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  position:    { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  meBadge:     { backgroundColor: Colors.go, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  meBadgeTxt:  { fontSize: 9, fontWeight: '700', color: Colors.bg },

  videoBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${Colors.go}22`, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  videoCnt:    { fontSize: 10, fontWeight: '700', color: Colors.go },

  pubSkill:    { fontSize: Fonts.sizes.sm, color: Colors.mu, fontStyle: 'italic', lineHeight: 18 },
  phoneRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phone:       { fontSize: Fonts.sizes.sm, color: Colors.green, fontWeight: '600' },

  windowBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: `${Colors.go}15`, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  windowTxt:   { fontSize: Fonts.sizes.xs, color: Colors.go, fontWeight: '600' },

  empty:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 40 },
  emptyTitle:  { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.mu },
  emptyHint:   { fontSize: Fonts.sizes.sm, color: Colors.di, textAlign: 'center' },
  emptyBtn:    { marginTop: 8, backgroundColor: Colors.go, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnTxt: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
