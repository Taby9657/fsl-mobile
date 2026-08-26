import { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useIsSupervisor, useIsReferee } from '../../store/auth';
import { useFanStore } from '../../store/fan';
import { Colors } from '../../constants/colors';

export default function TabLayout() {
  const { user, isGuest, loading } = useAuthStore();
  const { isFan, hydrated: fanHydrated, load: loadFan, setFan } = useFanStore();

  useEffect(() => { loadFan(); }, []);

  const hasProfile = !!(user?.player || user?.referee || (user?.manager && user.manager.length > 0));

  // Jakmile uživateli vznikne skutečná role, fanouškovský příznak už nemá smysl
  useEffect(() => {
    if (hasProfile && isFan) setFan(false);
  }, [hasProfile, isFan]);

  if (loading || !fanHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg }}>
        <ActivityIndicator color={Colors.go} size="large" />
      </View>
    );
  }

  // Ani přihlášený, ani host → login
  if (!user && !isGuest) return <Redirect href="/(auth)/login" />;

  // Přihlášený, bez profilu a bez zvoleného fanouškovského režimu → onboarding
  if (user && !hasProfile && !isFan) return <Redirect href="/onboarding" />;

  // Fanoušek bez role nemá co dělat v draftu — je jen pro hráče a vedoucí
  const showDraft = !user || hasProfile;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.c1,
          borderTopColor:  Colors.bd,
          borderTopWidth:  1,
          paddingBottom:   4,
          height:          60,
        },
        tabBarActiveTintColor:   Colors.go,
        tabBarInactiveTintColor: Colors.di,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Domů',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Zápasy',
          tabBarIcon: ({ color, size }) => <Ionicons name="football" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="table"
        options={{
          title: 'Tabulka',
          tabBarIcon: ({ color, size }) => <Ionicons name="podium" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Statistiky',
          tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="draft"
        options={{
          title: 'Draft',
          href: showDraft ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Správa',
          tabBarIcon: ({ color, size }) => <Ionicons name="shield" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
