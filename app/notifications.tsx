import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { goBack } from '../utils/navigation';
import { Ionicons } from '@expo/vector-icons';
import { notificationsApi } from '../services/api';
import { Colors, Fonts, Radius } from '../constants/colors';

interface Notif {
  id: string;
  title: string;
  body: string;
  screen: string | null;
  read: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'Právě teď';
  if (mins  < 60) return `před ${mins} min`;
  if (hours < 24) return `před ${hours} h`;
  return `před ${days} d`;
}

export default function NotificationsScreen() {
  const [loading, setLoading]   = useState(true);
  const [notifs, setNotifs]     = useState<Notif[]>([]);
  const [marking, setMarking]   = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.list();
      setNotifs(res.data);
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se načíst oznámení');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  async function markRead(id: string) {
    try {
      await notificationsApi.read(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {}
  }

  async function markAll() {
    setMarking(true);
    try {
      await notificationsApi.readAll();
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      Alert.alert('Chyba', 'Nepodařilo se označit oznámení');
    } finally {
      setMarking(false);
    }
  }

  const unreadCount = notifs.filter(n => !n.read).length;

  function renderItem({ item }: { item: Notif }) {
    return (
      <Pressable
        style={[s.item, !item.read && s.itemUnread]}
        onPress={() => {
          if (!item.read) markRead(item.id);
          if (item.screen) router.push(item.screen as any);
        }}
      >
        <View style={[s.dot, { opacity: item.read ? 0 : 1 }]} />
        <View style={{ flex: 1 }}>
          <View style={s.itemTop}>
            <Text style={[s.itemTitle, !item.read && { color: Colors.wh }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={s.itemTime}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={s.itemBody} numberOfLines={2}>{item.body}</Text>
        </View>
        {item.screen && (
          <Ionicons name="chevron-forward" size={14} color={Colors.di} style={{ marginLeft: 8 }} />
        )}
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Hlavička */}
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>
          Oznámení{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Text>
        <Pressable
          style={[s.markAllBtn, (marking || unreadCount === 0) && { opacity: 0.4 }]}
          onPress={markAll}
          disabled={marking || unreadCount === 0}
        >
          {marking
            ? <ActivityIndicator color={Colors.go} size="small" />
            : <Text style={s.markAllText}>Vše přečteno</Text>
          }
        </Pressable>
      </View>

      {loading
        ? <View style={s.center}><ActivityIndicator color={Colors.go} /></View>
        : notifs.length === 0
          ? (
            <View style={s.center}>
              <Ionicons name="notifications-off-outline" size={52} color={Colors.mu} />
              <Text style={s.emptyTitle}>Žádná oznámení</Text>
              <Text style={s.emptyDesc}>Zde se zobrazí novinky, potvrzení plateb a zprávy od supervizora.</Text>
            </View>
          )
          : (
            <FlatList
              data={notifs}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={s.sep} />}
              contentContainerStyle={{ paddingVertical: 8 }}
            />
          )
      }
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: Colors.bg },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:        { width: 40, height: 40, justifyContent: 'center' },
  title:       { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  markAllBtn:  { minWidth: 80, alignItems: 'flex-end' },
  markAllText: { fontSize: Fonts.sizes.xs, color: Colors.go, fontWeight: '600' },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyTitle:  { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh },
  emptyDesc:   { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', lineHeight: 20 },
  item:        { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  itemUnread:  { backgroundColor: `${Colors.go}08` },
  dot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.go, marginTop: 5, flexShrink: 0 },
  itemTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  itemTitle:   { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.mu, flex: 1 },
  itemTime:    { fontSize: Fonts.sizes.xs, color: Colors.di, flexShrink: 0 },
  itemBody:    { fontSize: Fonts.sizes.sm, color: Colors.mu, marginTop: 3, lineHeight: 18 },
  sep:         { height: 1, backgroundColor: Colors.bd, marginLeft: 34 },
});
