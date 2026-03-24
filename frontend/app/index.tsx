import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './_layout';

export default function Index() {
  const { user, isLoading } = useAuth();
  const [policyAccepted, setPolicyAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('privacy_policy_accepted').then((val) => {
      setPolicyAccepted(val === 'true');
    });
  }, []);

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

  // If user is already logged in, go to dashboard
  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  // Otherwise, go to login
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#080818',
  },
});
