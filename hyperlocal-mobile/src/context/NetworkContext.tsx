import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { checkServerHealth } from '../config/api';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: NetInfoStateType;
  isWifi: boolean;
  isCellular: boolean;
  isServerReachable: boolean | null;
  refreshNetworkStatus: () => Promise<void>;
}

const NetworkContext = createContext<NetworkState | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [connectionType, setConnectionType] = useState<NetInfoStateType>(NetInfoStateType.other);
  const [isServerReachable, setIsServerReachable] = useState<boolean | null>(null);

  const evaluateState = useCallback(async (state: NetInfoState) => {
    const connected = Boolean(state.isConnected);
    const reachable = state.isInternetReachable;
    const type = state.type;

    setIsConnected(connected);
    setIsInternetReachable(reachable);
    setConnectionType(type);

    console.log('[NETWORK_STATE_CHANGE]', {
      connected,
      internetReachable: reachable,
      type,
    });

    if (connected) {
      // Non-blocking health ping when coming online or switching networks
      checkServerHealth()
        .then((h) => setIsServerReachable(h.ok))
        .catch(() => setIsServerReachable(false));
    } else {
      setIsServerReachable(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    NetInfo.fetch().then(evaluateState);

    // Subscribe to network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      evaluateState(state);
    });

    return () => {
      unsubscribe();
    };
  }, [evaluateState]);

  const refreshNetworkStatus = useCallback(async () => {
    const state = await NetInfo.fetch();
    await evaluateState(state);
  }, [evaluateState]);

  const isWifi = connectionType === NetInfoStateType.wifi;
  const isCellular = connectionType === NetInfoStateType.cellular;

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        isInternetReachable,
        connectionType,
        isWifi,
        isCellular,
        isServerReachable,
        refreshNetworkStatus,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkState => {
  const context = useContext(NetworkContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      isConnected: true,
      isInternetReachable: true,
      connectionType: NetInfoStateType.other,
      isWifi: false,
      isCellular: false,
      isServerReachable: true,
      refreshNetworkStatus: async () => {},
    };
  }
  return context;
};

export default NetworkContext;
