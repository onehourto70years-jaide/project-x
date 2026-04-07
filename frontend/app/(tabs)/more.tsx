import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { useLanguage } from '../../src/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hapticLight, hapticWarning } from '../../src/haptics';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();

  const MENU_SECTIONS = [
    {
      title: t('more_tracking'),
      items: [
        { id: 'track', label: t('more_nutrition_log'), icon: 'analytics', color: '#00d4ff', route: '/(tabs)/track' },
        { id: 'favorites', label: t('more_food_favorites'), icon: 'heart', color: '#ff6b6b', route: '/favorites' },
        { id: 'scanner', label: t('more_barcode_scanner'), icon: 'barcode', color: '#ffd93d', route: '/scanner' },
        { id: 'progress', label: t('more_progress_charts'), icon: 'stats-chart', color: '#4ecdc4', route: '/progress' },
        { id: 'weight', label: t('more_weight'), icon: 'scale', color: '#00ff88', route: '/weight' },
      ]
    },
    {
      title: t('more_planning'),
      items: [
        { id: 'recipes', label: t('more_recipe_builder'), icon: 'restaurant', color: '#a29bfe', route: '/recipes' },
        { id: 'mealplan', label: t('more_meal_planner'), icon: 'calendar', color: '#fd79a8', route: '/meal-plan' },
      ]
    },
    {
      title: t('more_ai_insights'),
      items: [
        { id: 'coach', label: t('more_ai_coach'), icon: 'sparkles', color: '#00d4ff', route: '/ai-home' },
        { id: 'sequence', label: t('more_sequence_optimizer'), icon: 'git-branch', color: '#ffd93d', route: '/sequence-optimizer' },
        { id: 'ai', label: t('more_ai_recommendations'), icon: 'bulb', color: '#ffd93d', route: '/(tabs)/ai' },
      ]
    },
    {
      title: t('more_social'),
      items: [
        { id: 'badges', label: t('more_badges'), icon: 'trophy', color: '#ffd93d', route: '/badges' },
        { id: 'share', label: t('more_share_report'), icon: 'share-social', color: '#00d4ff', route: 'share' },
      ]
    },
    {
      title: t('more_account'),
      items: [
        { id: 'settings', label: t('more_settings'), icon: 'settings', color: '#888', route: '/settings' },
        { id: 'profile', label: t('more_profile'), icon: 'person', color: '#a29bfe', route: '/(tabs)/profile' },
      ]
    }
  ];

  const handleItemPress = async (item: any) => {
    hapticLight();
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
    hapticWarning();
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
          <Text style={styles.logoutText}>{t('set_logout')}</Text>
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
