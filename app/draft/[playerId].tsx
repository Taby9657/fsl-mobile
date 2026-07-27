import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Alert, TextInput, Image, Linking, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
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
  if (diff <= 0) return 'brzy vyprší';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function DraftPlayerCard() {
  const { playerId } = useLocalSearchParams<{ playerId: string }>();
  const { user, refreshUser } = useAuthStore();

  const myPlayer   = user?.player;
  const isManager  = !!(user?.manager?.length);
  const isOwnCard  = myPlayer?.id === playerId;

  const [loading,   setLoading]   = useState(true);
  const [profile,   setProfile]   = useState<any>(null);
  const [message,   setMessage]   = useState('');
  const [sending,   setSending]   = useState(false);
  const [acting,    setActing]    = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;
    draftApi.getProfile(playerId)
      .then(r => setProfile(r.data))
      .catch(() => Alert.alert('Chyba', 'Profil nenalezen'))
      .finally(() => setLoading(false));
  }, [playerId]);

  async function sendOffer() {
    if (!profile) return;
    Alert.alert(
      'Odeslat nabídku',
      `Draftovat ${profile.player?.firstName} ${profile.player?.lastName}?\n\n${profile.offerCount === 0 ? 'Hráč bude mít 72 hodin na rozhodnutí.' : 'Tím se okno zkrátí na 24 hodin.'}`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Draftovat', style: 'default',
          onPress: async () => {
            setSending(true);
            try {
              const res = await draftApi.makeOffer(playerId!, { message: message || undefined });
              setProfile((prev: any) => ({
                ...prev,
                myTeamOffer: res.data.offer,
                offerCount:  (prev.offerCount ?? 0) + 1,
                windowExpiresAt: res.data.windowExpiresAt,
              }));
              setMessage('');
              Alert.alert('Nabídka odeslána', `Hráč byl informován. Vyprší za ${timeLeft(res.data.windowExpiresAt)}.`);
            } catch (err: any) {
              Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se odeslat');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  }

  async function handleOffer(offerId: string, action: 'accept' | 'reject') {
    if (!playerId) return;
    Alert.alert(
      action === 'accept' ? 'Přijmout nabídku' : 'Odmítnout nabídku',
      action === 'accept'
        ? 'Přijmeš nabídku a vstoupíš do týmu. Ostatní nabídky se zruší.'
        : 'Odmítneš tuto nabídku.',
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: action === 'accept' ? 'Přijmout' : 'Odmítnout',
          style: action === 'accept' ? 'default' : 'destructive',
          onPress: async () => {
            setActing(offerId);
            try {
              const res = action === 'accept'
                ? await draftApi.acceptOffer(playerId, offerId)
                : await draftApi.rejectOffer(playerId, offerId);

              if (action === 'accept') {
                await refreshUser(); // aktualizuj teamId v store
                Alert.alert('Přijato!', `Vstupuješ do týmu ${res.data.teamName}!`, [
                  { text: 'OK', onPress: () => router.replace('/(tabs)') },
                ]);
              } else {
                // Reload nabídek
                const updated = await draftApi.getProfile(playerId);
                setProfile(updated.data);
              }
            } catch (err: any) {
              Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se zpracovat');
            } finally {
              setActing(null);
            }
          },
        },
      ]
    );
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator color={Colors.go} size="large" /></View>
  );

  if (!profile) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Draft karta</Text>
        <View style={{ width: 40 }} />
      </View>
      <View style={s.center}>
        <Ionicons name="person-remove-outline" size={48} color={Colors.di} />
        <Text style={{ color: Colors.mu, marginTop: 12, fontSize: Fonts.sizes.md }}>Profil nenalezen</Text>
        <Text style={{ color: Colors.di, marginTop: 4, fontSize: Fonts.sizes.sm }}>Hráč není v draft poolu</Text>
      </View>
    </SafeAreaView>
  );

  const p = profile.player;
  const hasWindow = !!profile.windowExpiresAt;
  const alreadyOffered = profile.myTeamOffer?.status === 'PENDING';

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={() => router.back()} style={s.backBtn}>
              <Ionicons name="chevron-back" size={24} color={Colors.wh} />
            </Pressable>
            <Text style={s.title}>Draft karta</Text>
            {isOwnCard && (
              <Pressable onPress={() => router.push('/draft/profile-edit' as any)} style={{ padding: 4 }}>
                <Ionicons name="pencil" size={18} color={Colors.go} />
              </Pressable>
            )}
          </View>

          {/* Hero */}
          <View style={s.hero}>
            <View style={s.heroAvatar}>
              {p?.photoUrl
                ? <Image source={{ uri: p.photoUrl }} style={s.heroAvatarImg} />
                : <Ionicons name="person" size={44} color={Colors.mu} />
              }
            </View>
            <Text style={s.heroName}>{p?.firstName} {p?.lastName}</Text>
            <Text style={s.heroPos}>{profile.position ?? p?.position ?? '—'}</Text>
            {isManager && p?.phone && (
              <Pressable style={s.phoneBtn} onPress={() => Linking.openURL(`tel:${p.phone}`)}>
                <Ionicons name="call" size={14} color={Colors.bg} />
                <Text style={s.phoneBtnTxt}>{p.phone}</Text>
              </Pressable>
            )}
          </View>

          {/* Draft window status */}
          {hasWindow && (
            <View style={s.windowBanner}>
              <Ionicons name="timer" size={16} color={Colors.go} />
              <Text style={s.windowTxt}>
                {pluralOffer(profile.offerCount)} · okno vyprší za {timeLeft(profile.windowExpiresAt)}
              </Text>
            </View>
          )}

          <View style={{ padding: 16, gap: 16 }}>
            {/* Bio */}
            {profile.bio ? (
              <View style={s.section}>
                <Text style={s.sectionTitle}>O mně</Text>
                <Text style={s.sectionBody}>{profile.bio}</Text>
              </View>
            ) : null}

            {/* Pub skill */}
            {profile.pubSkill ? (
              <View style={[s.section, s.pubSection]}>
                <Text style={s.sectionTitle}>💬 Pub skill</Text>
                <Text style={s.pubBody}>{profile.pubSkill}</Text>
              </View>
            ) : null}

            {/* Videa */}
            {profile.videos?.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Sestřih ({profile.videos.length} videí)</Text>
                {profile.videos.map((v: any, idx: number) => (
                  <Pressable key={v.id} style={s.videoRow} onPress={() => Linking.openURL(v.url)}>
                    <Ionicons name="play-circle" size={22} color={Colors.go} />
                    <Text style={s.videoLbl}>Video {idx + 1}</Text>
                    <Ionicons name="open-outline" size={14} color={Colors.di} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Nabídky (jen vlastní pohled) */}
            {isOwnCard && profile.offers?.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Nabídky ({profile.offers.length})</Text>
                {profile.offers.map((offer: any) => (
                  <View key={offer.id} style={s.offerCard}>
                    <View style={[s.teamDot, { backgroundColor: offer.team?.color ?? Colors.go }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.offerTeam}>{offer.team?.name}</Text>
                      {offer.message ? <Text style={s.offerMsg}>{offer.message}</Text> : null}
                      <Text style={s.offerExpiry}>Vyprší za {timeLeft(profile.windowExpiresAt)}</Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <Pressable
                        style={[s.offerBtn, s.acceptBtn, acting === offer.id && { opacity: 0.5 }]}
                        onPress={() => handleOffer(offer.id, 'accept')}
                        disabled={!!acting}
                      >
                        {acting === offer.id
                          ? <ActivityIndicator size="small" color={Colors.bg} />
                          : <Text style={s.offerBtnTxt}>Přijmout</Text>
                        }
                      </Pressable>
                      <Pressable
                        style={[s.offerBtn, s.rejectBtn, acting === offer.id && { opacity: 0.5 }]}
                        onPress={() => handleOffer(offer.id, 'reject')}
                        disabled={!!acting}
                      >
                        <Text style={[s.offerBtnTxt, { color: Colors.red }]}>Odmítnout</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Draftovat (manažer) */}
            {isManager && !isOwnCard && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Draftovat hráče</Text>
                {alreadyOffered ? (
                  <View style={s.alreadyBanner}>
                    <Ionicons name="checkmark-circle" size={18} color={Colors.green} />
                    <Text style={s.alreadyTxt}>Váš tým již odeslal nabídku tomuto hráči.</Text>
                  </View>
                ) : (
                  <>
                    <TextInput
                      style={[s.input, { marginBottom: 12 }]}
                      value={message}
                      onChangeText={setMessage}
                      placeholder="Volitelná zpráva hráči..."
                      placeholderTextColor={Colors.di}
                      multiline
                      numberOfLines={2}
                      keyboardAppearance="dark"
                    />
                    <Pressable
                      style={[s.draftBtn, sending && { opacity: 0.5 }]}
                      onPress={sendOffer}
                      disabled={sending}
                    >
                      {sending
                        ? <ActivityIndicator color={Colors.bg} />
                        : <>
                            <Ionicons name="person-add" size={16} color={Colors.bg} />
                            <Text style={s.draftBtnTxt}>
                              {profile.offerCount === 0 ? 'Draftovat (72h okno)' : 'Draftovat (přebít – 24h)'}
                            </Text>
                          </>
                      }
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backBtn:     { width: 40, height: 40, justifyContent: 'center' },
  title:       { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },

  hero:        { alignItems: 'center', padding: 24, gap: 8 },
  heroAvatar:  { width: 90, height: 90, borderRadius: 45, backgroundColor: Colors.c1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', borderWidth: 2, borderColor: Colors.go },
  heroAvatarImg: { width: 90, height: 90 },
  heroName:    { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh },
  heroPos:     { fontSize: Fonts.sizes.sm, color: Colors.mu },
  phoneBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.green, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  phoneBtnTxt: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },

  windowBanner:{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.go}15`, padding: 12, marginHorizontal: 16, borderRadius: Radius.md, borderWidth: 1, borderColor: `${Colors.go}40` },
  windowTxt:   { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '600', flex: 1 },

  section:     { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 16, gap: 10 },
  pubSection:  { borderColor: `${Colors.go}44` },
  sectionTitle:{ fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.mu, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBody: { fontSize: Fonts.sizes.md, color: Colors.wh, lineHeight: 22 },
  pubBody:     { fontSize: Fonts.sizes.md, color: Colors.wh, fontStyle: 'italic', lineHeight: 22 },

  videoRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.bg, borderRadius: Radius.sm, padding: 10 },
  videoLbl:    { flex: 1, fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '500' },

  offerCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.bg, borderRadius: Radius.sm, padding: 12 },
  teamDot:     { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  offerTeam:   { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  offerMsg:    { fontSize: Fonts.sizes.sm, color: Colors.mu, marginTop: 3 },
  offerExpiry: { fontSize: Fonts.sizes.xs, color: Colors.di, marginTop: 4 },
  offerBtn:    { borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 80 },
  acceptBtn:   { backgroundColor: Colors.go },
  rejectBtn:   { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.red },
  offerBtnTxt: { fontSize: 11, fontWeight: '700', color: Colors.bg },

  alreadyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.green}15`, borderRadius: Radius.sm, padding: 12 },
  alreadyTxt:    { fontSize: Fonts.sizes.sm, color: Colors.green, flex: 1 },

  input:       { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh, textAlignVertical: 'top', minHeight: 70 },
  draftBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16 },
  draftBtnTxt: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
});
