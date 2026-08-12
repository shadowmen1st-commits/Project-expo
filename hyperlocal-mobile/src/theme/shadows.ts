import { Platform } from 'react-native';

/**
 * Cross-platform shadows.
 * - iOS: native shadow props
 * - Android: elevation
 * - Web: CSS boxShadow (React Native web deprecated shadow* style props)
 */
export const shadows = {
  sm: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
    },
    android: {
      elevation: 2,
    },
    default: {
      // Web uses boxShadow — no deprecated shadow* props
      boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)',
    },
  }),
  md: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
    default: {
      boxShadow: '0px 2px 8px rgba(15, 23, 42, 0.08)',
    },
  }),
  lg: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
    default: {
      boxShadow: '0px 4px 16px rgba(15, 23, 42, 0.12)',
    },
  }),
};
