import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Fanouškovský režim.
 *
 * Uživatel, který se přihlásí a nechce (zatím) být hráč, vedoucí ani rozhodčí.
 * Nemá v backendu žádný profil — je to čistě klientský příznak, takže nepotřebuje
 * migraci ani nový endpoint. Kdykoli si může ve Správě roli doplnit; ve chvíli,
 * kdy mu backend vrátí player/referee/manager, se příznak sám zahodí.
 *
 * Držíme i oblíbený tým — je to jediná personalizace, kterou fanoušek má,
 * a používá ji domovská obrazovka.
 */

const FAN_KEY = 'fsl_fan_mode';
const FAV_KEY = 'fsl_fav_team';

interface FanState {
  isFan:     boolean;
  favTeamId: string | null;
  hydrated:  boolean;
  load:        () => Promise<void>;
  setFan:      (v: boolean) => Promise<void>;
  setFavTeam:  (id: string | null) => Promise<void>;
}

export const useFanStore = create<FanState>((set) => ({
  isFan:     false,
  favTeamId: null,
  hydrated:  false,

  load: async () => {
    try {
      const [fan, fav] = await Promise.all([
        AsyncStorage.getItem(FAN_KEY),
        AsyncStorage.getItem(FAV_KEY),
      ]);
      set({ isFan: fan === '1', favTeamId: fav || null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setFan: async (v) => {
    set({ isFan: v });
    try {
      if (v) await AsyncStorage.setItem(FAN_KEY, '1');
      else   await AsyncStorage.removeItem(FAN_KEY);
    } catch {}
  },

  setFavTeam: async (id) => {
    set({ favTeamId: id });
    try {
      if (id) await AsyncStorage.setItem(FAV_KEY, id);
      else    await AsyncStorage.removeItem(FAV_KEY);
    } catch {}
  },
}));
