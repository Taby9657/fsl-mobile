// Správa supervisorů – přidělení a odebrání role bez zásahu do backendu
import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { goBack } from '../../utils/navigation';
import { supervisorApi } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { ErrorView } from '../../components/ErrorView';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface UserRow {
  id: string;
  email: string;
  isSupervisor: boolean;
  player?:  { firstName: string; lastName: string; isSupervisor: boolean } | null;
  referee?: { firstName: string; lastName: string } | null;
}

function displayName(u: UserRow) {
  const p = u.player ?? u.referee;
  return p ? `${p.firstName} ${p.lastName}` : 'Bez profilu';
}

export default function SupervisorAdminsScreen() {
  const me = useAuthStore(s => s.user);
  const [users,   setUsers]   = useState<UserRow[]>([]);
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [busyId,  setBusyId]  = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setError(false);
    try {
      const r = await supervisorApi.users(q);
      setUsers(r.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Hledání s prodlevou, ať se neposílá dotaz na každé písmeno
  useEffect(() => {
    const t = setTimeout(() => { setLoading(true); load(query.trim() || undefined); }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function toggle(user: UserRow) {
    const next = !user.isSupervisor;

    const run = async () => {
      setBusyId(user.id);
      try {
        await supervisorApi.setSupervisor(user.id, next);
        setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, isSupervisor: next } : u)));
      } catch (err: any) {
        Alert.alert('Chyba', err?.response?.data?.error ?? 'Roli se nepodařilo změnit');
      } finally {
        setBusyId(null);
      }
    };

    if (next) {
      Alert.alert(
        'Přidat supervisora',
        `${displayName(user)} (${user.email}) získá plný přístup k organizaci ligy — schvalování týmů a rozhodčích, rozlosování, platby i správu dalších supervisorů.`,
        [{ text: 'Zrušit', style: 'cancel' }, { text: 'Přidat', onPress: run }],
      );
    } else {
      Alert.alert(
        'Odebrat supervisora',
        `${displayName(user)} přijde o přístup k organizaci ligy. Ostatní role mu zůstanou.`,
        [{ text: 'Zrušit', style: 'cancel' }, { text: 'Odebrat', style: 'destructive', onPress: run }],
      );
    }
  }

  const supervisors = users.filter(u => u.isSupervisor).length;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Supervisoři</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={Colors.di} />
        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Hledat podle jména nebo e-mailu"
          placeholderTextColor={Colors.di}
          autoCapitalize="none"
          keyboardAppearance="dark"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={Colors.di} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={Colors.pu} size="large" /></View>
      ) : error ? (
        <ErrorView onRetry={() => { setLoading(true); load(query.trim() || undefined); }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListHeaderComponent={
            <Text style={s.lead}>
              Supervisor organizuje ligu — schvaluje týmy a rozhodčí, dělá rozlosování a spravuje
              platby. Roli lze kombinovat s hráčem, vedoucím i rozhodčím.
              {'\n\n'}Aktuálně supervisorů: {supervisors}
            </Text>
          }
          renderItem={({ item }) => {
            const isMe   = item.id === me?.id;
            const busy   = busyId === item.id;
            const active = item.isSupervisor;
            return (
              <View style={[s.row, active && s.rowActive]}>
                <View style={[s.avatar, active && { borderColor: Colors.pu }]}>
                  <Ionicons
                    name={active ? 'star' : 'person'}
                    size={18}
                    color={active ? Colors.pu : Colors.di}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={s.name}>
                    {displayName(item)}{isMe ? ' · ty' : ''}
                  </Text>
                  <Text style={s.email} numberOfLines={1}>{item.email}</Text>
                  {item.player?.isSupervisor && (
                    <Text style={s.legacy}>Historicky supervisor přes hráčský profil</Text>
                  )}
                </View>

                {busy ? (
                  <ActivityIndicator color={Colors.pu} size="small" />
                ) : (
                  <Pressable
                    style={[s.btn, active ? s.btnRemove : s.btnAdd, isMe && active && s.btnDisabled]}
                    onPress={() => toggle(item)}
                    disabled={isMe && active}
                  >
                    <Text style={[s.btnTxt, active ? s.btnTxtRemove : s.btnTxtAdd]}>
                      {active ? (isMe ? 'Ty' : 'Odebrat') : 'Přidat'}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={s.empty}>
              {query ? 'Nikdo takový tu není.' : 'Zatím tu nejsou žádní uživatelé.'}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: Colors.bg },
  header:     { flexDirection: 'row', alignItems: 'center', padding: 16 },
  back:       { width: 40, height: 40, justifyContent: 'center' },
  title:      { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 12, height: 42, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd },
  search:     { flex: 1, color: Colors.wh, fontSize: Fonts.sizes.sm },
  lead:       { fontSize: Fonts.sizes.sm, color: Colors.mu, lineHeight: 19, marginBottom: 16 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 12, marginBottom: 8 },
  rowActive:  { borderColor: `${Colors.pu}66`, backgroundColor: Colors.c2 },
  avatar:     { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: Colors.bd, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center' },
  name:       { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh },
  email:      { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  legacy:     { fontSize: 10, color: Colors.di, marginTop: 3 },
  btn:        { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1 },
  btnAdd:     { backgroundColor: Colors.pu, borderColor: Colors.pu },
  btnRemove:  { backgroundColor: 'transparent', borderColor: `${Colors.red}88` },
  btnDisabled:{ opacity: 0.4, borderColor: Colors.bd },
  btnTxt:     { fontSize: Fonts.sizes.xs, fontWeight: '700' },
  btnTxtAdd:  { color: Colors.wh },
  btnTxtRemove: { color: Colors.red },
  empty:      { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', marginTop: 40 },
});
