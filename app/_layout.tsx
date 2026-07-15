import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../store/auth';
import { Colors } from '../constants/colors';
import { usePushNotifications } from '../hooks/usePushNotifications';

function PushSetup() {
  usePushNotifications();
  return null;
}

export default function RootLayout() {
  const loadFromStorage = useAuthStore(s => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PushSetup />
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
        <Stack.Screen name="onboarding/complete" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
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
        <Stack.Screen name="profile-edit"        options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/referees"  options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/matches"   options={{ headerShown: false }} />
        <Stack.Screen name="supervisor/payments"  options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
