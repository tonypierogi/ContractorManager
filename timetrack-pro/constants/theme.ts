export const Colors = {
  // Primary accent
  accent: '#00d4aa',
  accentSecondary: '#00b894',
  accentGlow: 'rgba(0, 212, 170, 0.15)',
  accentHover: '#00e6b8',

  // Backgrounds
  bgPrimary: '#0a0f1a',
  bgSecondary: '#111827',
  bgPanel: '#1a2234',
  bgElevated: '#243047',

  // Text
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  // Borders
  border: '#2d3a4f',
  borderFocus: '#00d4aa',

  // Status
  success: '#10b981',
  danger: '#f43f5e',
  dangerDark: '#dc2626',
  warning: '#f59e0b',

  // Surfaces (for invoice preview / light contexts)
  surface: '#ffffff',
  surfaceText: '#1a1a2e',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xxs: 10,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  clock: 48,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  glow: {
    shadowColor: '#00d4aa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 4,
  },
};
