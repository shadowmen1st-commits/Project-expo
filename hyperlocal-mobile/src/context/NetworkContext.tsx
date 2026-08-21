import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { checkServerHealth } from '../config/api';

export type NetworkStatusType =
  | 'NETWORK_CONNECTED'
  | 'NETWORK_CHECKING'
  | 'NETWORK_OFFLINE'
  | 'BACKEND_UNAVAILABLE';

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  connectionType: NetInfoStateType;
  isWifi: boolean;
  isCellular: boolean;
  isServerReachable: boolean | null;
  networkStatus: NetworkStatusType;
  isNetworkConnected: boolean;
  isNetworkChecking: boolean;
  isNetworkOffline: boolean;
  isBackendAvailable: boolean;
  refreshNetworkStatus: () => Promise<void>;
}

const NetworkContext = createContext<NetworkState | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(true);
  const [connectionType, setConnectionType] = useState<NetInfoStateType>(NetInfoStateType.other);
  const [isServerReachable, setIsServerReachable] = useState<boolean | null>(true);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatusType>('NETWORK_CONNECTED');

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isCheckingRef = useRef<boolean>(false);

  const evaluateState = useCallback(async (state: NetInfoState) => {
    const rawConnected = state.isConnected;
    const rawReachable = state.isInternetReachable;
    const type = state.type;

    // On Android cellular, isInternetReachable can be null during initial connection or handover.
    // We treat null as non-blocking/checking rather than permanent offline.
    const isPhysicalLinkUp = rawConnected !== false;
    const isDefinitelyOffline = rawConnected === false || rawReachable === false;
    const isChecking = rawConnected === true && rawReachable === null;

    setIsConnected(isPhysicalLinkUp);
    setIsInternetReachable(rawReachable ?? true);
    setConnectionType(type);

    console.log('[NETWORK_STATE_CHANGE]', {
      linkUp: isPhysicalLinkUp,
      isInternetReachable: rawReachable,
      connectionType: type,
      isChecking,
      isDefinitelyOffline,
    });

    if (isDefinitelyOffline) {
      setNetworkStatus('NETWORK_OFFLINE');
      setIsServerReachable(false);
      return;
    }

    if (isChecking) {
      setNetworkStatus('NETWORK_CHECKING');
    }

    // Ping backend server availability asynchronously
    if (isPhysicalLinkUp && !isCheckingRef.current) {
      isCheckingRef.current = true;
      try {
        const health = await checkServerHealth();
        setIsServerReachable(health.ok);
        if (health.ok) {
          setNetworkStatus('NETWORK_CONNECTED');
        } else {
          setNetworkStatus('BACKEND_UNAVAILABLE');
        }
      } catch {
        setIsServerReachable(false);
        setNetworkStatus('BACKEND_UNAVAILABLE');
      } finally {
        isCheckingRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    // 1. Initial NetInfo evaluation
    NetInfo.fetch().then(evaluateState);

    // 2. Subscribe to network state transitions (Wi-Fi <-> Cellular, Disconnects)
    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      evaluateState(state);
    });

    // 3. Subscribe to AppState changes (e.g. returning to foreground / resume)
    const subscriptionAppState = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[APP_STATE_RESUME] App resumed to foreground, re-verifying network & backend...');
        NetInfo.fetch().then(evaluateState);
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      unsubscribeNetInfo();
      subscriptionAppState.remove();
    };
  }, [evaluateState]);

  const refreshNetworkStatus = useCallback(async () => {
    console.log('[NETWORK_STATUS_REFRESH] Manual network refresh requested.');
    const state = await NetInfo.fetch();
    await evaluateState(state);
  }, [evaluateState]);

  const isWifi = connectionType === NetInfoStateType.wifi;
  const isCellular = connectionType === NetInfoStateType.cellular;
  const isNetworkConnected = networkStatus === 'NETWORK_CONNECTED';
  const isNetworkChecking = networkStatus === 'NETWORK_CHECKING';
  const isNetworkOffline = networkStatus === 'NETWORK_OFFLINE';
  const isBackendAvailable = isServerReachable !== false;

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        isInternetReachable,
        connectionType,
        isWifi,
        isCellular,
        isServerReachable,
        networkStatus,
        isNetworkConnected,
        isNetworkChecking,
        isNetworkOffline,
        isBackendAvailable,
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
    return {
      isConnected: true,
      isInternetReachable: true,
      connectionType: NetInfoStateType.other,
      isWifi: false,
      isCellular: false,
      isServerReachable: true,
      networkStatus: 'NETWORK_CONNECTED',
      isNetworkConnected: true,
      isNetworkChecking: false,
      isNetworkOffline: false,
      isBackendAvailable: true,
      refreshNetworkStatus: async () => {},
    };
  }
  return context;
};

export default NetworkContext;
