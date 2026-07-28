import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useIsManager, useIsReferee, useIsSupervisor } from '../../store/auth';
import { playersApi, supervisorApi, statsApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  route: string;
  color?: string;
}

export default function AdminScreen() {
  const { user, isGuest, refreshUser } = useAuthStore();
  const isManager    = useIsManager();
  const isReferee    = useIsReferee();
  const isSupervisor = useIsSupervisor();
  const logout = useAuthStore(s => s.logout);

  const [myStats, setMyStats]         = useState<any>(null);
  const [leavingTeam, setLeavingTeam] = useState(false);
  const [newSeason, setNewSeason]     = useState('');
  const [seasonBusy, setSeasonBusy]   = useState(false);
  const [currentSeason, setCurrentSeason] = useState<string>('');

  useEffect(() => {
    if (user?.player) {
      playersApi.myStats().then(r => setMyStats(r.data)).catch(() => {});
    }
    if (isSupervisor) {
      statsApi.seasons().then(r => {
        const ss: string[] = r.data ?? [];
        if (ss.length > 0) setCurrentSeason(ss[0]);
      }).catch(() => {});
    }
  }, [user?.player?.id, isSupervisor]);

  function confirmLeaveTeam() {
    Alert.alert(
      'Opustit tým',
      `Opravdu chceš opustit tým ${(user?.player as any)?.team?.name ?? ''}?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Opustit', style: 'destructive',
          onPress: async () => {
            setLeavingTeam(true);
            try {
              await playersApi.leaveTeam(user!.player!.id);
              await refreshUser?.();
              Alert.alert('Hotovo', 'Byl jsi odebrán z týmu.');
            } catch (err: any) {
              Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se opustit tým');
            } finally {
              setLeavingTeam(false);
            }
          },
        },
      ],
    );
  }

  async function startNewSeason(cancelPending: boolean) {
    if (!/^\d{4}\/\d{2}$/.test(newSeason.trim())) {
      Alert.alert('Neplatný formát', 'Zadej sezónu ve formátu "2026/27"'); return;
    }
    setSeasonBusy(true);
    try {
      const res = await supervisorApi.newSeason(newSeason.trim(), cancelPending);
      Alert.alert('Hotovo', res.data.message);
      setNewSeason('');
      setCurrentSeason(newSeason.trim());
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se přepnout sezónu');
    } finally {
      setSeasonBusy(false);
    }
  }

  function confirmNewSeason() {
    Alert.alert(
      'Nová sezóna',
      `Přepnout na sezónu ${newSeason}?\n\nChceš zrušit dosud neplánované zápasy ze staré sezóny?`,
      [
        { text: 'Zrušit', style: 'cancel' },
        { text: 'Zachovat zápasy', onPress: () => startNewSeason(false) },
        { text: 'Zrušit staré zápasy', style: 'destructive', onPress: () => startNewSeason(true) },
      ]
    );
  }

  // Host → přihlašovací wall
  if (isGuest || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={32} color={Colors.go} />
          </View>
          <Text style={styles.emptyTitle}>Přihlas se pro správu</Text>
          <Text style={styles.emptyDesc}>
            Správa ligy, soupisky, platby a další funkce jsou dostupné pouze přihlášeným uživatelům.
          </Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.btnText}>Přihlásit se</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Sekce podle role
  const sections: { title: string; items: MenuItem[] }[] = [];

  // Profil sekce pro hráče
  if (user?.player) {
    sections.push({
      title: 'Můj profil',
      items: [
        { icon: 'person-circle', label: 'Upravit profil',  desc: 'Jméno, telefon, číslo dresu', route: '/profile-edit' },
        { icon: 'card',          label: 'Platby',          desc: 'Licence a poplatky',           route: '/payments' },
        { icon: 'star',          label: 'Draft profil',    desc: 'Zviditelni se pro vedoucí',     route: '/draft/profile-edit' },
      ],
    });
  }

  if (isManager) {
    sections.push({
      title: 'Vedoucí týmu',
      items: [
        { icon: 'people', label: 'Hráči', desc: 'Soupiska, pozvánkový kód', route: '/team-roster' },
        { icon: 'qr-code', label: 'Pozvánkový kód', desc: 'Sdílej s hráči', route: '/invite-code' },
        { icon: 'document-text', label: 'Soupisky', desc: 'Odeslání před zápasem', route: '/lineup' },
        { icon: 'clipboard', label: 'Po-zápasový formulář', desc: 'MVP, rating rozhodčího', route: '/postmatch' },
        { icon: 'card', label: 'Platby', desc: 'Licence, domácí zápas', route: '/payments' },
      ],
    });
  }

  if (isReferee) {
    sections.push({
      title: 'Rozhodčí',
      items: [
        { icon: 'calendar', label: 'Moje nasazení', desc: 'Nadcházející zápasy', route: `/referee/${user?.referee?.id}` },
        { icon: 'person', label: 'Můj profil', desc: 'HR údaje, bankovní spojení', route: '/referee-profile' },
      ],
    });
  }

  if (isSupervisor) {
    sections.push({
      title: 'Supervisor',
      items: [
        { icon: 'stats-chart', label: 'Dashboard', desc: 'Přehled celé ligy', route: '/supervisor/dashboard', color: Colors.pu },
        { icon: 'person-add', label: 'Rozhodčí ke schválení', desc: 'Čekající registrace', route: '/supervisor/referees', color: Colors.pu },
        { icon: 'football', label: 'Správa zápasů', desc: 'Přiřazení rozhodčích', route: '/supervisor/matches', color: Colors.pu },
        { icon: 'cash',         label: 'Platby',          desc: 'Přehled a ruční sync',          route: '/supervisor/payments', color: Colors.pu },
        { icon: 'shield',       label: 'Správa týmů',     desc: 'Přidání, editace, smazání týmů', route: '/supervisor/teams',    color: Colors.pu },
        { icon: 'git-branch',   label: 'Rozlosování',     desc: 'Generování rozpisu zápasů',      route: '/supervisor/league',      color: Colors.pu },
        { icon: 'newspaper',    label: 'Highlights kola', desc: 'Aktuality viditelné na home screen', route: '/supervisor/highlights', color: Colors.pu },
      ],
    });
  }

  // Pokud nemá žádnou roli → onboarding
  if (!isManager && !isReferee && sections.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Nemáš přiřazenou roli</Text>
          <Text style={styles.emptyDesc}>Připoj se k týmu pomocí pozvánkového kódu nebo se zaregistruj jako rozhodčí.</Text>
          <Pressable style={styles.btn} onPress={() => router.push('/onboarding')}>
            <Text style={styles.btnText}>Začít registraci</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Správa</Text>

        {/* Moje statistiky (jen pro hráče) */}
        {user?.player && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Moje statistiky</Text>
            <View style={[styles.card, { flexDirection: 'row' }]}>
              {myStats ? (
                <>
                  <StatBox label="Góly"      value={myStats.goals ?? 0} />
                  <StatBox label="Asistence" value={myStats.assists ?? 0} />
                  <StatBox label="Body"      value={(myStats.goals ?? 0) + (myStats.assists ?? 0)} />
                  <StatBox label="MVP"       value={myStats.mvpVotes ?? 0} last />
                </>
              ) : (
                <View style={{ flex: 1, alignItems: 'center', padding: 20 }}>
                  <ActivityIndicator color={Colors.go} size="small" />
                </View>
              )}
            </View>
          </View>
        )}

        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.card}>
              {section.items.map((item, idx) => (
                <Pressable
                  key={item.route}
                  style={[styles.item, idx < section.items.length - 1 && styles.itemBorder]}
                  onPress={() => router.push(item.route as any)}
                >
                  <View style={[styles.iconBox, { backgroundColor: `${item.color ?? Colors.go}22` }]}>
                    <Ionicons name={item.icon} size={18} color={item.color ?? Colors.go} />
                  </View>
                  <View style={styles.itemText}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.di} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Opustit tým (jen pro hráče kteří mají tým) */}
        {user?.player?.team && (
          <Pressable
            style={[styles.leaveBtn, leavingTeam && { opacity: 0.5 }]}
            onPress={confirmLeaveTeam}
            disabled={leavingTeam}
          >
            {leavingTeam
              ? <ActivityIndicator color={Colors.red} size="small" />
              : <>
                  <Ionicons name="exit-outline" size={18} color={Colors.red} />
                  <Text style={styles.leaveTxt}>Opustit tým</Text>
                </>
            }
          </Pressable>
        )}

        {/* Nová sezóna (jen supervisor) */}
        {isSupervisor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sezóna</Text>
            <View style={[styles.card, { padding: 14 }]}>
              {currentSeason ? (
                <Text style={{ fontSize: Fonts.sizes.xs, color: Colors.mu, marginBottom: 10 }}>
                  Aktuální sezóna: <Text style={{ color: Colors.go, fontWeight: '700' }}>{currentSeason}</Text>
                </Text>
              ) : null}
              <Text style={{ fontSize: Fonts.sizes.xs, color: Colors.mu, marginBottom: 8 }}>
                Nová sezóna (formát 2026/27)
              </Text>
              <TextInput
                style={styles.seasonInput}
                value={newSeason}
                onChangeText={setNewSeason}
                placeholder="2026/27"
                placeholderTextColor={Colors.di}
                keyboardAppearance="dark"
                autoCapitalize="none"
              />
              <Pressable
                style={[styles.seasonBtn, (!newSeason || seasonBusy) && { opacity: 0.4 }]}
                onPress={confirmNewSeason}
                disabled={!newSeason || seasonBusy}
              >
                {seasonBusy
                  ? <ActivityIndicator color={Colors.bg} size="small" />
                  : <Text style={styles.seasonBtnTxt}>Spustit novou sezónu</Text>
                }
              </Pressable>
            </View>
          </View>
        )}

        {/* Odhlásit */}
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Odhlásit se</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <View style={[statS.box, !last && statS.border]}>
      <Text style={statS.val}>{value}</Text>
      <Text style={statS.lbl}>{label}</Text>
    </View>
  );
}
const statS = StyleSheet.create({
  box:    { flex: 1, alignItems: 'center', paddingVertical: 14 },
  border: { borderRightWidth: 1, borderRightColor: '#ffffff15' },
  val:    { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.go },
  lbl:    { fontSize: 10, color: Colors.mu, marginTop: 3 },
});

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: Colors.bg },
  title:        { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh, marginBottom: 16 },
  section:      { marginBottom: 20 },
  sectionTitle: { fontSize: Fonts.sizes.sm, color: Colors.mu, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card:         { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, overflow: 'hidden' },
  item:         { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  itemBorder:   { borderBottomWidth: 1, borderBottomColor: Colors.bd },
  iconBox:      { width: 36, height: 36, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' },
  itemText:     { flex: 1 },
  itemLabel:    { fontSize: Fonts.sizes.md, fontWeight: '600', color: Colors.wh },
  itemDesc:     { fontSize: Fonts.sizes.xs, color: Colors.mu, marginTop: 2 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  lockIcon:     {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: `${Colors.go}22`, justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  emptyTitle:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 8, textAlign: 'center' },
  emptyDesc:    { fontSize: Fonts.sizes.sm, color: Colors.mu, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  btn:          { backgroundColor: Colors.go, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  btnText:      { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  leaveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.red, borderRadius: Radius.md, padding: 14, marginTop: 8 },
  leaveTxt:     { fontSize: Fonts.sizes.md, color: Colors.red, fontWeight: '600' },
  logoutBtn:    { borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 8 },
  logoutText:   { fontSize: Fonts.sizes.md, color: Colors.mu, fontWeight: '600' },
  seasonInput:  { backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.sm, padding: 12, color: Colors.wh, fontSize: Fonts.sizes.md, marginBottom: 10 },
  seasonBtn:    { backgroundColor: Colors.pu, borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  seasonBtnTxt: { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.white },
});
