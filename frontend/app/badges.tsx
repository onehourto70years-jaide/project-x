import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, Animated, Share, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  earned: boolean;
}

export default function BadgesScreen() {
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState<any>({});
  const [weeklySummary, setWeeklySummary] = useState<any>({});
  const [newlyEarned, setNewlyEarned] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [shareData, setShareData] = useState<any>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchBadges = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/badges`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges || []);
        setStats(data.stats || {});
        setWeeklySummary(data.weekly_summary || {});
        setNewlyEarned(data.newly_earned || []);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }
    } catch (e) { console.error(e); }
    finally { setRefreshing(false); }
  };

  const fetchShareData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/share/daily-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setShareData(await res.json());
    } catch (e) { }
  };

  useFocusEffect(useCallback(() => { fetchBadges(); fetchShareData(); }, []));

  const handleShare = async () => {
    if (!shareData) {
      Alert.alert('No Data', 'Start tracking meals to share your progress!');
      return;
    }
    try {
      await Share.share({
        message: shareData.text,
        title: 'My NutriOS Daily Report'
      });
    } catch (e) { console.error(e); }
  };

  const earnedCount = badges.filter(b => b.earned).length;
  const totalBadges = badges.length;
  const progressPct = totalBadges > 0 ? (earnedCount / totalBadges) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-social" size={22} color="#00d4ff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBadges(); }} tintColor="#00d4ff" />}
        showsVerticalScrollIndicator={false}>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Weekly Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryGlow} />
            <Text style={styles.summaryTitle}>This Week</Text>
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{weeklySummary.meals_this_week || 0}</Text>
                <Text style={styles.statLabel}>Meals</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#ff6b6b' }]}>{weeklySummary.current_streak || 0}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#ffd93d' }]}>{earnedCount}/{totalBadges}</Text>
                <Text style={styles.statLabel}>Badges</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(progressPct)}% Complete</Text>
            </View>
          </View>

          {/* Share Button */}
          <TouchableOpacity style={styles.shareCard} onPress={handleShare}>
            <LinearGradient colors={['rgba(0, 212, 255, 0.15)', 'rgba(162, 155, 254, 0.15)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.shareGradient}>
              <Ionicons name="share-social" size={24} color="#00d4ff" />
              <View style={styles.shareInfo}>
                <Text style={styles.shareTitle}>Share Daily Report</Text>
                <Text style={styles.shareSubtitle}>Share your elemental intake with friends</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#666" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Newly Earned Alert */}
          {newlyEarned.length > 0 && (
            <View style={styles.newBadgeAlert}>
              <Ionicons name="trophy" size={24} color="#ffd93d" />
              <Text style={styles.newBadgeText}>
                You just earned {newlyEarned.length} new badge{newlyEarned.length > 1 ? 's' : ''}! 🎉
              </Text>
            </View>
          )}

          {/* Badges Grid */}
          <Text style={styles.sectionTitle}>Badges</Text>
          <View style={styles.badgesGrid}>
            {badges.map((badge) => (
              <View key={badge.id} style={[styles.badgeCard, !badge.earned && styles.badgeCardLocked]}>
                <View style={[styles.badgeIconCircle, badge.earned ? { backgroundColor: badge.color + '20', borderColor: badge.color + '40' } : {}]}>
                  <Ionicons name={badge.icon as any} size={28} color={badge.earned ? badge.color : '#333'} />
                </View>
                <Text style={[styles.badgeName, badge.earned && { color: '#fff' }]}>{badge.name}</Text>
                <Text style={styles.badgeDesc}>{badge.description}</Text>
                {badge.earned && (
                  <View style={[styles.earnedTag, { backgroundColor: badge.color + '20' }]}>
                    <Ionicons name="checkmark" size={12} color={badge.color} />
                    <Text style={[styles.earnedText, { color: badge.color }]}>Earned</Text>
                  </View>
                )}
                {!badge.earned && (
                  <View style={styles.lockedTag}>
                    <Ionicons name="lock-closed" size={12} color="#444" />
                    <Text style={styles.lockedText}>Locked</Text>
                  </View>
                )}
                {newlyEarned.includes(badge.id) && (
                  <View style={styles.newTag}>
                    <Text style={styles.newText}>NEW!</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Milestones */}
          <Text style={styles.sectionTitle}>Milestones</Text>
          <View style={styles.milestonesCard}>
            {[
              { label: 'Total Meals Logged', val: stats.meals_logged || 0, icon: 'restaurant', color: '#4ecdc4', next: [10, 50, 100, 500].find(n => n > (stats.meals_logged || 0)) || 1000 },
              { label: 'Unique Foods', val: stats.unique_foods || 0, icon: 'flask', color: '#fd79a8', next: [5, 10, 25, 50].find(n => n > (stats.unique_foods || 0)) || 100 },
              { label: 'Recipes Created', val: stats.recipes_created || 0, icon: 'book', color: '#e17055', next: [1, 5, 10, 25].find(n => n > (stats.recipes_created || 0)) || 50 },
              { label: 'Best Streak', val: stats.streak || 0, icon: 'flame', color: '#ff6b6b', next: [3, 7, 14, 30].find(n => n > (stats.streak || 0)) || 60 },
            ].map((m) => (
              <View key={m.label} style={styles.milestoneRow}>
                <View style={[styles.milestoneIcon, { backgroundColor: m.color + '15' }]}>
                  <Ionicons name={m.icon as any} size={20} color={m.color} />
                </View>
                <View style={styles.milestoneInfo}>
                  <Text style={styles.milestoneLabel}>{m.label}</Text>
                  <View style={styles.milestoneProgress}>
                    <View style={styles.milestoneTrack}>
                      <View style={[styles.milestoneFill, { width: `${Math.min((m.val / m.next) * 100, 100)}%`, backgroundColor: m.color }]} />
                    </View>
                    <Text style={[styles.milestoneCount, { color: m.color }]}>{m.val}/{m.next}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a3e', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  shareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 212, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  summaryCard: { backgroundColor: '#0d0d22', borderRadius: 20, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.1)', overflow: 'hidden' },
  summaryGlow: { position: 'absolute', top: -40, right: -40, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(0, 212, 255, 0.06)' },
  summaryTitle: { fontSize: 15, color: '#888', fontWeight: '500', marginBottom: 20 },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 32, fontWeight: '900', color: '#00d4ff' },
  statLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: '#1a1a3e' },
  progressContainer: { alignItems: 'center' },
  progressTrack: { width: '100%', height: 6, backgroundColor: '#1a1a3e', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#00d4ff', borderRadius: 3 },
  progressText: { color: '#666', fontSize: 12, marginTop: 8 },
  shareCard: { marginBottom: 16 },
  shareGradient: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.1)' },
  shareInfo: { flex: 1, marginLeft: 14 },
  shareTitle: { color: '#fff', fontSize: 15, fontWeight: '600' },
  shareSubtitle: { color: '#666', fontSize: 12, marginTop: 2 },
  newBadgeAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 217, 61, 0.1)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255, 217, 61, 0.2)' },
  newBadgeText: { color: '#ffd93d', fontSize: 14, fontWeight: '600', marginLeft: 10, flex: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 14 },
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  badgeCard: { width: '48%', backgroundColor: '#0d0d22', borderRadius: 16, padding: 18, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  badgeCardLocked: { opacity: 0.5 },
  badgeIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#1a1a3e', justifyContent: 'center', alignItems: 'center', marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  badgeName: { fontSize: 14, fontWeight: '600', color: '#888', textAlign: 'center' },
  badgeDesc: { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 4 },
  earnedTag: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  earnedText: { fontSize: 11, fontWeight: '600', marginLeft: 4 },
  lockedTag: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#1a1a3e' },
  lockedText: { fontSize: 11, color: '#444', marginLeft: 4 },
  newTag: { position: 'absolute', top: 8, right: 8, backgroundColor: '#ffd93d', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  newText: { color: '#000', fontSize: 9, fontWeight: '900' },
  milestonesCard: { backgroundColor: '#0d0d22', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  milestoneIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  milestoneInfo: { flex: 1, marginLeft: 14 },
  milestoneLabel: { color: '#ccc', fontSize: 14, fontWeight: '500' },
  milestoneProgress: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  milestoneTrack: { flex: 1, height: 4, backgroundColor: '#1a1a3e', borderRadius: 2, overflow: 'hidden', marginRight: 10 },
  milestoneFill: { height: '100%', borderRadius: 2 },
  milestoneCount: { fontSize: 12, fontWeight: '600' },
});
