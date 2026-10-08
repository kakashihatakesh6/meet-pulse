export const Colors = {
  light: {
    primary: '#4F46E5', // Indigo 600
    primaryLight: '#EEF2FF',
    primaryDark: '#3730A3',
    accent: '#06B6D4', // Cyan 500
    accentLight: '#ECFEFF',
    background: '#F8FAFC', // Slate 50
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F5F9', // Slate 100
    surfaceBorder: '#E2E8F0', // Slate 200
    surfaceBorderHighlight: '#CBD5E1', // Slate 300
    text: '#0F172A', // Slate 900
    textMuted: '#64748B', // Slate 500
    textSubtle: '#94A3B8', // Slate 400
    textInverse: '#FFFFFF',

    // Status colors
    success: '#10B981', // Emerald 500
    successLight: '#ECFDF5',
    successBorder: '#A7F3D0',
    warning: '#F59E0B', // Amber 500
    warningLight: '#FFFBEB',
    warningBorder: '#FDE68A',
    danger: '#EF4444', // Red 500
    dangerLight: '#FEF2F2',
    dangerBorder: '#FECACA',
    info: '#3B82F6', // Blue 500
    infoLight: '#EFF6FF',
    infoBorder: '#BFDBFE',

    // Platform badges
    meet: '#00832D',
    meetLight: '#E6F4EA',
    zoom: '#2D8CFF',
    zoomLight: '#EBF4FF',
    teams: '#5059C9',
    teamsLight: '#EEF0FD',

    // Card styling
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    tabBarBg: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    tabActive: '#4F46E5',
    tabInactive: '#94A3B8',
  },
  dark: {
    primary: '#6366F1', // Indigo 500
    primaryLight: '#312E81',
    primaryDark: '#4338CA',
    accent: '#22D3EE', // Cyan 400
    accentLight: '#164E63',
    background: '#090D16', // Deep Space Slate
    surface: '#111827', // Slate 900
    surfaceSubtle: '#1E293B', // Slate 800
    surfaceBorder: '#334155', // Slate 700
    surfaceBorderHighlight: '#475569', // Slate 600
    text: '#F8FAFC', // Slate 50
    textMuted: '#94A3B8', // Slate 400
    textSubtle: '#64748B', // Slate 500
    textInverse: '#0F172A',

    // Status colors
    success: '#34D399',
    successLight: 'rgba(16, 185, 129, 0.15)',
    successBorder: 'rgba(52, 211, 153, 0.3)',
    warning: '#FBBF24',
    warningLight: 'rgba(245, 158, 11, 0.15)',
    warningBorder: 'rgba(251, 191, 36, 0.3)',
    danger: '#F87171',
    dangerLight: 'rgba(239, 68, 68, 0.15)',
    dangerBorder: 'rgba(248, 113, 113, 0.3)',
    info: '#60A5FA',
    infoLight: 'rgba(59, 130, 246, 0.15)',
    infoBorder: 'rgba(96, 165, 250, 0.3)',

    // Platform badges
    meet: '#34A853',
    meetLight: 'rgba(52, 168, 83, 0.15)',
    zoom: '#3894FF',
    zoomLight: 'rgba(45, 140, 255, 0.15)',
    teams: '#7B83EB',
    teamsLight: 'rgba(80, 89, 201, 0.15)',

    // Card styling
    cardBg: '#131C2E',
    cardBorder: '#1E293B',
    tabBarBg: '#0D1424',
    tabBarBorder: '#1E293B',
    tabActive: '#818CF8',
    tabInactive: '#64748B',
  },
};

export type ColorTheme = typeof Colors.light;
