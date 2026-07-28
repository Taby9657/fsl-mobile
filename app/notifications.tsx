import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Alert, RefreshControl,
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

type NotifGroup = { label: string; items: Notif[] };

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

function groupByDate(notifs: Notif[]): NotifGroup[] {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yest  = today - 86_400_000;
  const week  = today - 6 * 86_400_000;

  const groups: Record<string, Notif[]> = { Dnes: [], Včera: [], 'Tento týden': [], Starší: [] };
  for (const n of notifs) {
    const t = new Date(n.createdAt).getTime();
    if (t >= today)      groups['Dnes'].push(n);
    else if (t >= yest)  groups['Včera'].push(n);
    else if (t >= week)  groups['Tento týden'].push(n);
    else                 groups['Starší'].push(n);
  }
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

// Ikona podle obsahu notifikace
function notifIcon(title: string, body: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  const t = (title + body).toLowerCase();
  if (t.includes('gól') || t.includes('skóre') || t.includes('zápas začal') || t.includes('live'))
    return { name: 'football',         color: Colors.go };
  if (t.includes('platb') || t.includes('licenc') || t.includes('poplatek'))
    return { name: 'card',             color: '#22C55E' };
  if (t.includes('schválen') || t.includes('schválena'))
    return { name: 'checkmark-circle', color: '#22C55E' };
  if (t.includes('zamítnut') || t.includes('zamítnuta'))
    return { name: 'close-circle',     color: Colors.red };
  if (t.includes('zápas ukončen') || t.includes('postmatch') || t.includes('formulář'))
    return { name: 'clipboard',        color: Colors.pu };
  if (t.includes('rozhodčí') || t.includes('nasazen'))
    return { name: 'whistle' as any,   color: Colors.mu };
  if (t.includes('draft') || t.includes('nabídka'))
    return { name: 'star',             color: Colors.go };
  return { name: 'notifications',      color: Colors.mu };
}

export default function NotificationsScreen() {
  const [loading, setLoading]   = useState(true);
  const [refresh, setRefresh]   = useState(false);
  const [notifs, setNotifs]     = useState<Notif[]>([]);
  const [marking, setMarking]   = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await notificationsApi.list();
      setNotifs(res.data);
    } catch {
      if (!isRefresh) Alert.alert('Chyba', 'Nepodařilo se načíst oznámení');
    } finally {
      setLoading(false);
      setRefresh(false);
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
  const groups = groupByDate(notifs);

  function renderNotif(item: Notif) {
    const { name: iconName, color: iconColor } = notifIcon(item.title, item.body);
    return (
      <Pressable
        key={item.id}
        style={[s.item, !item.read && s.itemUnread]}
        onPress={() => {
          if (!item.read) markRead(item.id);
          if (item.screen) router.push(item.screen as any);
        }}
      >
        {/* Ikona typu */}
        <View style={[s.iconBox, { backgroundColor: `${iconColor}22` }]}>
          <Ionicons name={iconName} size={16} color={iconColor} />
        </View>
        {/* Obsah */}
        <View style={{ flex: 1 }}>
          <View style={s.itemTop}>
            <Text style={[s.itemTitle, !item.read && { color: Colors.wh }]} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={s.itemTime}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={s.itemBody} numberOfLines={2}>{item.body}</Text>
        </View>
        {/* Nepřečtená tečka */}
        {!item.read && <View style={s.dot} />}
        {item.screen && (
          <Ionicons name="chevron-forward" size={14} color={Colors.di} />
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
            <ScrollView
              contentContainerStyle={{ paddingVertical: 8 }}
              refreshControl={<RefreshControl refreshing={refresh} onRefresh={() => { setRefresh(true); load(true); }} tintColor={Colors.go} />}
            >
              {groups.map(group => (
                <View key={group.label}>
                  <Text style={s.groupLabel}>{group.label}</Text>
                  {group.items.map((item, idx) => (
                    <View key={item.id}>
                      {renderNotif(item)}
                      {idx < group.items.length - 1 && <View style={s.sep} />}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
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
  groupLabel:  { fontSize: Fonts.sizes.xs, color: Colors.di, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  item:        { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  itemUnread:  { backgroundColor: `${Colors.go}08` },
  iconBox:     { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  dot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.go, flexShrink: 0, marginTop: 4 },
  itemTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  itemTitle:   { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.mu, flex: 1 },
  itemTime:    { fontSize: Fonts.sizes.xs, color: Colors.di, flexShrink: 0 },
  itemBody:    { fontSize: Fonts.sizes.sm, color: Colors.mu, marginTop: 3, lineHeight: 18 },
  sep:         { height: 1, backgroundColor: Colors.bd, marginLeft: 60 },
});
