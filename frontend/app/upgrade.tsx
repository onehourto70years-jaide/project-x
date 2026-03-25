import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform, ActivityIndicator, Alert, Linking, ScrollView } from 'react-native';
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

  const features = [
    { icon: 'analytics', color: '#00d4ff', text: 'Molecular food analysis' },
    { icon: 'water', color: '#4ecdc4', text: 'Smart hydration tracking' },
    { icon: 'time', color: '#a29bfe', text: 'Routine & discipline system' },
    { icon: 'bulb', color: '#ffd93d', text: 'AI-powered nutrition coach' },
    { icon: 'restaurant', color: '#ff6b6b', text: 'Recipe builder & meal plans' },
    { icon: 'trophy', color: '#00ff88', text: 'Gamification & badges' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button - only when trial is still active */}
      {!isTrialExpired && (
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="diamond" size={44} color="#ffd93d" />
          </View>
          <Text style={styles.title}>
            {isTrialExpired ? 'Trial Expired' : 'Upgrade to Pro'}
          </Text>
          <Text style={styles.subtitle}>
            {isTrialExpired
              ? 'Your 14-day free trial has ended'
              : `${trialDays} days remaining in your free trial`}
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          <Text style={styles.featuresTitle}>Everything in NutriOS Pro:</Text>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: f.color + '20' }]}>
                <Ionicons name={f.icon as any} size={16} color={f.color} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
              <Ionicons name="checkmark-circle" size={18} color="#00ff88" />
            </View>
          ))}
        </View>

        {/* Price */}
        <View style={styles.priceTag}>
          <Text style={styles.priceLabel}>ONE-TIME PAYMENT</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceCurrency}>{'\u20ac'}</Text>
            <Text style={styles.priceAmount}>12</Text>
          </View>
          <Text style={styles.priceNote}>Lifetime access {'\u2022'} No subscription</Text>
        </View>

        {/* Bottom actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => {
            Alert.alert('Sign Out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign Out', style: 'destructive', onPress: signOut }
            ]);
          }}>
            <Ionicons name="log-out" size={16} color="#ff6b6b" />
            <Text style={styles.secondaryBtnText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteAccount}>
            <Ionicons name="trash" size={16} color="#ff3b30" />
            <Text style={styles.dangerBtnText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FIXED BOTTOM: Purchase Button - always visible */}
      <View style={styles.fixedBottom}>
        <TouchableOpacity
          style={[styles.buyButton, loading && styles.buyButtonDisabled]}
          onPress={handleUpgrade}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Ionicons name="card" size={22} color="#000" />
              <Text style={styles.buyButtonText}>Purchase NutriOS Pro</Text>
              <Text style={styles.buyButtonPrice}>{'\u20ac'}12</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#080818' },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, left: 16, zIndex: 10,
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  header: { alignItems: 'center', paddingTop: 20, marginBottom: 20 },
  iconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255, 217, 61, 0.12)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, borderWidth: 2, borderColor: 'rgba(255, 217, 61, 0.25)',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#888', textAlign: 'center' },
  featuresCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  featuresTitle: { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 10 },
  featureRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
  },
  featureIcon: {
    width: 30, height: 30, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  featureText: { flex: 1, fontSize: 13, color: '#ccc' },
  priceTag: { alignItems: 'center', marginTop: 24, marginBottom: 16 },
  priceLabel: { fontSize: 11, color: '#888', letterSpacing: 1.5, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  priceCurrency: { fontSize: 18, fontWeight: '700', color: '#ffd93d', marginTop: 4, marginRight: 2 },
  priceAmount: { fontSize: 44, fontWeight: '800', color: '#ffd93d' },
  priceNote: { fontSize: 12, color: '#666', marginTop: 2 },
  bottomActions: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 20 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: 'rgba(255,107,107,0.08)',
  },
  secondaryBtnText: { color: '#ff6b6b', fontSize: 13, fontWeight: '600', marginLeft: 6 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, backgroundColor: 'rgba(255,59,48,0.08)',
  },
  dangerBtnText: { color: '#ff3b30', fontSize: 13, fontWeight: '600', marginLeft: 6 },
  fixedBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 16, paddingTop: 12,
    backgroundColor: '#080818',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  buyButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#ffd93d', paddingVertical: 18, borderRadius: 16,
  },
  buyButtonDisabled: { opacity: 0.6 },
  buyButtonText: { fontSize: 17, fontWeight: '800', color: '#000', marginLeft: 10 },
  buyButtonPrice: { fontSize: 17, fontWeight: '800', color: '#000', marginLeft: 8, opacity: 0.7 },
});
