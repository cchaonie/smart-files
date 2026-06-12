/**
 * Smart Files Design System — mirrors web (Tailwind zinc palette + cobalt blue accent).
 *
 * Usage:
 *   import { theme } from '../theme';
 *   <View style={{ backgroundColor: theme.colors.background }} />
 */

export const colors = {
  accent: '#2563eb',
  accentDark: '#1d4ed8',
  accentLight: '#3b82f6',
  accentGlow: 'rgba(37, 99, 235, 0.15)',

  // Zinc palette (matches Tailwind zinc)
  zinc50:  '#fafafa',
  zinc100: '#f4f4f5',
  zinc200: '#e4e4e7',
  zinc300: '#d4d4d8',
  zinc400: '#a1a1aa',
  zinc500: '#71717a',
  zinc600: '#52525b',
  zinc700: '#3f3f46',
  zinc800: '#27272a',
  zinc900: '#18181b',
  zinc950: '#09090b',

  // Semantic
  background: '#fafafa',       // zinc-50
  surface: '#ffffff',
  surfaceDark: '#18181b',      // zinc-900 <- for dark mode fallback
  border: '#e4e4e7',           // zinc-200
  borderLight: '#f0f0f0',

  text:     '#18181b',         // zinc-900
  textSecondary: '#52525b',    // zinc-600
  textTertiary: '#a1a1aa',     // zinc-400
  textInverse: '#ffffff',

  danger:   '#ef4444',
  success:  '#22c55e',
  warning:  '#f59e0b',

  // Overlay / glass
  glassBg: 'rgba(255, 255, 255, 0.8)',
  glassBorder: 'rgba(228, 228, 231, 0.5)',
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  '4xl': 34,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const theme = {
  colors,
  radii,
  spacing,
  fontSize,
  fontWeight,
  shadows,
};

export default theme;
