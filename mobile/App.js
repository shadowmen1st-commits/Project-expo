import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [baseUrl, setBaseUrl] = useState('http://192.168.1.10:5173'); // Replace with your local machine's IP address
  const [inputUrl, setInputUrl] = useState('http://192.168.1.10:5173');
  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const webViewRef = useRef(null);

  // Append query parameter so frontend web app knows it is running inside the Android wrapper
  const getAppUrl = (base) => {
    const divider = base.includes('?') ? '&' : '?';
    return `${base}${divider}platform=app`;
  };

  const handleReload = () => {
    setError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  const handleSaveUrl = () => {
    let cleanUrl = inputUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = 'http://' + cleanUrl;
    }
    setBaseUrl(cleanUrl);
    setInputUrl(cleanUrl);
    setShowSettings(false);
    setError(false);
    setIsLoading(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" backgroundColor="#070b13" />
      
      {/* WebView Container */}
      <View style={styles.webContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: getAppUrl(baseUrl) }}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => setError(true)}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />

        {/* Floating Settings Trigger (Small unobtrusive gear icon in bottom corner) */}
        {!error && (
          <TouchableOpacity 
            style={styles.floatingGear}
            onPress={() => setShowSettings(prev => !prev)}
            activeOpacity={0.7}
          >
            <Text style={styles.gearText}>⚙️</Text>
          </TouchableOpacity>
        )}

        {/* Settings Panel Overlay */}
        {showSettings && (
          <View style={styles.settingsOverlay}>
            <View style={styles.settingsCard}>
              <Text style={styles.settingsTitle}>App Configuration</Text>
              <Text style={styles.settingsLabel}>Enter Local Development URL/IP:</Text>
              <TextInput
                style={styles.input}
                value={inputUrl}
                onChangeText={setInputUrl}
                placeholder="e.g. http://192.168.1.15:5173"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="url"
              />
              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowSettings(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveUrl}>
                  <Text style={styles.saveButtonText}>Connect</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.settingsNote}>
                Both PC and Android must be on same WiFi network.
              </Text>
            </View>
          </View>
        )}

        {/* Loading Spinner */}
        {isLoading && !error && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loaderText}>Connecting to server...</Text>
          </View>
        )}

        {/* Connection Failure Error screen */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Connection Failed</Text>
            <Text style={styles.errorDesc}>
              Unable to reach your development server at:{"\n"}
              <Text style={{fontWeight: 'bold', color: '#818cf8'}}>{baseUrl}</Text>
            </Text>
            <Text style={styles.errorSubdesc}>
              Make sure:{"\n"}
              1. Your React frontend server is running (`npm run dev`).{"\n"}
              2. Both your PC and phone are connected to the same Wi-Fi.{"\n"}
              3. Click settings below to enter your correct local PC IP.
            </Text>
            <View style={{flexDirection: 'row', gap: 12}}>
              <TouchableOpacity style={styles.settingsErrorButton} onPress={() => setShowSettings(true)}>
                <Text style={styles.settingsErrorButtonText}>Change IP</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retryButton} onPress={handleReload}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070b13',
  },
  webContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#070b13',
  },
  floatingGear: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  gearText: {
    fontSize: 16,
  },
  settingsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  settingsCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
  },
  settingsTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  settingsLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 44,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 13,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'end',
    gap: 8,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#6366f1',
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  settingsNote: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 12,
    lineHeight: 14,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070b13',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loaderText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 'medium',
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#070b13',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorDesc: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  errorSubdesc: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 24,
    width: '100%',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  settingsErrorButton: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  settingsErrorButtonText: {
    color: '#94a3b8',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
