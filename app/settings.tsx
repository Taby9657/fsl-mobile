import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { goBack } from '../utils/navigation';
import { useAuthStore, useIsManager, useIsReferee, useIsSupervisor } from '../store/auth';
import { useFanStore } from '../store/fan';
import { Colors, Fonts, Radius } from '../constants/colors';
import { cacheClearAll, cacheSize } from '../utils/cache';
import { authApi } from '../services/api';

const NOTIF_KEY = 'fsl_notif_prefs';

interface NotifPrefs {
  matchStart: boolean;
  matchResult: boolean;
  drafts: boolean;
  refereeApproval: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  matchStart:      true,
  matchResult:     true,
  drafts:          true,
  refereeApproval: true,
};

function SectionHeader({ label }: { label: string }) {
  return <Text style={s.sectionHeader}>{label}</Text>;
}

function SettingRow({ icon, label, description, right, onPress }: {
  icon: string; label: string; description?: string;
  right?: React.ReactNode; onPress?: () => void;
}) {
  return (
    <Pressable
      style={s.row}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={s.rowIcon}>
        <Ionicons name={icon as any} size={18} color={Colors.go} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {description ? <Text style={s.rowDesc}>{description}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuthStore();
  const favTeamId    = useFanStore(s => s.favTeamId);
  const isManager    = useIsManager();
  const isReferee    = useIsReferee();
  const isSupervisor = useIsSupervisor();

  // Verze z app.json — dřív tu bylo natvrdo "1.0.0", což při ladění mátlo
  const appVersion = Constants.expoConfig?.version ?? '—';

  const roles = [
    user?.player   && 'Hráč',
    isManager      && 'Vedoucí týmu',
    isReferee      && 'Rozhodčí',
    isSupervisor   && 'Supervisor',
  ].filter(Boolean) as string[];
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [cacheCount, setCacheCount] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then(raw => {
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    }).catch(() => {});
    cacheSize().then(setCacheCount);
  }, []);

  function togglePref(key: keyof NotifPrefs) {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  async function handleClearCache() {
    await cacheClearAll();
    setCacheCount(0);
    Alert.alert('Hotovo', 'Cache byla vymazána.');
  }

  function handleLogout() {
    Alert.alert(
      'Odhlásit se',
      'Opravdu se chceš odhlásit?',
      [
        { text: 'Zrušit', style: 'cancel' },
        { text: 'Odhlásit', style: 'destructive', onPress: () => { logout(); router.replace('/(auth)/login' as any); } },
      ]
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Smazat účet',
      'Opravdu chceš smazat svůj účet? Tato akce je nevratná – všechna tvá data budou trvale odstraněna.',
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat účet',
          style: 'destructive',
          onPress: async () => {
            try {
              await authApi.deleteAccount();
              logout();
              router.replace('/(auth)/login' as any);
            } catch {
              Alert.alert('Chyba', 'Účet se nepodařilo smazat. Zkus to znovu.');
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => goBack()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color={Colors.wh} />
        </Pressable>
        <Text style={s.title}>Nastavení</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView>
        {/* Profil */}
        {user && (
          <>
            <SectionHeader label="Účet" />
            <View style={s.card}>
              <View style={s.profileRow}>
                <View style={s.avatar}>
                  <Text style={s.avatarLetter}>
                    {(user.player?.firstName ?? user.referee?.firstName ?? user.email ?? '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.profileName}>
                    {user.player
                      ? `${user.player.firstName} ${user.player.lastName}`
                      : user.referee
                        ? `${user.referee.firstName} ${user.referee.lastName}`
                        : 'Uživatel'}
                  </Text>
                  <Text style={s.profileEmail}>{user.email}</Text>
                </View>
                <View style={s.roleBadge}>
                  <Text style={s.roleTxt}>
                    {isSupervisor ? 'Supervisor' : user.player ? 'Hráč' : user.referee ? 'Rozhodčí' : user.manager?.length ? 'Manažer' : 'Fanoušek'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* Sledování */}
        {user && (
          <>
            <SectionHeader label="Sledování" />
            <View style={s.card}>
              <SettingRow
                icon="heart-outline"
                label="Oblíbený tým"
                description={favTeamId ? 'Zobrazuje se na domovské obrazovce' : 'Zatím nevybraný'}
                right={<Ionicons name="chevron-forward" size={16} color={Colors.di} />}
                onPress={() => router.push('/favorite-team' as any)}
              />
              <View style={s.divider} />
              <SettingRow
                icon="person-add-outline"
                label="Role v lize"
                description={roles.length ? roles.join(' · ') : 'Zatím žádná — jsi fanoušek'}
                right={<Ionicons name="chevron-forward" size={16} color={Colors.di} />}
                onPress={() => router.push('/(tabs)/admin' as any)}
              />
            </View>
          </>
        )}

        {/* Notifikace */}
        <SectionHeader label="Notifikace" />
        <View style={s.card}>
          <SettingRow
            icon="football-outline"
            label="Začátek zápasu"
            description="Notifikace při spuštění LIVE"
            right={
              <Switch
                value={prefs.matchStart}
                onValueChange={() => togglePref('matchStart')}
                trackColor={{ false: Colors.c2, true: `${Colors.go}88` }}
                thumbColor={prefs.matchStart ? Colors.go : Colors.mu}
              />
            }
          />
          <View style={s.divider} />
          <SettingRow
            icon="trophy-outline"
            label="Výsledek zápasu"
            description="Po skončení zápasu"
            right={
              <Switch
                value={prefs.matchResult}
                onValueChange={() => togglePref('matchResult')}
                trackColor={{ false: Colors.c2, true: `${Colors.go}88` }}
                thumbColor={prefs.matchResult ? Colors.go : Colors.mu}
              />
            }
          />
          <View style={s.divider} />
          <SettingRow
            icon="person-outline"
            label="Drafty"
            description="Nové draft nabídky"
            right={
              <Switch
                value={prefs.drafts}
                onValueChange={() => togglePref('drafts')}
                trackColor={{ false: Colors.c2, true: `${Colors.go}88` }}
                thumbColor={prefs.drafts ? Colors.go : Colors.mu}
              />
            }
          />
          <View style={s.divider} />
          <SettingRow
            icon="checkmark-circle-outline"
            label="Schválení rozhodčího"
            description="Změna stavu registrace"
            right={
              <Switch
                value={prefs.refereeApproval}
                onValueChange={() => togglePref('refereeApproval')}
                trackColor={{ false: Colors.c2, true: `${Colors.go}88` }}
                thumbColor={prefs.refereeApproval ? Colors.go : Colors.mu}
              />
            }
          />
        </View>

        {/* Data */}
        <SectionHeader label="Data" />
        <View style={s.card}>
          <SettingRow
            icon="cube-outline"
            label="Vymazat cache"
            description={cacheCount > 0 ? `${cacheCount} položek v cache` : 'Cache je prázdná'}
            right={<Ionicons name="chevron-forward" size={16} color={Colors.di} />}
            onPress={handleClearCache}
          />
        </View>

        {/* Aplikace */}
        <SectionHeader label="Aplikace" />
        <View style={s.card}>
          <SettingRow
            icon="information-circle-outline"
            label="Verze aplikace"
            right={<Text style={s.valueText}>{appVersion}</Text>}
          />
          <View style={s.divider} />
          <SettingRow
            icon="shield-outline"
            label="Ochrana osobních údajů"
            right={<Ionicons name="chevron-forward" size={16} color={Colors.di} />}
            onPress={() => {}}
          />
        </View>

        {/* Odhlásit */}
        {user && (
          <Pressable style={s.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={Colors.red} />
            <Text style={s.logoutTxt}>Odhlásit se</Text>
          </Pressable>
        )}

        {/* Smazat účet */}
        {user && (
          <Pressable style={s.deleteBtn} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={18} color="#ff3b30" />
            <Text style={s.deleteTxt}>Smazat účet</Text>
          </Pressable>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back:    { width: 40, height: 40, justifyContent: 'center' },
  title:   { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.wh, flex: 1, textAlign: 'center' },

  sectionHeader: {
    fontSize: Fonts.sizes.xs, fontWeight: '700', color: Colors.mu,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginHorizontal: 16, marginTop: 20, marginBottom: 8,
  },
  card:    { marginHorizontal: 16, backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  divider: { height: 1, backgroundColor: Colors.bd, marginLeft: 56 },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.c2, borderWidth: 2, borderColor: Colors.go, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.go },
  profileName:  { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  profileEmail: { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  roleBadge:    { backgroundColor: `${Colors.go}22`, borderRadius: 8, borderWidth: 1, borderColor: `${Colors.go}44`, paddingHorizontal: 8, paddingVertical: 4 },
  roleTxt:      { fontSize: 11, fontWeight: '700', color: Colors.go },

  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowIcon:  { width: 32, height: 32, borderRadius: 8, backgroundColor: `${Colors.go}18`, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { fontSize: Fonts.sizes.sm, fontWeight: '600', color: Colors.wh },
  rowDesc:  { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  valueText:{ fontSize: Fonts.sizes.sm, color: Colors.mu },

  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, marginTop: 24, marginBottom: 0, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: `${Colors.red}44`, backgroundColor: `${Colors.red}11` },
  logoutTxt:  { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.red },
  deleteBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: Radius.md, borderWidth: 1, borderColor: '#ff3b3066', backgroundColor: '#ff3b3018' },
  deleteTxt:  { fontSize: Fonts.sizes.sm, fontWeight: '700', color: '#ff3b30' },
});
