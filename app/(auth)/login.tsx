import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, Image } from 'react-native';
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
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore(s => s.setAuth);

  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>

        {/* Logo + název */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>FSL</Text>
          </View>
          <Text style={styles.title}>Floorball Stars Liga</Text>
          <Text style={styles.subtitle}>Přihlas se pro přístup k lize</Text>
        </View>

        {/* Tlačítka */}
        <View style={styles.buttons}>

          {/* Apple Sign In – zobrazí se jen na iOS */}
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={Radius.md}
            style={styles.appleBtn}
            onPress={handleApple}
          />

          {/* Google Sign In */}
          <Pressable style={styles.googleBtn} onPress={handleGoogle} disabled={loading}>
            <Ionicons name="logo-google" size={20} color={Colors.wh} style={{ marginRight: 10 }} />
            <Text style={styles.googleText}>Přihlásit se přes Google</Text>
          </Pressable>

        </View>

        {loading && <ActivityIndicator color={Colors.go} style={{ marginTop: 24 }} />}

        <Text style={styles.legal}>
          Přihlášením souhlasíš s podmínkami FSL a zpracováním osobních údajů.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  inner: { flex: 1, justifyContent: 'center', padding: 32 },
  header: { alignItems: 'center', marginBottom: 48 },
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
  legal: {
    fontSize: Fonts.sizes.xs, color: Colors.di,
    textAlign: 'center', marginTop: 32, lineHeight: 16,
  },
});
