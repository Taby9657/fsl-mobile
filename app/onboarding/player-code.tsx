// Hráč zadá pozvánkový kód od vedoucího
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { teamsApi } from '../../services/api';
import { Colors, Fonts, Radius } from '../../constants/colors';

export default function PlayerCodeScreen() {
  const [code, setCode]       = useState('');
  const [loading, setLoading] = useState(false);
  const [team, setTeam]       = useState<any>(null);

  async function verifyCode() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) { Alert.alert('Zadej platný kód', 'Kód má formát FSL-TM-XXXX'); return; }
    setLoading(true);
    try {
      const res = await teamsApi.join(trimmed);
      setTeam(res.data.team);
    } catch (err: any) {
      Alert.alert('Neplatný kód', err.response?.data?.error ?? 'Zkus to znovu');
    } finally {
      setLoading(false);
    }
  }

  if (team) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>
          <View style={[styles.teamPreview, { borderColor: team.color }]}>
            <View style={[styles.teamBadge, { backgroundColor: team.color }]}>
              <Text style={styles.teamAbbr}>{team.abbr}</Text>
            </View>
            <Text style={styles.teamName}>{team.name}</Text>
            <Text style={styles.teamDiv}>{team.division}</Text>
          </View>
          <Text style={styles.confirm}>Připojuješ se k tomuto týmu?</Text>
          <Pressable
            style={styles.btnPrimary}
            onPress={() => router.push({ pathname: '/onboarding/player-info', params: { teamId: team.id, teamName: team.name } })}
          >
            <Text style={styles.btnPrimaryText}>Ano, pokračovat</Text>
          </Pressable>
          <Pressable style={styles.btnSecondary} onPress={() => setTeam(null)}>
            <Text style={styles.btnSecondaryText}>Zadat jiný kód</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Zpět</Text>
        </Pressable>

        <Text style={styles.title}>Pozvánkový kód</Text>
        <Text style={styles.subtitle}>Dostaneš ho od vedoucího svého týmu.</Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={t => setCode(t.toUpperCase())}
          placeholder="FSL-BE-XXXX"
          placeholderTextColor={Colors.di}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          keyboardAppearance="dark"
          returnKeyType="done"
          onSubmitEditing={verifyCode}
        />

        <Pressable style={[styles.btnPrimary, !code && styles.btnDisabled]} onPress={verifyCode} disabled={!code || loading}>
          {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.btnPrimaryText}>Ověřit kód</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.bg },
  inner:           { flex: 1, padding: 24, paddingTop: 16 },
  back:            { marginBottom: 24 },
  backText:        { color: Colors.go, fontSize: Fonts.sizes.md },
  title:           { fontSize: Fonts.sizes.h1, fontWeight: '900', color: Colors.wh, marginBottom: 6 },
  subtitle:        { fontSize: Fonts.sizes.md, color: Colors.mu, marginBottom: 32, lineHeight: 22 },
  input: {
    backgroundColor: Colors.c1, borderWidth: 1, borderColor: Colors.bd,
    borderRadius: Radius.md, padding: 16, fontSize: Fonts.sizes.xl,
    color: Colors.wh, fontWeight: '700', textAlign: 'center',
    letterSpacing: 4, marginBottom: 16,
  },
  btnPrimary:      { backgroundColor: Colors.go, borderRadius: Radius.md, padding: 16, alignItems: 'center', marginBottom: 10 },
  btnPrimaryText:  { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.bg },
  btnDisabled:     { opacity: 0.4 },
  btnSecondary:    { borderWidth: 1, borderColor: Colors.bd, borderRadius: Radius.md, padding: 16, alignItems: 'center' },
  btnSecondaryText:{ fontSize: Fonts.sizes.md, color: Colors.mu, fontWeight: '600' },
  teamPreview:     { alignItems: 'center', padding: 32, borderWidth: 2, borderRadius: Radius.xl, marginBottom: 24 },
  teamBadge:       { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  teamAbbr:        { fontSize: Fonts.sizes.xl, fontWeight: '900', color: Colors.bg },
  teamName:        { fontSize: Fonts.sizes.xl, fontWeight: '700', color: Colors.wh, marginBottom: 4 },
  teamDiv:         { fontSize: Fonts.sizes.sm, color: Colors.mu },
  confirm:         { fontSize: Fonts.sizes.lg, color: Colors.wh, textAlign: 'center', marginBottom: 20 },
});
