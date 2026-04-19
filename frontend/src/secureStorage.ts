/**
 * NutriOS Secure Storage Wrapper
 *
 * Uses expo-secure-store on native (iOS Keychain / Android Keystore)
 * Falls back to AsyncStorage on web (no hardware encryption available)
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SecureStore: typeof import('expo-secure-store') | null = null;

// Only import SecureStore on native platforms
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch {
    // Graceful fallback if not available
  }
}

/**
 * Store a value securely.
 * Native: uses hardware-backed Keychain/Keystore
 * Web: falls back to AsyncStorage
 */
export async function secureSet(key: string, value: string): Promise<void> {
  if (SecureStore && Platform.OS !== 'web') {
    await SecureStore.setItemAsync(key, value);
  } else {
    await AsyncStorage.setItem(key, value);
  }
}

/**
 * Retrieve a securely stored value.
 */
export async function secureGet(key: string): Promise<string | null> {
  if (SecureStore && Platform.OS !== 'web') {
    return await SecureStore.getItemAsync(key);
  } else {
    return await AsyncStorage.getItem(key);
  }
}

/**
 * Delete a securely stored value.
 */
export async function secureDelete(key: string): Promise<void> {
  if (SecureStore && Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(key);
  } else {
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Migrate a key from AsyncStorage to SecureStore (one-time migration).
 * Call this on app startup for critical keys like session_token.
 */
export async function migrateToSecure(key: string): Promise<void> {
  if (!SecureStore || Platform.OS === 'web') return;
  try {
    // Check if value exists in old AsyncStorage
    const oldValue = await AsyncStorage.getItem(key);
    if (oldValue) {
      // Check if already in SecureStore
      const secureValue = await SecureStore.getItemAsync(key);
      if (!secureValue) {
        // Migrate: copy to SecureStore, then delete from AsyncStorage
        await SecureStore.setItemAsync(key, oldValue);
      }
      // Always clean up AsyncStorage (even if already migrated)
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // Silent fail — don't break app startup
  }
}
