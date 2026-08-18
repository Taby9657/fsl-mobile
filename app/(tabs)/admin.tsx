import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useIsManager, useIsReferee, useIsSupervisor, type ActiveRole } from '../../store/auth';
import { playersApi, supervisorApi, statsApi, teamsApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
  route: string;
  color?: string;
}

const ROLE_TABS: { id: ActiveRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'all',        label: 'Vše',       icon: 'apps'         },
  { id: 'player',     label: 'Hráč',      icon: 'person'       },
  { id: 'manager',    label: 'Vedoucí',   icon: 'shield'       },
  { id: 'referee',    label: 'Rozhodčí',  icon: 'flag'         },
  { id: 'supervisor', label: 'Supervisor', icon: 'star'        },
];

export default function AdminScreen() {
  const { user, isGuest, refreshUser, activeRole, setActiveRole } = useAuthStore();
  const isManager    = useIsManager();
  const isReferee    = useIsReferee();
  const isSupervisor = useIsSupervisor();
  const logout = useAuthStore(s => s.logout);

  const [myStats, setMyStats]           = useState<any>(null);
  const [leavingTeam, setLeavingTeam]   = useState(false);
  const [newSeason, setNewSeason]       = useState('');
  const [seasonBusy, setSeasonBusy]     = useState(false);
  const [currentSeason, setCurrentSeason] = useState<string>('');
  const [teamDetail, setTeamDetail]     = useState<any>(null);
  const [appealText, setAppealText]     = useState('');
  const [appealBusy, setAppealBusy]     = useState(false);
  const [appealModal, setAppealModal]   = useState(false);

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
    // Načti detail týmu vedoucího (kvůli regStatus)
    const managedTeamId = user?.manager?.[0]?.teamId;
    if (isManager && managedTeamId) {
      teamsApi.get(managedTeamId).then(r => setTeamDetail(r.data)).catch(() => {});
    }
  }, [user?.player?.id, isSupervisor, isManager]);

  async function submitAppeal() {
    if (!appealText.trim()) { Alert.alert('Chyba', 'Zadej text odvolání'); return; }
    if (!teamDetail?.id) return;
    setAppealBusy(true);
    try {
      const r = await teamsApi.appeal(teamDetail.id, appealText.trim());
      setTeamDetail(r.data);
      setAppealModal(false);
      setAppealText('');
      Alert.alert('Odesláno', 'Odvolání bylo odesláno supervisorovi.');
    } catch (err: any) {
      Alert.alert('Chyba', err?.response?.data?.error ?? 'Nepodařilo se odeslat odvolání');
    } finally {
      setAppealBusy(false);
    }
  }

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
  const allSections: { id: ActiveRole; title: string; items: MenuItem[] }[] = [];

  // Profil sekce pro hráče
  if (user?.player) {
    allSections.push({
      id: 'player',
      title: 'Můj profil',
      items: [
        { icon: 'person-circle', label: 'Upravit profil',  desc: 'Jméno, telefon, číslo dresu', route: '/profile-edit' },
        { icon: 'card',          label: 'Platby',          desc: 'Licence a poplatky',           route: '/payments' },
        { icon: 'star',          label: 'Draft profil',    desc: 'Zviditelni se pro vedoucí',     route: '/draft/profile-edit' },
      ],
    });
  }

  if (isManager) {
    allSections.push({
      id: 'manager',
      title: 'Vedoucí týmu',
      items: [
        { icon: 'people',          label: 'Hráči',                 desc: 'Soupiska, pozvánkový kód',       route: '/team-roster'  },
        { icon: 'qr-code',         label: 'Pozvánkový kód',        desc: 'Sdílej s hráči',                 route: '/invite-code'  },
        { icon: 'document-text',   label: 'Soupisky',              desc: 'Odeslání před zápasem',          route: '/lineup'       },
        { icon: 'clipboard',       label: 'Po-zápasový formulář',  desc: 'MVP, rating rozhodčího',         route: '/postmatch'    },
        { icon: 'card',            label: 'Platby',                desc: 'Licence, domácí zápas',          route: '/payments'     },
      ],
    });
  }

  if (isReferee) {
    allSections.push({
      id: 'referee',
      title: 'Rozhodčí',
      items: [
        { icon: 'calendar', label: 'Moje nasazení', desc: 'Nadcházející zápasy', route: `/referee/${user?.referee?.id}` },
        { icon: 'person', label: 'Můj profil', desc: 'HR údaje, bankovní spojení', route: '/referee-profile' },
      ],
    });
  }

  if (isSupervisor) {
    allSections.push({
      id: 'supervisor',
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

  // Filtrování podle activeRole (jen pro supervisora)
  const sections = isSupervisor && activeRole !== 'all'
    ? allSections.filter(s => s.id === activeRole)
    : allSections;

  // Pokud nemá žádnou roli → onboarding
  if (!isManager && !isReferee && allSections.length === 0) {
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

        {/* Role switcher – jen pro supervisora */}
        {isSupervisor && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 20, marginHorizontal: -4 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
          >
            {ROLE_TABS.map(tab => {
              const active = activeRole === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.roleChip, active && styles.roleChipActive]}
                  onPress={() => setActiveRole(tab.id)}
                >
                  <Ionicons
                    name={tab.icon}
                    size={14}
                    color={active ? Colors.bg : Colors.mu}
                  />
                  <Text style={[styles.roleChipTxt, active && styles.roleChipTxtActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Moje statistiky (jen pro hráče + hráčský nebo all pohled) */}
        {user?.player && (activeRole === 'all' || activeRole === 'player') && (
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

        {/* Registrační status – jen pro manažera */}
        {isManager && teamDetail && (activeRole === 'all' || activeRole === 'manager') && (
          <RegStatusBanner
            team={teamDetail}
            onAppeal={() => { setAppealText(''); setAppealModal(true); }}
          />
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

        {/* Nastavení */}
        <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings' as any)}>
          <Ionicons name="settings-outline" size={16} color={Colors.mu} />
          <Text style={styles.logoutText}>Nastavení</Text>
        </Pressable>

        {/* Odhlásit */}
        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Odhlásit se</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal – odvolání vedoucího */}
      <Modal visible={appealModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={styles.backdrop} onPress={() => setAppealModal(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Odvolání registrace</Text>
            <Text style={{ fontSize: Fonts.sizes.xs, color: Colors.mu, marginBottom: 12 }}>
              Vysvětli, proč by měl být tým přijat do ligy. Odvolání bude odesláno supervisorovi.
            </Text>
            <TextInput
              style={[styles.appealInput, { height: 100, textAlignVertical: 'top' }]}
              value={appealText}
              onChangeText={setAppealText}
              placeholder="Napiš odvolání..."
              placeholderTextColor={Colors.di}
              keyboardAppearance="dark"
              multiline
            />
            <Pressable
              style={[styles.appealBtn, appealBusy && { opacity: 0.5 }]}
              onPress={submitAppeal}
              disabled={appealBusy}
            >
              {appealBusy
                ? <ActivityIndicator color={Colors.bg} size="small" />
                : <Text style={styles.appealBtnTxt}>Odeslat odvolání</Text>
              }
            </Pressable>
            <View style={{ height: 16 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Registrační status banner pro vedoucího ───────────────────────────────
function RegStatusBanner({ team, onAppeal }: { team: any; onAppeal: () => void }) {
  const rs: string = team.regStatus ?? 'APPROVED';
  if (rs === 'APPROVED') return null; // schváleno → nezobrazovat

  const configs: Record<string, { icon: keyof typeof Ionicons.glyphMap; title: string; color: string; bg: string }> = {
    PENDING:   { icon: 'time-outline',           title: 'Čeká na schválení',  color: Colors.mu,  bg: `${Colors.mu}18`  },
    REJECTED:  { icon: 'close-circle-outline',   title: 'Registrace zamítnuta', color: Colors.red, bg: `${Colors.red}18` },
    APPEALING: { icon: 'chatbubble-ellipses-outline', title: 'Odvolání odesláno', color: '#F59E0B', bg: '#F59E0B18' },
  };
  const cfg = configs[rs] ?? configs.PENDING;

  return (
    <View style={[rbs.banner, { backgroundColor: cfg.bg, borderColor: `${cfg.color}44` }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Ionicons name={cfg.icon} size={18} color={cfg.color} />
        <Text style={[rbs.title, { color: cfg.color }]}>{cfg.title}</Text>
      </View>
      {rs === 'PENDING' && (
        <Text style={rbs.desc}>Tým čeká na schválení supervisorem. Obdržíš notifikaci po vyřízení.</Text>
      )}
      {rs === 'REJECTED' && team.regNote && (
        <Text style={rbs.desc}>Důvod: {team.regNote}</Text>
      )}
      {rs === 'REJECTED' && (
        <Pressable style={rbs.appealBtn} onPress={onAppeal}>
          <Text style={rbs.appealBtnTxt}>Podat odvolání</Text>
        </Pressable>
      )}
      {rs === 'APPEALING' && team.regAppeal && (
        <Text style={rbs.desc}>Tvé odvolání: {team.regAppeal}</Text>
      )}
    </View>
  );
}

const rbs = StyleSheet.create({
  banner:     { borderRadius: Radius.md, borderWidth: 1, padding: 14, marginBottom: 16 },
  title:      { fontSize: Fonts.sizes.sm, fontWeight: '700' },
  desc:       { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18, marginTop: 2 },
  appealBtn:  { marginTop: 10, backgroundColor: Colors.red, borderRadius: Radius.sm, paddingHorizontal: 16, paddingVertical: 9, alignSelf: 'flex-start' },
  appealBtnTxt: { fontSize: Fonts.sizes.xs, fontWeight: '700', color: '#fff' },
});

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
  settingsBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, marginTop: 8 },
  logoutBtn:    { borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 8 },
  logoutText:   { fontSize: Fonts.sizes.md, color: Colors.mu, fontWeight: '600' },
  seasonInput:      { backgroundColor: Colors.c2, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.sm, padding: 12, color: Colors.wh, fontSize: Fonts.sizes.md, marginBottom: 10 },
  seasonBtn:        { backgroundColor: Colors.pu, borderRadius: Radius.md, padding: 12, alignItems: 'center' },
  seasonBtnTxt:     { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.bg },
  roleChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  roleChipActive:   { backgroundColor: Colors.go, borderColor: Colors.go },
  roleChipTxt:      { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.mu },
  roleChipTxtActive:{ color: Colors.bg },

  // Appeal modal
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetHandle:  { width: 40, height: 4, backgroundColor: Colors.bd, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 8 },
  appealInput:  { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh, marginTop: 8 },
  appealBtn:    { backgroundColor: Colors.red, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 14 },
  appealBtnTxt: { fontSize: Fonts.sizes.md, fontWeight: '700', color: '#fff' },
});
