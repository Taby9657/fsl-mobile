import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../store/auth';
import { Colors } from '../constants/colors';

export default function RootLayout() {
  const loadFromStorage = useAuthStore(s => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
        <Stack.Screen name="(auth)"      options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="match/[id]"  options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="player/[id]" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="team/[id]"   options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="referee/[id]"options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen name="onboarding"  options={{ headerShown: false, animation: 'fade' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
