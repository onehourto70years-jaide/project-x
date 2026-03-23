import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../_layout';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const MENU_ITEMS = [
  { id: 'progress', title: 'Progress Charts', subtitle: 'Track your trends', icon: 'analytics', color: '#00d4ff', route: '/progress' },
  { id: 'favorites', title: 'Favorites', subtitle: 'Quick access foods', icon: 'star', color: '#ffd93d', route: '/favorites' },
  { id: 'recipes', title: 'Recipe Builder', subtitle: 'Create custom recipes', icon: 'restaurant', color: '#4ecdc4', route: '/recipes' },
  { id: 'mealplan', title: 'Meal Planning', subtitle: 'Plan your week', icon: 'calendar', color: '#a29bfe', route: '/meal-plan' },
  { id: 'scanner', title: 'Barcode Scanner', subtitle: 'Scan packaged foods', icon: 'barcode', color: '#ff6b6b', route: '/scanner' },
  { id: 'ai', title: 'AI Recommendations', subtitle: 'Personalized suggestions', icon: 'sparkles', color: '#fd79a8', route: '/ai-home' },
  { id: 'settings', title: 'Settings', subtitle: 'App preferences', icon: 'settings', color: '#888', route: '/settings' },
];

export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState({ favorites: 0, recipes: 0, meals_logged: 0 });

  const fetchStats = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const [favRes, recRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/favorites`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/recipes`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (favRes.ok) {
        const data = await favRes.json();
        setStats(prev => ({ ...prev, favorites: data.favorites?.length || 0 }));
      }
      if (recRes.ok) {
        const data = await recRes.json();
        setStats(prev => ({ ...prev, recipes: data.recipes?.length || 0 }));
      }
    } catch (e) {}
  };

  useFocusEffect(useCallback(() => { fetchStats(); }, []));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Ionicons name="chevron-forward" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.favorites}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.recipes}</Text>
            <Text style={styles.statLabel}>Recipes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.weight_kg || 70}</Text>
            <Text style={styles.statLabel}>kg</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem} onPress={() => router.push(item.route as any)}>
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Ionicons name="log-out" size={20} color="#ff6b6b" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.version}>NutriOS v3.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  profileEmail: { fontSize: 13, color: '#888', marginTop: 2 },
  statsRow: { flexDirection: 'row', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  menuSection: { marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, marginBottom: 8 },
  menuIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  menuContent: { flex: 1, marginLeft: 14 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  menuSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 107, 107, 0.1)', padding: 16, borderRadius: 12, marginBottom: 16 },
  logoutText: { color: '#ff6b6b', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  version: { textAlign: 'center', color: '#444', fontSize: 12 },
});
