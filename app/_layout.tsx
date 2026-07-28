import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/auth';
import { Colors } from '../constants/colors';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { OfflineBanner } from '../components/OfflineBanner';

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
        <Stack.Screen name="supervisor/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/referees"  options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/matches"   options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/payments"  options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/teams"     options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/league"      options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/highlights"  options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/requests"    options={{ headerShown: false }} />
        <Stack.Screen name="draft/[playerId]"        options={{ headerShown: false }} />
        <Stack.Screen name="draft/profile-edit"      options={{ headerShown: false }} />
        <Stack.Screen name="settings"                options={{ headerShown: false }} />
        <Stack.Screen name="compare"                 options={{ headerShown: false }} />
        <Stack.Screen name="bracket"                 options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

// Sentry wrap — zachytí JS crashe s full stack trace
export default SENTRY_DSN ? Sentry.wrap(RootLayout) : RootLayout;
