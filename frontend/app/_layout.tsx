import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from '../src/ThemeContext';
import { clearCache } from '../src/cache';
import * as Notifications from 'expo-notifications';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  weight_kg?: number;
  activity_level?: string;
  health_goals?: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (sessionId: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const checkAuth = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        await AsyncStorage.removeItem('session_token');
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signIn = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      });

      if (!response.ok) throw new Error('Session exchange failed');

      const userData = await response.json();
      // Use the actual session_token from the backend response (not the session_id)
      const token = userData.session_token || sessionId;
      await AsyncStorage.setItem('session_token', token);
      setUser(userData);

      // Register push token after successful login
      registerPushToken(token);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const registerPushToken = async (authToken: string) => {
    try {
      if (Platform.OS === 'web') return; // Push not supported on web
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;

      const pushToken = await Notifications.getExpoPushTokenAsync();
      if (pushToken?.data) {
        await fetch(`${BACKEND_URL}/api/notifications/register-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ push_token: pushToken.data, platform: Platform.OS })
        });
        console.log('Push token registered:', pushToken.data);
      }
    } catch (e) {
      console.log('Push token registration skipped:', e);
    }
  };

  const signOut = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (token) {
        // Unregister push token
        await fetch(`${BACKEND_URL}/api/notifications/unregister-token`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => {});
        await fetch(`${BACKEND_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('session_token');
      await clearCache();
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    // Let index.tsx handle initial routing (privacy policy check etc.)
    const atRoot = segments.length === 0 || segments[0] === 'index' || segments[0] === undefined;
    // Allow upgrade and payment screens for authenticated users with expired trial
    const inPaymentFlow = segments[0] === 'upgrade' || segments[0] === 'payment-success';

    if (!user && !inAuthGroup && !atRoot) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, segments, isLoading, navigationState?.key]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

function RootContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="food-details" options={{ presentation: 'modal', headerShown: true, headerTitle: 'Food Analysis', headerStyle: { backgroundColor: '#1a1a2e' }, headerTintColor: '#fff' }} />
        <Stack.Screen name="onboarding" options={{ presentation: 'card', gestureEnabled: false }} />
        {/* privacy-policy is now in (auth) group */}
        <Stack.Screen name="upgrade" options={{ presentation: 'card', gestureEnabled: false }} />
        <Stack.Screen name="payment-success" options={{ presentation: 'card', gestureEnabled: false }} />
        <Stack.Screen name="molecular-engine" options={{ presentation: 'card' }} />
        <Stack.Screen name="badges" options={{ presentation: 'card' }} />
        <Stack.Screen name="settings" options={{ presentation: 'card' }} />
        <Stack.Screen name="progress" options={{ presentation: 'card' }} />
        <Stack.Screen name="favorites" options={{ presentation: 'card' }} />
        <Stack.Screen name="scanner" options={{ presentation: 'card' }} />
        <Stack.Screen name="recipes" options={{ presentation: 'card' }} />
        <Stack.Screen name="meal-plan" options={{ presentation: 'card' }} />
        <Stack.Screen name="ai-home" options={{ presentation: 'card' }} />
      </Stack>
    </>
  );
}
