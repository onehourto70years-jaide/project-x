import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from './_layout';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function UpgradeScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    fetchPaymentStatus();
  }, []);

  const fetchPaymentStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/payments/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        // Only redirect back if already premium (purchased)
        // Trial users should be able to access upgrade screen to buy early
        if (data.is_premium) {
          router.replace('/(tabs)');
        }
      }
    } catch (e) {
      console.error('Payment status error:', e);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const originUrl = Platform.OS === 'web'
        ? window.location.origin
        : BACKEND_URL;

      const res = await fetch(`${BACKEND_URL}/api/payments/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ origin_url: originUrl }),
      });

      if (!res.ok) {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Failed to create checkout session');
        return;
      }

      const data = await res.json();

      if (data.url) {
        if (Platform.OS === 'web') {
          window.location.href = data.url;
        } else {
          await Linking.openURL(data.url);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account and all your data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              if (!token) return;
              const res = await fetch(`${BACKEND_URL}/api/user/account`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (res.ok) {
                await AsyncStorage.clear();
                signOut();
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  if (statusLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00d4ff" />
      </View>
    );
  }

  const isTrialExpired = status && !status.has_access;
  const trialDays = status?.trial_days_remaining || 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="diamond" size={48} color="#ffd93d" />
          </View>
          <Text style={styles.title}>
            {isTrialExpired ? 'Trial Expired' : 'Upgrade to Pro'}
          </Text>
          <Text style={styles.subtitle}>
            {isTrialExpired
              ? 'Your 14-day free trial has ended'
              : `${trialDays} days remaining in your trial`}
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>NutriOS Pro includes:</Text>
          {[
            { icon: 'analytics', color: '#00d4ff', text: 'Molecular food analysis' },
            { icon: 'water', color: '#4ecdc4', text: 'Smart hydration tracking' },
            { icon: 'time', color: '#a29bfe', text: 'Routine & discipline system' },
            { icon: 'bulb', color: '#ffd93d', text: 'AI-powered nutrition coach' },
            { icon: 'restaurant', color: '#ff6b6b', text: 'Recipe builder & meal plans' },
            { icon: 'trophy', color: '#00ff88', text: 'Gamification & badges' },
          ].map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: f.color + '20' }]}>
                <Ionicons name={f.icon as any} size={18} color={f.color} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
              <Ionicons name="checkmark-circle" size={20} color="#00ff88" />
            </View>
          ))}
        </View>

        {/* Price + Buy Button */}
        <View style={styles.priceSection}>
          <View style={styles.priceTag}>
            <Text style={styles.priceLabel}>One-time payment</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceCurrency}>\u20ac</Text>
              <Text style={styles.priceAmount}>12</Text>
            </View>
            <Text style={styles.priceNote}>Lifetime access \u2022 No subscription</Text>
          </View>

          <TouchableOpacity
            style={[styles.buyButton, loading && styles.buyButtonDisabled]}
            onPress={handleUpgrade}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="card" size={22} color="#fff" />
                <Text style={styles.buyButtonText}>Purchase NutriOS Pro</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => {
            Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut }
            ]);
          }}>
            <Ionicons name="log-out" size={18} color="#ff6b6b" />
            <Text style={styles.secondaryBtnText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount}>
            <Ionicons name="trash" size={18} color="#ff3b30" />
            <Text style={styles.dangerBtnText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#080818' },
  content: { flex: 1, padding: 20, justifyContent: 'space-between' },
  header: { alignItems: 'center', paddingTop: 20 },
  iconContainer: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255, 217, 61, 0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 2, borderColor: 'rgba(255, 217, 61, 0.25)',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#888' },
  featuresCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18,
    padding: 18, marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  featuresTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 14 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 9,
  },
  featureIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  featureText: { flex: 1, fontSize: 14, color: '#ccc' },
  priceSection: { marginTop: 20 },
  priceTag: { alignItems: 'center', marginBottom: 16 },
  priceLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  priceCurrency: { fontSize: 20, fontWeight: '700', color: '#ffd93d', marginTop: 4, marginRight: 2 },
  priceAmount: { fontSize: 48, fontWeight: '800', color: '#ffd93d' },
  priceNote: { fontSize: 12, color: '#666', marginTop: 2 },
  buyButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00d4ff', paddingVertical: 18, borderRadius: 16,
  },
  buyButtonDisabled: { opacity: 0.6 },
  buyButtonText: { fontSize: 17, fontWeight: '700', color: '#fff', marginLeft: 10 },
  bottomActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingBottom: Platform.OS === 'ios' ? 10 : 0 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 12, backgroundColor: 'rgba(255,107,107,0.08)',
  },
  secondaryBtnText: { color: '#ff6b6b', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20,
    borderRadius: 12, backgroundColor: 'rgba(255,59,48,0.08)',
  },
  dangerBtnText: { color: '#ff3b30', fontSize: 14, fontWeight: '600', marginLeft: 6 },
});
