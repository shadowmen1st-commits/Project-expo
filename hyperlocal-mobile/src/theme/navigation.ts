import { EdgeInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { colors } from './colors';
import { shadows } from './shadows';

/**
 * Common shared bottom navigation bar styling to ensure the tab bar sits
 * approximately 35-50dp higher above the Android system navigation/gesture area
 * across all mobile screens.
 */
export const getTabBarStyle = (insets: EdgeInsets) => {
  const extraElevation = Platform.OS === 'android' ? 36 : 28;
  const bottomInset = Math.max(insets.bottom, extraElevation);

  return {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    height: 58 + bottomInset,
    paddingBottom: bottomInset,
    paddingTop: 8,
    ...shadows.md,
  };
};
