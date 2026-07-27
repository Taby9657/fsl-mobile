import { Stack } from 'expo-router';
import { Colors } from '../../constants/colors';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: Colors.bg },
      animation: 'slide_from_right',
    }}>
      <Stack.Screen name="complete" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
