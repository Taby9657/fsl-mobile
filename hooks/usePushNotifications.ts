import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { pushApi } from '../services/api';
import { useAuthStore } from '../store/auth';

// Lazy import aby nehavaroval v dev buildu bez native modulu
let Notifications: typeof import('expo-notifications') | null = null;
try {
  Notifications = require('expo-notifications');
  Notifications!.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
    }),
  });
} catch {
  // Native modul není dostupný v tomto dev buildu
  // Funguje po eas build --profile development
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name:       'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'c0ac3a9d-1c19-4b22-b4cf-f0fd29e535af',
    });
    return token.data;
  } catch {
    return null;
  }
}

export function usePushNotifications() {
  const { user } = useAuthStore();
  const notifListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (!user || !Notifications) return;

    registerForPushNotifications()
      .then(token => { if (token) pushApi.saveToken(token).catch(() => {}); })
      .catch(() => {});

    notifListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      if (screen) { try { router.push(`/${screen}` as any); } catch {} }
    });

    return () => {
      if (notifListener.current)    Notifications!.removeNotificationSubscription(notifListener.current);
      if (responseListener.current) Notifications!.removeNotificationSubscription(responseListener.current);
    };
  }, [user?.id]);
}
