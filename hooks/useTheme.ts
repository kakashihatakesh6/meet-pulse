import { useColorScheme } from 'react-native';
import { Colors, ColorTheme } from '../constants/colors';
import { useSettingsStore } from '../store/settings.store';

export function useTheme(): {
  colors: ColorTheme;
  isDark: boolean;
  themeMode: 'system' | 'light' | 'dark';
} {
  const systemScheme = useColorScheme();
  const themeMode = useSettingsStore((state) => state.settings.theme);

  const isDark =
    themeMode === 'dark' || (themeMode === 'system' && systemScheme === 'dark');

  const colors = isDark ? Colors.dark : Colors.light;

  return { colors, isDark, themeMode };
}
