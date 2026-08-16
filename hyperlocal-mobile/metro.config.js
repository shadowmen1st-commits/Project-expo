// metro.config.js — Expo SDK 57 Windows fix
// Root cause: Metro 0.84 on Windows fails to resolve expo-constants from
// @expo/metro-runtime TypeScript source because package.json `main` field
// path resolution fails in the Windows file watcher context.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable broken package exports on this version of Metro/Windows
config.resolver.unstable_enablePackageExports = false;

// Force explicit module resolution for packages that fail via package.json main
const extraModules = {
  'expo-constants': path.resolve(__dirname, 'node_modules/expo-constants/build/Constants.js'),
  'expo-linking': path.resolve(__dirname, 'node_modules/expo-linking/build/Linking.js'),
};

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  ...extraModules,
};

module.exports = config;
