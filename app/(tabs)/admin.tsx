import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useIsManager, useIsReferee, useIsSupervisor, type ActiveRole } from '../../store/auth';
import { useFanStore } from '../../store/fan';
import { playersApi, supervisorApi, teamsApi } from '../../services/api';
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
  const isFan  = useFanStore(s => s.isFan);

  const [myStats, setMyStats]           = useState<any>(null);
  const [leavingTeam, setLeavingTeam]   = useState(false);
  const [teamDetail, setTeamDetail]     = useState<any>(null);
  const [queue, setQueue]               = useState<any>(null);
  const [appealText, setAppealText]     = useState('');
  const [appealBusy, setAppealBusy]     = useState(false);
  const [appealModal, setAppealModal]   = useState(false);

  useEffect(() => {
    if (user?.player) {
      playersApi.myStats().then(r => setMyStats(r.data)).catch(() => {});
    }
    if (isSupervisor) {
      supervisorApi.dashboard().then(r => setQueue(r.data)).catch(() => {});
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
        { icon: 'ribbon',        label: 'Licence a pravidla', desc: 'Kde smíš hrát, volba týmů do playoff', route: '/licence' },
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
        { icon: 'ribbon',          label: 'Licence a pravidla',    desc: 'Koho smíš postavit do sestavy',  route: '/licence'      },
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
      title: 'Organizace ligy',
      items: [
        { icon: 'stats-chart', label: 'Dashboard', desc: 'Přehled celé ligy', route: '/supervisor/dashboard', color: Colors.pu },
        { icon: 'git-network',  label: 'Struktura soutěží', desc: 'Ligy, konference, divize a zařazení týmů', route: '/supervisor/leagues', color: Colors.pu },
        { icon: 'git-branch',   label: 'Rozlosování',     desc: 'Generování rozpisu zápasů',      route: '/supervisor/league',      color: Colors.pu },
        { icon: 'trophy',       label: 'Playoff',         desc: 'Nasazení podle tabulky, generování kola', route: '/supervisor/playoff', color: Colors.pu },
        { icon: 'football', label: 'Správa zápasů', desc: 'Přiřazení rozhodčích, rušení', route: '/supervisor/matches', color: Colors.pu },
        { icon: 'shield',       label: 'Správa týmů',     desc: 'Divize, přidání, editace, smazání', route: '/supervisor/teams',    color: Colors.pu },
        { icon: 'cash',         label: 'Platby',          desc: 'Přehled a ruční sync',          route: '/supervisor/payments', color: Colors.pu },
        { icon: 'newspaper',    label: 'Highlights kola', desc: 'Aktuality viditelné na home screen', route: '/supervisor/highlights', color: Colors.pu },
        { icon: 'star',         label: 'Supervisoři',     desc: 'Přidat nebo odebrat organizátory ligy', route: '/supervisor/admins', color: Colors.pu },
        { icon: 'calendar',     label: 'Sezóna',          desc: 'Naplánovat přechod na novou sezónu', route: '/supervisor/season', color: Colors.pu },
      ],
    });
  }

  // Filtrování podle activeRole (jen pro supervisora)
  const sections = isSupervisor && activeRole !== 'all'
    ? allSections.filter(s => s.id === activeRole)
    : allSections;

  // Role, které uživatel ještě nemá — může si je kdykoli doplnit
  const addRoleItems: MenuItem[] = [];
  if (!user?.player) {
    addRoleItems.push({
      icon: 'person-add', label: 'Stát se hráčem',
      desc: 'Zadej pozvánkový kód od vedoucího týmu', route: '/onboarding/player-code',
    });
  }
  if (!isManager) {
    addRoleItems.push({
      icon: 'shield', label: 'Založit tým',
      desc: 'Staň se vedoucím a spravuj soupisku', route: '/onboarding/manager', color: Colors.pu,
    });
  }
  if (!isReferee) {
    addRoleItems.push({
      icon: 'flag', label: 'Přihlásit se jako rozhodčí',
      desc: 'Supervisor přihlášku schválí do 48 hodin', route: '/onboarding/referee', color: '#3B82F6',
    });
  }

  const hasNoRole = allSections.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Správa</Text>

        {/* Fanoušek – zatím bez role v lize */}
        {hasNoRole && (
          <View style={styles.fanBanner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Ionicons name="eye" size={18} color={Colors.mu} />
              <Text style={styles.fanTitle}>Sleduješ ligu jako fanoušek</Text>
            </View>
            <Text style={styles.fanDesc}>
              Vidíš výsledky, tabulku i statistiky. Až budeš chtít hrát, vést tým nebo pískat,
              vyber si roli níže — o nic nepřijdeš a role se dají kombinovat.
            </Text>
          </View>
        )}

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

        {/* Fronta ke schválení – jen supervisor */}
        {isSupervisor && (activeRole === 'all' || activeRole === 'supervisor') && (
          <QueueSection queue={queue} />
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

        {/* Vybraná role zatím nic nenabízí */}
        {isSupervisor && activeRole !== 'all' && sections.length === 0 && (
          <View style={[styles.card, styles.roleEmpty]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.mu} />
            <Text style={styles.roleEmptyTxt}>
              V téhle roli tu zatím nic nemáš. Přepni zpět na „Vše" nebo si roli doplň níže.
            </Text>
          </View>
        )}

        {/* Doplnit roli – vždy, dokud nějaká chybí */}
        {addRoleItems.length > 0 && (!isSupervisor || activeRole === 'all') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {hasNoRole ? 'Zapojit se do ligy' : 'Přidat další roli'}
            </Text>
            <View style={styles.card}>
              {addRoleItems.map((item, idx) => (
                <Pressable
                  key={item.route}
                  style={[styles.item, idx < addRoleItems.length - 1 && styles.itemBorder]}
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
        )}

        {/* Oblíbený tým – personalizace domovské obrazovky */}
        {(!isSupervisor || activeRole === 'all') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sledování</Text>
            <View style={styles.card}>
              <Pressable style={styles.item} onPress={() => router.push('/favorite-team' as any)}>
                <View style={[styles.iconBox, { backgroundColor: `${Colors.go}22` }]}>
                  <Ionicons name="heart" size={18} color={Colors.go} />
                </View>
                <View style={styles.itemText}>
                  <Text style={styles.itemLabel}>Oblíbený tým</Text>
                  <Text style={styles.itemDesc}>Jeho zápasy uvidíš nahoře na domovské obrazovce</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.di} />
              </Pressable>
            </View>
          </View>
        )}

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

// ─── Fronta ke schválení (supervisor) ──────────────────────────────────────
function QueueSection({ queue }: { queue: any }) {
  if (!queue) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fronta ke schválení</Text>
        <View style={[styles.card, { padding: 20, alignItems: 'center' }]}>
          <ActivityIndicator color={Colors.pu} size="small" />
        </View>
      </View>
    );
  }

  const items = [
    { key: 'teams',    icon: 'shield'      as const, label: 'Týmy ke schválení',      count: queue.pendingTeams    ?? 0, route: '/supervisor/teams'    },
    { key: 'appeals',  icon: 'chatbubble-ellipses' as const, label: 'Odvolání týmů',  count: queue.appealingTeams  ?? 0, route: '/supervisor/teams'    },
    { key: 'referees', icon: 'flag'        as const, label: 'Rozhodčí ke schválení',  count: queue.pendingReferees ?? 0, route: '/supervisor/referees' },
    { key: 'requests', icon: 'help-buoy'   as const, label: 'Žádosti hráčů a vedoucích', count: queue.pendingRequests ?? 0, route: '/supervisor/requests' },
    { key: 'unpaid',   icon: 'cash'        as const, label: 'Nezaplacené licence',    count: queue.unpaidLicenses  ?? 0, route: '/supervisor/payments' },
  ];

  const pending = items.filter(i => i.count > 0);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Fronta ke schválení</Text>
      <View style={styles.card}>
        {pending.length === 0 ? (
          <View style={styles.queueEmpty}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.green} />
            <Text style={styles.queueEmptyTxt}>Vše vyřízeno, nic nečeká.</Text>
          </View>
        ) : pending.map((item, idx) => (
          <Pressable
            key={item.key}
            style={[styles.item, idx < pending.length - 1 && styles.itemBorder]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={[styles.iconBox, { backgroundColor: `${Colors.pu}22` }]}>
              <Ionicons name={item.icon} size={18} color={Colors.pu} />
            </View>
            <Text style={[styles.itemLabel, { flex: 1 }]}>{item.label}</Text>
            <View style={styles.queueBadge}>
              <Text style={styles.queueBadgeTxt}>{item.count}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.di} />
          </Pressable>
        ))}
      </View>
    </View>
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
  roleChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: Colors.bd, backgroundColor: Colors.c1 },
  roleChipActive:   { backgroundColor: Colors.go, borderColor: Colors.go },
  roleChipTxt:      { fontSize: Fonts.sizes.xs, fontWeight: '600', color: Colors.mu },
  roleChipTxtActive:{ color: Colors.bg },
  roleEmpty:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, marginBottom: 20 },
  roleEmptyTxt:  { flex: 1, fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18 },
  queueEmpty:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  queueEmptyTxt: { fontSize: Fonts.sizes.sm, color: Colors.mu },
  queueBadge:    { minWidth: 26, paddingHorizontal: 7, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: Colors.pu, alignItems: 'center', marginRight: 4 },
  queueBadgeTxt: { fontSize: Fonts.sizes.xs, fontWeight: '800', color: Colors.wh },
  fanBanner:    { backgroundColor: Colors.c1, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.bd, padding: 14, marginBottom: 20 },
  fanTitle:     { fontSize: Fonts.sizes.sm, fontWeight: '700', color: Colors.wh },
  fanDesc:      { fontSize: Fonts.sizes.xs, color: Colors.mu, lineHeight: 18 },

  // Appeal modal
  backdrop:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.c1, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetHandle:  { width: 40, height: 4, backgroundColor: Colors.bd, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle:   { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.wh, marginBottom: 8 },
  appealInput:  { backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 12, fontSize: Fonts.sizes.md, color: Colors.wh, marginTop: 8 },
  appealBtn:    { backgroundColor: Colors.red, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: 14 },
  appealBtnTxt: { fontSize: Fonts.sizes.md, fontWeight: '700', color: '#fff' },
});
