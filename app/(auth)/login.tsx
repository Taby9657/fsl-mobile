import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading]       = useState(false);
  const [showTester, setShowTester] = useState(false);
  const [tLogin, setTLogin]         = useState('');
  const [tPass, setTPass]           = useState('');

  const setAuth       = useAuthStore(s => s.setAuth);
  const loginAsGuest  = useAuthStore(s => s.loginAsGuest);
  const loginAsTester = useAuthStore(s => s.loginAsTester);

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? 'placeholder';
  const [, , promptGoogleAsync] = Google.useAuthRequest({
    iosClientId:     googleClientId,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? 'placeholder',
  });

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await promptGoogleAsync();
      if (result.type !== 'success') { setLoading(false); return; }
      const { authentication } = result;
      if (!authentication?.idToken) throw new Error('Chybí Google idToken');
      const res = await authApi.google(authentication.idToken);
      await setAuth(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Chyba přihlášení', err.message ?? 'Zkus to znovu');
    } finally {
      setLoading(false);
    }
  }

  async function handleApple() {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const res = await authApi.apple(
        credential.identityToken!,
        credential.fullName?.givenName  ?? undefined,
        credential.fullName?.familyName ?? undefined,
        credential.email                ?? undefined,
      );
      await setAuth(res.data.token, res.data.user);
      router.replace('/(tabs)');
    } catch (err: any) {
      if (err.code !== 'ERR_CANCELED') {
        Alert.alert('Chyba přihlášení', err.message ?? 'Zkus to znovu');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleTesterLogin() {
    if (tLogin.trim() === 'SFLTESTER' && tPass.trim() === 'SFLSFL') {
      loginAsTester();
      router.replace('/(tabs)');
    } else {
      Alert.alert('Neplatné přihlašovací údaje');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {/* Logo + název */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>FSL</Text>
          </View>
          <Text style={styles.title}>Floorball Stars Liga</Text>
          <Text style={styles.subtitle}>Přihlas se pro přístup k lize</Text>
        </View>

        {/* Apple + Google */}
        <View style={styles.buttons}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={Radius.md}
            style={styles.appleBtn}
            onPress={handleApple}
          />
          <Pressable style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
            <Ionicons name="logo-google" size={20} color={Colors.wh} style={{ marginRight: 10 }} />
            <Text style={styles.googleText}>Přihlásit se přes Google</Text>
          </Pressable>
        </View>

        {loading && <ActivityIndicator color={Colors.go} style={{ marginTop: 24 }} />}

        {/* Oddělovač */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>nebo</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Guest mode */}
        <Pressable
          style={styles.guestBtn}
          onPress={() => { loginAsGuest(); router.replace('/(tabs)'); }}
        >
          <Text style={styles.guestText}>Pokračovat bez přihlášení</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.mu} />
        </Pressable>

        <Text style={styles.guestNote}>
          V režimu hosta můžeš prohlížet statistiky, zápasy a tabulku. Správa ligy vyžaduje přihlášení.
        </Text>

        {/* Testovací přihlášení – skryté */}
        <Pressable onPress={() => setShowTester(v => !v)} style={styles.testerToggle}>
          <Text style={styles.testerToggleText}>🔧 Testovací režim</Text>
        </Pressable>

        {showTester && (
          <View style={styles.testerBox}>
            <TextInput
              style={styles.testerInput}
              placeholder="Login"
              placeholderTextColor={Colors.di}
              value={tLogin}
              onChangeText={setTLogin}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.testerInput}
              placeholder="Heslo"
              placeholderTextColor={Colors.di}
              value={tPass}
              onChangeText={setTPass}
              secureTextEntry
              autoCapitalize="characters"
            />
            <Pressable style={styles.testerBtn} onPress={handleTesterLogin}>
              <Text style={styles.testerBtnText}>Vstoupit jako tester</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.legal}>
          Přihlášením souhlasíš s podmínkami FSL a zpracováním osobních údajů.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg },
  inner:      { flexGrow: 1, justifyContent: 'center', padding: 32 },
  header:     { alignItems: 'center', marginBottom: 48 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.c2, borderWidth: 2, borderColor: Colors.go,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  logoText:   { fontSize: 24, fontWeight: '900', color: Colors.go },
  title:      { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh, marginBottom: 6 },
  subtitle:   { fontSize: Fonts.sizes.sm, color: Colors.mu },
  buttons:    { gap: 12 },
  appleBtn:   { height: 50 },
  googleBtn: {
    height: 50, borderRadius: Radius.md,
    backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  googleText: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  divider: {
    flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 4, gap: 10,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.bd },
  dividerText: { fontSize: Fonts.sizes.xs, color: Colors.di },
  guestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 4,
  },
  guestText:  { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '500' },
  guestNote: {
    fontSize: Fonts.sizes.xs, color: Colors.di,
    textAlign: 'center', lineHeight: 16, marginBottom: 8, paddingHorizontal: 8,
  },
  testerToggle: { alignItems: 'center', paddingVertical: 12 },
  testerToggleText: { fontSize: Fonts.sizes.xs, color: Colors.di },
  testerBox: {
    marginTop: 4, gap: 8,
    borderWidth: 1, borderColor: Colors.bd,
    borderRadius: Radius.md, padding: 16,
    backgroundColor: Colors.c1,
  },
  testerInput: {
    height: 44, borderWidth: 1, borderColor: Colors.bd,
    borderRadius: Radius.sm, paddingHorizontal: 12,
    color: Colors.wh, fontSize: Fonts.sizes.sm,
  },
  testerBtn: {
    height: 44, borderRadius: Radius.sm,
    backgroundColor: Colors.go, justifyContent: 'center', alignItems: 'center',
  },
  testerBtnText: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  legal: {
    fontSize: Fonts.sizes.xs, color: Colors.di,
    textAlign: 'center', marginTop: 16, lineHeight: 16,
  },
});
