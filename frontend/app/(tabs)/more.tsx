import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const MENU_SECTIONS = [
  {
    title: 'Tracking',
    items: [
      { id: 'track', label: 'Nutrition Log', icon: 'analytics', color: '#00d4ff', route: '/(tabs)/track' },
      { id: 'favorites', label: 'Food Favorites', icon: 'heart', color: '#ff6b6b', route: '/favorites' },
      { id: 'scanner', label: 'Barcode Scanner', icon: 'barcode', color: '#ffd93d', route: '/scanner' },
      { id: 'progress', label: 'Progress Charts', icon: 'stats-chart', color: '#4ecdc4', route: '/progress' },
    ]
  },
  {
    title: 'Planning',
    items: [
      { id: 'recipes', label: 'Recipe Builder', icon: 'restaurant', color: '#a29bfe', route: '/recipes' },
      { id: 'mealplan', label: 'Meal Planner', icon: 'calendar', color: '#fd79a8', route: '/meal-plan' },
    ]
  },
  {
    title: 'AI & Insights',
    items: [
      { id: 'coach', label: 'AI Nutrition Coach', icon: 'sparkles', color: '#00d4ff', route: '/ai-home' },
      { id: 'sequence', label: 'Sequence Optimizer', icon: 'git-branch', color: '#ffd93d', route: '/sequence-optimizer' },
      { id: 'ai', label: 'AI Recommendations', icon: 'bulb', color: '#ffd93d', route: '/(tabs)/ai' },
    ]
  },
  {
    title: 'Social & Achievements',
    items: [
      { id: 'badges', label: 'Badges & Achievements', icon: 'trophy', color: '#ffd93d', route: '/badges' },
      { id: 'share', label: 'Share Daily Report', icon: 'share-social', color: '#00d4ff', route: 'share' },
    ]
  },
  {
    title: 'Account',
    items: [
      { id: 'settings', label: 'Settings', icon: 'settings', color: '#888', route: '/settings' },
      { id: 'profile', label: 'Profile', icon: 'person', color: '#a29bfe', route: '/(tabs)/profile' },
    ]
  }
];

export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const handleItemPress = async (item: any) => {
    if (item.route === 'share') {
      try {
        const token = await AsyncStorage.getItem('session_token');
        const res = await fetch(`${BACKEND_URL}/api/share/daily-summary`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          await Share.share({ message: data.text, title: 'My NutriOS Daily Report' });
        } else {
          Alert.alert('No Data', 'Start tracking to share your progress!');
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to generate share data');
      }
    } else {
      router.push(item.route as any);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/settings')}>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Menu Sections */}
        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity key={item.id} style={[styles.menuItem, idx < section.items.length - 1 && styles.menuItemBorder]}
                  onPress={() => handleItemPress(item)}>
                  <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#333" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#ff6b6b" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>NutriOS v3.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d22', borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.1)' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  userInfo: { flex: 1, marginLeft: 14 },
  userName: { fontSize: 17, fontWeight: '700', color: '#fff' },
  userEmail: { fontSize: 13, color: '#666', marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#555', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: '#0d0d22', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  menuIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  menuLabel: { flex: 1, color: '#ddd', fontSize: 15, fontWeight: '500', marginLeft: 14 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 107, 107, 0.1)', borderRadius: 14, padding: 16, marginTop: 8 },
  logoutText: { color: '#ff6b6b', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  version: { textAlign: 'center', color: '#333', fontSize: 12, marginTop: 20 },
});
