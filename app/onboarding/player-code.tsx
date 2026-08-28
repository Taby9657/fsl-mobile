// Hráč zadá nebo naskenuje pozvánkový kód od vedoucího
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { teamsApi } from '../../services/api';
import { useFanStore } from '../../store/fan';
import { Colors, Fonts, Radius } from '../../constants/colors';

export default function PlayerCodeScreen() {
  const setFan = useFanStore(s => s.setFan);

  const [code, setCode]         = useState('');
  const [bezKodu, setBezKodu]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [team, setTeam]         = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned]   = useState(false);

  const [permission, requestPermission] = useCameraPermissions();

  async function verifyCode(rawCode?: string) {
    const trimmed = (rawCode ?? code).trim().toUpperCase();
    if (trimmed.length < 6) {
      Alert.alert('Zadej platný kód', 'Kód má formát FSL-TM-XXXX');
      return;
    }
    setLoading(true);
    try {
      const res = await teamsApi.join(trimmed);
      setTeam(res.data.team);
      setScanning(false);
    } catch (err: any) {
      Alert.alert('Neplatný kód', err.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setLoading(false);
    }
  }

  async function openScanner() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert('Přístup k fotoaparátu', 'Pro skenování QR kódu povol přístup ke kameře v nastavení.');
        return;
      }
    }
    setScanned(false);
    setScanning(true);
  }

  function handleBarcode({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    const parsed = data.trim().toUpperCase();
    setCode(parsed);
    verifyCode(parsed);
  }

  async function pokracovatJakoFanousek() {
    await setFan(true);
    router.replace('/(tabs)');
  }

  // Potvrzení týmu po verifikaci
  if (team) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.innerCenter}>
          <View style={[styles.teamPreview, { borderColor: team.color }]}>
            <View style={[styles.teamBadge, { backgroundColor: team.color }]}>
              <Text style={styles.teamAbbr}>{team.abbr}</Text>
            </View>
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.teamDiv}>{team.division ?? 'Nezařazeno'}</Text>
          </View>
          <Text style={styles.confirm}>Připojuješ se k tomuto týmu?</Text>
          <Pressable
            style={styles.btnPrimary}
            onPress={() => router.push({ pathname: '/onboarding/player-info', params: { teamId: team.id, teamName: team.name, inviteCode: code.trim().toUpperCase() } })}
          >
            <Text style={styles.btnPrimaryText}>Ano, pokračovat</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => { setTeam(null); setCode(''); }}>
            <Text style={styles.btnSecondaryText}>Zadat jiný kód</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // QR kamera
  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcode}
        />
        {/* Průhledný overlay s rámečkem */}
        <View style={styles.scanOverlay} pointerEvents="none">
          <View style={styles.scanFrame}>
            <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
            <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
          </View>
          <Text style={styles.scanHint}>Namiř kameru na QR kód pozvánky</Text>
        </View>
        <Pressable style={styles.scanClose} onPress={() => setScanning(false)}>
          <Ionicons name="close" size={28} color={Colors.wh} />
        </Pressable>
        {loading && (
          <View style={[styles.scanOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <ActivityIndicator color={Colors.go} size="large" />
          </View>
        )}
      </View>
    );
  }

  // Ruční zadání
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Zpět</Text>
        </Pressable>

        <Text style={styles.title}>Pozvánkový kód</Text>
        <Text style={styles.subtitle}>
          Kód tě propojí s tvým týmem — díky němu tě vedoucí uvidí na soupisce
          a můžeš nastupovat k zápasům.
        </Text>

        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={18} color={Colors.go} />
            <Text style={styles.infoTxt}>
              <Text style={styles.infoStrong}>Kdo ti ho dá: </Text>
              vedoucí tvého týmu. Najde ho ve Správě pod Pozvánkový kód a může ti ho
              poslat zprávou nebo ukázat jako QR.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="text-outline" size={18} color={Colors.go} />
            <Text style={styles.infoTxt}>
              <Text style={styles.infoStrong}>Jak vypadá: </Text>
              FSL, zkratka týmu a čtyři znaky — třeba FSL-BE-7K2P.
            </Text>
          </View>
        </View>

        {/* QR scanner */}
        <Pressable style={styles.scanBtn} onPress={openScanner}>
          <Ionicons name="qr-code-outline" size={22} color={Colors.go} />
          <Text style={styles.scanBtnText}>Naskenovat QR kód</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>nebo zadat ručně</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          placeholder="FSL-BE-XXXX"
          placeholderTextColor={Colors.di}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          keyboardAppearance="dark"
          returnKeyType="done"
          onSubmitEditing={() => verifyCode()}
        />

        <Pressable
          style={[styles.btnPrimary, !code && styles.btnDisabled]}
          onPress={() => verifyCode()}
          disabled={!code || loading}
        >
          {loading
            ? <ActivityIndicator color={Colors.bg} />
            : <Text style={styles.btnPrimaryText}>Ověřit kód</Text>
          }
        </Pressable>

        {/* Cesta ven pro toho, kdo kód nemá */}
        {!bezKodu ? (
          <Pressable onPress={() => setBezKodu(true)} style={styles.linkBtn}>
            <Text style={styles.linkTxt}>Kód nemám</Text>
          </Pressable>
        ) : (
          <View style={styles.vyberBox}>
            <Text style={styles.vyberTitle}>Nevadí, máš tři možnosti</Text>

            <Pressable style={styles.vyberItem} onPress={pokracovatJakoFanousek}>
              <Ionicons name="eye-outline" size={20} color={Colors.mu} />
              <View style={{ flex: 1 }}>
                <Text style={styles.vyberLabel}>Zatím jen sledovat ligu</Text>
                <Text style={styles.vyberDesc}>
                  Pustíme tě dovnitř jako fanouška. Až kód seženeš, doplníš si roli hráče
                  ve Správě.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.di} />
            </Pressable>

            <Pressable
              style={styles.vyberItem}
              onPress={() => router.replace('/onboarding/manager')}
            >
              <Ionicons name="shield-outline" size={20} color={Colors.pu} />
              <View style={{ flex: 1 }}>
                <Text style={styles.vyberLabel}>Můj tým v lize ještě není</Text>
                <Text style={styles.vyberDesc}>
                  Založ ho jako vedoucí. Dostaneš kód, který rozešleš spoluhráčům.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.di} />
            </Pressable>

            <View style={styles.vyberItem}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.go} />
              <View style={{ flex: 1 }}>
                <Text style={styles.vyberLabel}>Napiš vedoucímu</Text>
                <Text style={styles.vyberDesc}>
                  Stačí zpráva ve stylu: „Pošli mi prosím pozvánkový kód do FSL."
                  Najde ho v aplikaci ve Správě → Pozvánkový kód.
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.bg },
  inner:           { flexGrow: 1, padding: 24, paddingTop: 16 },
  innerCenter:     { flex: 1, padding: 24, justifyContent: 'center' },
  back:            { marginBottom: 24 },
  backText:        { color: Colors.go, fontSize: Fonts.sizes.md },
  title:           { fontSize: Fonts.sizes.h1, fontWeight: '900', color: Colors.wh, marginBottom: 6 },
  subtitle:        { fontSize: Fonts.sizes.md, color: Colors.mu, marginBottom: 24, lineHeight: 22 },

  scanBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.go, borderRadius: Radius.md, padding: 14, marginBottom: 20 },
  scanBtnText:     { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.go },

  divider:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine:     { flex: 1, height: 1, backgroundColor: Colors.bd },
  dividerText:     { fontSize: Fonts.sizes.xs, color: Colors.di },

  input: {
    backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd,
    borderRadius: Radius.md, padding: 16, fontSize: Fonts.sizes.xl,
    color: Colors.wh, fontWeight: '700', textAlign: 'center',
    letterSpacing: 4, marginBottom: 16,
  },
  infoBox:         { backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, gap: 12, marginBottom: 22 },
  infoRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoTxt:         { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18 },
  infoStrong:      { color: Colors.wh, fontWeight: '700' },
  linkBtn:         { alignItems: 'center', paddingVertical: 14 },
  linkTxt:         { fontSize: Fonts.sizes.sm, color: Colors.go, fontWeight: '600', textDecorationLine: 'underline' },
  vyberBox:        { marginTop: 8, gap: 10 },
  vyberTitle:      { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh, marginBottom: 2 },
  vyberItem:       { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14 },
  vyberLabel:      { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  vyberDesc:       { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 17, marginTop: 3 },
  btnPrimary:      { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginBottom: 10 },
  btnPrimaryText:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  btnDisabled:     { opacity: 0.4 },
  btnSecondary:    { borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  btnSecondaryText:{ fontSize: Fonts.sizes.md, color: Colors.mu, fontWeight: '600' },
  teamPreview:     { alignItems: 'center', padding: 32, borderWidth: 2, borderRadius: Radius.xl, marginBottom: 24 },
  teamBadge:       { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  teamAbbr:        { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.bg },
  teamName:        { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh, marginBottom: 4 },
  teamDiv:         { fontSize: Fonts.sizes.sm, color: Colors.mu },
  confirm:         { fontSize: Fonts.sizes.lg, color: Colors.wh, textAlign: 'center', marginBottom: 20 },

  // Scanner
  scanOverlay:     { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  scanFrame:       { width: 240, height: 240, position: 'relative', marginBottom: 24 },
  corner:          { position: 'absolute', width: 28, height: 28, borderColor: Colors.go },
  scanHint:        { fontSize: Fonts.sizes.sm, color: Colors.wh, fontWeight: '600', textAlign: 'center' },
  scanClose:       { position: 'absolute', top: 52, right: 20, padding: 8 },
});
