import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, Animated } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './_layout';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Index() {
  const { user, isLoading } = useAuth();
  const [policyAccepted, setPolicyAccepted] = useState<boolean | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];

  // Show splash for 2.5 seconds
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        setSplashDone(true);
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

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
          setHasAccess(true);
        }
      } catch (e) {
        setHasAccess(true);
      }
    };
    checkAccess();
  }, [user]);

  // Show splash screen first
  if (!splashDone) {
    return (
      <View style={styles.splashContainer}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <Image
            source={require('../assets/jaide-logo.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    );
  }

  // Still checking
  if (policyAccepted === null || isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00d4ff" />
      </View>
    );
  }

  if (!policyAccepted) {
    return <Redirect href="/(auth)/privacy-policy" />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (hasAccess === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00d4ff" />
      </View>
    );
  }

  if (!hasAccess) {
    return <Redirect href="/upgrade" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#080818',
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#080818',
  },
  splashLogo: {
    width: 220,
    height: 220,
  },
});
