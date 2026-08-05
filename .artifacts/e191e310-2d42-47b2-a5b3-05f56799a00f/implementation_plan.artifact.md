# Mobile App Implementation Plan (Expo Native)

The goal is to transform the existing barebones WebView wrapper into a fully native Expo application using React Native components. This will provide better performance, a native look and feel, and better user experience.

## Proposed Changes

### [Mobile Module]

Summary of changes for the mobile application.

#### [MODIFY] [package.json](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/mobile/package.json)
- Add necessary dependencies for navigation, styling, and networking.
- Dependencies: `expo-router`, `react-native-safe-area-context`, `react-native-screens`, `expo-constants`, `expo-linking`, `expo-status-bar`, `axios`, `lucide-react-native`, `nativewind` (or standard StyleSheet for simplicity).

#### [NEW] Directory Structure
- `app/`: Expo Router directory for file-based navigation.
- `components/`: Reusable UI components (Buttons, Inputs, Cards).
- `context/`: Context providers (AuthContext).
- `hooks/`: Custom React hooks.
- `services/`: API communication layer.
- `constants/`: Theme, API config, etc.

#### [NEW] [AuthContext.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/mobile/context/AuthContext.js)
- Handle user authentication state (token storage using `expo-secure-store`).

#### [NEW] [api.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/mobile/services/api.js)
- Axios instance configured with the backend base URL.

#### [NEW] [app/_layout.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/mobile/app/_layout.js)
- Root layout with AuthProvider and Stack navigation.

#### [NEW] [app/(auth)/login.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/mobile/app/(auth)/login.js)
- Native login screen.

#### [NEW] [app/(tabs)/index.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/mobile/app/(tabs)/index.js)
- Main dashboard screen (Customer/Worker).

#### [NEW] [app/index.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/mobile/app/index.js)
- Entry point/Redirect logic based on auth state.

#### [DELETE] [App.js](file:///C:/Users/harsh%20singh/Desktop/Project%20Expo/mobile/App.js)
- Remove the old WebView-based entry point as we switch to Expo Router.

## Verification Plan

### Automated Tests
- Since this is a UI-heavy change, manual verification is preferred.
- We can add unit tests for utility functions later.

### Manual Verification
1. Run `npx expo start` in the `mobile` directory.
2. Verify that the app launches and shows the landing/login screen.
3. Test login functionality with a test account.
4. Verify navigation between tabs and screens.
