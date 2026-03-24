import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionId = params.session_id as string;
  const [status, setStatus] = useState<'polling' | 'success' | 'failed' | 'error'>('polling');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    } else {
      setStatus('error');
    }
  }, [sessionId]);

  const pollPaymentStatus = async (attempt = 0) => {
    const maxAttempts = 8;
    if (attempt >= maxAttempts) {
      setStatus('failed');
      return;
    }
    setAttempts(attempt + 1);

    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        setStatus('error');
        return;
      }

      const res = await fetch(`${BACKEND_URL}/api/payments/checkout/status/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        setTimeout(() => pollPaymentStatus(attempt + 1), 2000);
        return;
      }

      const data = await res.json();

      if (data.payment_status === 'paid') {
        setStatus('success');
        return;
      } else if (data.status === 'expired') {
        setStatus('failed');
        return;
      }

      // Still processing, poll again
      setTimeout(() => pollPaymentStatus(attempt + 1), 2000);
    } catch (e) {
      console.error('Payment poll error:', e);
      setTimeout(() => pollPaymentStatus(attempt + 1), 2000);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {status === 'polling' && (
          <>
            <ActivityIndicator size="large" color="#00d4ff" />
            <Text style={styles.title}>Processing Payment...</Text>
            <Text style={styles.subtitle}>Verifying your purchase (attempt {attempts})</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={80} color="#00ff88" />
            </View>
            <Text style={styles.title}>Payment Successful!</Text>
            <Text style={styles.subtitle}>Welcome to NutriOS Pro. Enjoy lifetime access!</Text>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.continueText}>Continue to App</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {(status === 'failed' || status === 'error') && (
          <>
            <View style={styles.errorIcon}>
              <Ionicons name="close-circle" size={80} color="#ff6b6b" />
            </View>
            <Text style={styles.title}>
              {status === 'error' ? 'Something Went Wrong' : 'Payment Not Confirmed'}
            </Text>
            <Text style={styles.subtitle}>
              {status === 'error'
                ? 'Missing payment session information'
                : 'We could not confirm your payment. If you were charged, please contact support.'}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => router.replace('/upgrade')}
            >
              <Text style={styles.retryText}>Back to Upgrade</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  successIcon: { marginBottom: 20 },
  errorIcon: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 16, textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#888', marginTop: 8, textAlign: 'center', lineHeight: 22 },
  continueButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00d4ff', paddingVertical: 16, paddingHorizontal: 32,
    borderRadius: 14, marginTop: 32,
  },
  continueText: { fontSize: 17, fontWeight: '700', color: '#fff', marginRight: 8 },
  retryButton: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,107,107,0.15)', paddingVertical: 16, paddingHorizontal: 32,
    borderRadius: 14, marginTop: 32,
  },
  retryText: { fontSize: 16, fontWeight: '600', color: '#ff6b6b' },
});
