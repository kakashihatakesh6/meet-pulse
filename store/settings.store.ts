import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS, ThemeMode } from '../types/settings';
import { SettingsRepository } from '../services/database/repositories/settings.repository';
import { logger } from '../utils/logger';

interface SettingsStoreState {
  settings: AppSettings;
  isLoading: boolean;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setDefaultAlarmOffsets: (offsets: number[]) => Promise<void>;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: true,

  loadSettings: async () => {
    try {
      const stored = await SettingsRepository.getAllSettings();
      set({ settings: stored, isLoading: false });
    } catch (err) {
      logger.error('Failed to load app settings', err);
      set({ settings: DEFAULT_SETTINGS, isLoading: false });
    }
  },

  updateSettings: async (partial: Partial<AppSettings>) => {
    const current = get().settings;
    const updated = { ...current, ...partial };
    set({ settings: updated });

    try {
      await SettingsRepository.saveAllSettings(updated);
      logger.info('Saved updated app settings to database');
    } catch (err) {
      logger.error('Failed to persist settings', err);
    }
  },

  setTheme: async (theme: ThemeMode) => {
    await get().updateSettings({ theme });
  },

  setDefaultAlarmOffsets: async (defaultAlarmOffsets: number[]) => {
    await get().updateSettings({ defaultAlarmOffsets });
  },
}));
