import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, TextInput,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Colors, Fonts, Radius } from '../../constants/colors';
import * as Haptics from 'expo-haptics';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  // E-mailové přihlášení
  const [showEmail, setShowEmail] = useState(false);
  const [mode,      setMode]      = useState<Mode>('login');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');

  // Testovací režim je jen pro vývojové buildy — v produkci se nezobrazuje
  const [showTester, setShowTester] = useState(false);
  const [tLogin, setTLogin]         = useState('');
  const [tPass, setTPass]           = useState('');

  const setAuth       = useAuthStore(s => s.setAuth);
  const loginAsGuest  = useAuthStore(s => s.loginAsGuest);
  const loginAsTester = useAuthStore(s => s.loginAsTester);

  const [, , promptGoogleAsync] = Google.useAuthRequest({
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId:     process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  async function dokonci(token: string, user: any) {
    await setAuth(token, user);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  }

  function chyba(err: any, fallback = 'Zkus to znovu') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Alert.alert('Chyba přihlášení', err?.response?.data?.error ?? err?.message ?? fallback);
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await promptGoogleAsync();
      if (result.type !== 'success') { setLoading(false); return; }
      const { authentication, params } = result as any;
      // authentication.idToken je null při code flow na iOS – fallback na params.id_token
      const idToken = authentication?.idToken ?? params?.id_token;
      if (!idToken) throw new Error('Chybí Google idToken');
      const res = await authApi.google(idToken);
      await dokonci(res.data.token, res.data.user);
    } catch (err: any) {
      chyba(err);
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
      await dokonci(res.data.token, res.data.user);
    } catch (err: any) {
      if (err.code !== 'ERR_CANCELED') chyba(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleEmail() {
    const e = email.trim().toLowerCase();
    if (!e || !password) {
      Alert.alert('Vyplň údaje', 'Zadej e-mail i heslo.'); return;
    }
    if (mode === 'register') {
      if (password.length < 8) {
        Alert.alert('Krátké heslo', 'Heslo musí mít alespoň 8 znaků.'); return;
      }
      if (password !== password2) {
        Alert.alert('Hesla se neshodují', 'Zkontroluj obě pole.'); return;
      }
    }

    setLoading(true);
    try {
      const res = mode === 'login'
        ? await authApi.login(e, password)
        : await authApi.register(e, password);
      await dokonci(res.data.token, res.data.user);
    } catch (err: any) {
      chyba(err);
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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

          {!showEmail && (
            <Pressable style={styles.emailBtn} onPress={() => setShowEmail(true)} disabled={loading}>
              <Ionicons name="mail-outline" size={20} color={Colors.wh} style={{ marginRight: 10 }} />
              <Text style={styles.googleText}>Přihlásit se e-mailem</Text>
            </Pressable>
          )}
        </View>

        {/* E-mail + heslo */}
        {showEmail && (
          <View style={styles.emailBox}>
            <View style={styles.tabs}>
              {(['login', 'register'] as Mode[]).map(m => (
                <Pressable
                  key={m}
                  style={[styles.tab, mode === m && styles.tabActive]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[styles.tabTxt, mode === m && styles.tabTxtActive]}>
                    {m === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="E-mail"
              placeholderTextColor={Colors.di}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              keyboardAppearance="dark"
            />
            <TextInput
              style={styles.input}
              placeholder={mode === 'register' ? 'Heslo (min. 8 znaků)' : 'Heslo'}
              placeholderTextColor={Colors.di}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType={mode === 'register' ? 'newPassword' : 'password'}
              keyboardAppearance="dark"
            />
            {mode === 'register' && (
              <TextInput
                style={styles.input}
                placeholder="Heslo znovu"
                placeholderTextColor={Colors.di}
                value={password2}
                onChangeText={setPassword2}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                keyboardAppearance="dark"
              />
            )}

            <Pressable
              style={[styles.emailSubmit, loading && styles.btnOff]}
              onPress={handleEmail}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={Colors.bg} size="small" />
                : <Text style={styles.emailSubmitTxt}>
                    {mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
                  </Text>}
            </Pressable>

            <Text style={styles.emailNote}>
              {mode === 'login'
                ? 'Pokud sis účet založil přes Apple nebo Google, přihlas se stejnou cestou.'
                : 'Heslo si dobře zapamatuj — obnovu hesla zatím aplikace neumí.'}
            </Text>
          </View>
        )}

        {loading && !showEmail && <ActivityIndicator color={Colors.go} style={{ marginTop: 24 }} />}

        {/* Oddělovač */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>nebo</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Host */}
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

        {/* Testovací přihlášení – pouze ve vývojovém buildu */}
        {__DEV__ && (
          <>
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
          </>
        )}

        <Text style={styles.legal}>
          Přihlášením souhlasíš s podmínkami FSL a zpracováním osobních údajů.
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg },
  inner:      { flexGrow: 1, justifyContent: 'center', padding: 32 },
  header:     { alignItems: 'center', marginBottom: 40 },
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
  emailBtn: {
    height: 50, borderRadius: Radius.md,
    backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  googleText: { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },

  emailBox:   { marginTop: 16, gap: 10 },
  tabs:       { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tab:        { flex: 1, paddingVertical: 9, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.bd, alignItems: 'center', backgroundColor: Colors.c1 },
  tabActive:  { backgroundColor: Colors.go, borderColor: Colors.go },
  tabTxt:     { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.mu },
  tabTxtActive:{ color: Colors.bg },
  input: {
    height: 46, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.sm,
    paddingHorizontal: 12, color: Colors.wh, fontSize: Fonts.sizes.md, backgroundColor: Colors.c1,
  },
  emailSubmit: { height: 48, borderRadius: Radius.md, backgroundColor: Colors.go, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  emailSubmitTxt: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  emailNote:  { fontSize: Fonts.sizes.xs, color: Colors.di, lineHeight: 16 },
  btnOff:     { opacity: 0.5 },

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
