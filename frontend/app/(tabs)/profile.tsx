import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert, Linking, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/ThemeContext';
import { useLanguage } from '../../src/LanguageContext';
import { SkeletonDashboard } from '../../src/components/Skeleton';
import { hapticLight } from '../../src/haptics';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface UserStats {
  days_logged: number;
  foods_tracked: number;
  water_logs: number;
  badges_earned: number;
  recipes_created: number;
  weight_entries: number;
  member_since: string;
}

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/user/stats`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchStats(); }, []));

  const handleLogout = () => {
    Alert.alert(
      t('alert_sign_out'),
      t('alert_sign_out_confirm'),
      [
        { text: t('common_cancel'), style: 'cancel' },
        { text: t('alert_sign_out'), style: 'destructive', onPress: signOut }
      ]
    );
  };

  const STAT_CARDS = [
    { key: 'days_logged', icon: 'calendar', color: '#00d4ff', label: 'Days Logged' },
    { key: 'foods_tracked', icon: 'restaurant', color: '#4ecdc4', label: 'Foods Tracked' },
    { key: 'water_logs', icon: 'water', color: '#a29bfe', label: 'Water Logs' },
    { key: 'badges_earned', icon: 'trophy', color: '#ffd93d', label: 'Badges' },
    { key: 'recipes_created', icon: 'book', color: '#ff6b6b', label: 'Recipes' },
    { key: 'weight_entries', icon: 'scale', color: '#00ff88', label: 'Weigh-ins' },
  ] as const;

  const MENU_ITEMS = [
    {
      title: 'App Information',
      items: [
        { label: 'About NutriOS', sub: 'Molecular Nutrition Engine v3.0', icon: 'information-circle', color: '#00d4ff', onPress: () => Linking.openURL('https://sites.google.com/view/jaide-one/home-page') },
        { label: 'Data Sources', sub: 'USDA FoodData Central', icon: 'server', color: '#4ecdc4' },
        { label: 'AI Engine', sub: 'Google Gemini 3 Flash', icon: 'sparkles', color: '#ffd93d' },
      ]
    },
    {
      title: 'Legal & Privacy',
      items: [
        { label: 'Privacy Policy', sub: 'GDPR Compliant', icon: 'document-text', color: '#a29bfe', onPress: () => Linking.openURL('https://sites.google.com/view/nutrios-privacypolicy/home-page') },
        { label: 'Terms of Service', sub: 'Usage guidelines', icon: 'shield-checkmark', color: '#fd79a8', onPress: () => Linking.openURL('https://sites.google.com/view/nutrios-terms-of-service/home-page') },
      ]
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>      
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStats(); }} tintColor={theme.accent} />}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatarRing, { borderColor: theme.accent }]}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.bgCard }]}>
                <Text style={[styles.avatarText, { color: theme.accent }]}>{user?.name?.charAt(0) || 'U'}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.userName, { color: theme.text }]}>{user?.name || 'User'}</Text>
          <Text style={[styles.userEmail, { color: theme.textMuted }]}>{user?.email}</Text>
          {stats?.member_since ? (
            <View style={[styles.memberBadge, { backgroundColor: theme.accent + '15' }]}>
              <Ionicons name="time-outline" size={12} color={theme.accent} />
              <Text style={[styles.memberText, { color: theme.accent }]}>Member since {stats.member_since}</Text>
            </View>
          ) : null}
        </View>

        {/* Stats Grid */}
        {loading ? (
          <View style={{ padding: 16 }}>
            <View style={[styles.statsGrid]}>
              {[1,2,3,4,5,6].map(i => (
                <View key={i} style={[styles.statCard, { backgroundColor: theme.bgCard }]}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.border }} />
                  <View style={{ width: 40, height: 20, borderRadius: 6, backgroundColor: theme.border, marginTop: 8 }} />
                  <View style={{ width: 60, height: 12, borderRadius: 4, backgroundColor: theme.border, marginTop: 4 }} />
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {STAT_CARDS.map((card) => (
              <View key={card.key} style={[styles.statCard, { backgroundColor: theme.bgCard }]}>
                <View style={[styles.statIconWrap, { backgroundColor: card.color + '15' }]}>
                  <Ionicons name={card.icon as any} size={20} color={card.color} />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>{stats?.[card.key] ?? 0}</Text>
                <Text style={[styles.statLabel, { color: theme.textMuted }]}>{card.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: theme.bgCard }]} onPress={() => { hapticLight(); router.push('/settings'); }}>
            <Ionicons name="settings-outline" size={20} color={theme.accent} />
            <Text style={[styles.quickActionText, { color: theme.text }]}>Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: theme.bgCard }]} onPress={() => { hapticLight(); router.push('/badges'); }}>
            <Ionicons name="trophy-outline" size={20} color="#ffd93d" />
            <Text style={[styles.quickActionText, { color: theme.text }]}>Badges</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: theme.bgCard }]} onPress={() => { hapticLight(); router.push('/reports'); }}>
            <Ionicons name="document-text-outline" size={20} color="#ff6b6b" />
            <Text style={[styles.quickActionText, { color: theme.text }]}>Reports</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textDim} />
          </TouchableOpacity>
        </View>

        {/* Menu Sections */}
        {MENU_ITEMS.map((section) => (
          <View key={section.title} style={styles.menuSection}>
            <Text style={[styles.menuTitle, { color: theme.textMuted }]}>{section.title}</Text>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuItem, { backgroundColor: theme.bgCard }, idx > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}
                onPress={item.onPress}
                activeOpacity={item.onPress ? 0.6 : 1}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={[styles.menuLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.menuSubtext, { color: theme.textMuted }]}>{item.sub}</Text>
                </View>
                {item.onPress && <Ionicons name="chevron-forward" size={18} color={theme.textDim} />}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Disclaimer */}
        <View style={[styles.disclaimer, { backgroundColor: theme.bgCard }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.textMuted} />
          <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>
            This app provides nutritional information for educational purposes only. 
            It is not intended as medical advice. Consult a healthcare professional 
            for personalized dietary guidance.
          </Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: 'rgba(255, 107, 107, 0.08)' }]} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#ff6b6b" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={[styles.version, { color: theme.textDim }]}>NutriOS v3.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  memberText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: '31%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flexGrow: 1,
    flexBasis: '30%',
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  quickActions: {
    marginBottom: 20,
    gap: 8,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  quickActionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  menuSection: {
    marginBottom: 20,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  menuSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  disclaimer: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    gap: 12,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    gap: 8,
  },
  logoutText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 16,
  },
});
