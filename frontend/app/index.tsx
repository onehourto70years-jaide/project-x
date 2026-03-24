import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './_layout';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Index() {
  const { user, isLoading } = useAuth();
  const [policyAccepted, setPolicyAccepted] = useState<boolean | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('privacy_policy_accepted').then((val) => {
      setPolicyAccepted(val === 'true');
    });
  }, []);

  // Check payment/trial status once user is logged in
  useEffect(() => {
    if (!user) {
      setHasAccess(null);
      return;
    }
    const checkAccess = async () => {
      try {
        const token = await AsyncStorage.getItem('session_token');
        if (!token) { setHasAccess(false); return; }
        const res = await fetch(`${BACKEND_URL}/api/payments/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setHasAccess(data.has_access);
        } else {
          setHasAccess(true); // Default to access on error
        }
      } catch (e) {
        setHasAccess(true); // Default to access on error
      }
    };
    checkAccess();
  }, [user]);

  // Still checking
  if (policyAccepted === null || isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00d4ff" />
      </View>
    );
  }

  // If user hasn't accepted privacy policy, send them there first
  if (!policyAccepted) {
    return <Redirect href="/(auth)/privacy-policy" />;
  }

  // If user is not logged in, go to login
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Waiting for payment status check
  if (hasAccess === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00d4ff" />
      </View>
    );
  }

  // If trial expired and not premium, show upgrade
  if (!hasAccess) {
    return <Redirect href="/upgrade" />;
  }

  // All good, go to dashboard
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#080818',
  },
});
