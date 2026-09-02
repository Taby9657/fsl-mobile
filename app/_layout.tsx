import '../global.css';
import { useEffect, Component, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text, ScrollView } from 'react-native';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/auth';
import { Colors } from '../constants/colors';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { OfflineBanner } from '../components/OfflineBanner';

// Error boundary – zobrazí JS crash na obrazovce místo černé
class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <View style={{ flex: 1, backgroundColor: '#0D0120', padding: 24, paddingTop: 60 }}>
          <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            🚨 JS Crash
          </Text>
          <ScrollView>
            <Text style={{ color: '#F0E8FF', fontSize: 13, marginBottom: 8 }}>{err.message}</Text>
            <Text style={{ color: '#9B8BC8', fontSize: 11 }}>{err.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

// Sentry inicializace – DSN z EAS env nebo app.json extra
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN
  ?? Constants.expoConfig?.extra?.sentryDsn
  ?? '';

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableNativeFramesTracking: !__DEV__,
  });
}

function PushSetup() {
  usePushNotifications();
  return null;
}

function RootLayout() {
  const loadFromStorage = useAuthStore(s => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <AppErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PushSetup />
      <OfflineBanner />
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)"          options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login"   options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="onboarding"          options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="match/[id]"           options={{ headerShown: false }} />
        <Stack.Screen name="match/[id]/score"    options={{ headerShown: false }} />
        <Stack.Screen name="player/[id]"         options={{ headerShown: false }} />
        <Stack.Screen name="team/[id]"           options={{ headerShown: false }} />
        <Stack.Screen name="referee/[id]"        options={{ headerShown: false }} />
        <Stack.Screen name="team-roster"         options={{ headerShown: false }} />
        <Stack.Screen name="invite-code"         options={{ headerShown: false }} />
        <Stack.Screen name="lineup"              options={{ headerShown: false }} />
        <Stack.Screen name="postmatch"           options={{ headerShown: false }} />
        <Stack.Screen name="payments"            options={{ headerShown: false }} />
        <Stack.Screen name="referee-profile"     options={{ headerShown: false }} />
        <Stack.Screen name="notifications"       options={{ headerShown: false }} />
        <Stack.Screen name="search"              options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="profile-edit"        options={{ headerShown: false }} />
        <Stack.Screen name="heslo"               options={{ headerShown: false }} />
        <Stack.Screen name="pripojit-tym"        options={{ headerShown: false }} />
        <Stack.Screen name="licence"    options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/referees"  options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/matches"   options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/payments"  options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/teams"     options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/league"      options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/leagues"     options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/playoff"     options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/highlights"  options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/requests"    options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/admins"      options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/season"      options={{ headerShown: false }} />
        <Stack.Screen name="draft/[playerId]"        options={{ headerShown: false }} />
        <Stack.Screen name="draft/profile-edit"      options={{ headerShown: false }} />
        <Stack.Screen name="settings"                options={{ headerShown: false }} />
        <Stack.Screen name="favorite-team"           options={{ headerShown: false }} />
        <Stack.Screen name="pozvanka/[code]"         options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="compare"                 options={{ headerShown: false }} />
        <Stack.Screen name="bracket"                 options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

// Sentry wrap — zachytí JS crashe s full stack trace
export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
