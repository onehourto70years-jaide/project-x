import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/ThemeContext';
import { useLanguage } from '../src/LanguageContext';
import { SkeletonNotifications } from '../src/components/Skeleton';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const NOTIF_ICONS: Record<string, { icon: string; color: string }> = {
  water: { icon: 'water', color: '#00d4ff' },
  water_goal_hit: { icon: 'trophy', color: '#00ff88' },
  meal: { icon: 'restaurant', color: '#ff6b6b' },
  calorie_check: { icon: 'analytics', color: '#ffd93d' },
  routine: { icon: 'time', color: '#a29bfe' },
  streak_risk: { icon: 'flame', color: '#ff6b6b' },
  streak_milestone: { icon: 'trophy', color: '#ffd93d' },
  inactivity: { icon: 'hand-left', color: '#ff9f43' },
  summary: { icon: 'bar-chart', color: '#00d4ff' },
  badge: { icon: 'medal', color: '#ffd93d' },
  test: { icon: 'flask', color: '#a29bfe' },
};

interface NotificationItem {
  type: string;
  title: string;
  body: string;
  sent_at: string;
  read: boolean;
}

export default function NotificationCenterScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [schedule, setSchedule] = useState<any>(null);

  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const [historyRes, scheduleRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/notifications/history?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${BACKEND_URL}/api/notifications/schedule`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);
      if (historyRes.ok) {
        const data = await historyRes.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
      if (scheduleRes.ok) {
        const data = await scheduleRes.json();
        setSchedule(data.schedule);
      }
    } catch (e) {
      console.log('Failed to load notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchNotifications(); }, []));

  const markAllRead = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      await fetch(`${BACKEND_URL}/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.log('Failed to mark read:', e);
    }
  };

  const formatTime = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      if (diffDay < 7) return `${diffDay}d ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  const getNotifMeta = (type: string) => {
    return NOTIF_ICONS[type] || { icon: 'notifications', color: '#888' };
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.bgCard }]}
          accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('notif_center_title')}</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={[styles.markReadBtn, { backgroundColor: theme.bgCard }]}>
            <Ionicons name="checkmark-done" size={18} color={theme.accent} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <SkeletonNotifications />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor={theme.accent} />
          }
        >
          {/* Schedule Info Card */}
          {schedule && (
            <View style={[styles.scheduleCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <View style={styles.scheduleHeader}>
                <Ionicons name="calendar-outline" size={18} color={theme.accent} />
                <Text style={[styles.scheduleTitle, { color: theme.text }]}>{t('notif_schedule_title')}</Text>
                <View style={[styles.smartBadge, { backgroundColor: 'rgba(0,255,136,0.15)' }]}>
                  <Text style={styles.smartBadgeText}>{t('notif_smart_label')}</Text>
                </View>
              </View>
              <View style={styles.scheduleGrid}>
                {[
                  { icon: 'water', color: '#00d4ff', label: t('set_water_reminders'), desc: schedule.water_reminders?.description, enabled: schedule.water_reminders?.enabled },
                  { icon: 'restaurant', color: '#ff6b6b', label: t('set_meal_reminders'), desc: schedule.meal_reminders?.description, enabled: schedule.meal_reminders?.enabled },
                  { icon: 'time', color: '#a29bfe', label: t('set_routine_reminders'), desc: schedule.routine_reminders?.description, enabled: schedule.routine_reminders?.enabled },
                ].map((item, idx) => (
                  <View key={idx} style={[styles.scheduleItem, { backgroundColor: item.enabled ? (item.color + '10') : 'rgba(255,255,255,0.03)' }]}>
                    <Ionicons name={item.icon as any} size={16} color={item.enabled ? item.color : theme.textDim} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={[styles.scheduleItemLabel, { color: item.enabled ? theme.text : theme.textDim }]}>{item.label}</Text>
                      <Text style={[styles.scheduleItemDesc, { color: theme.textMuted }]}>{item.desc}</Text>
                    </View>
                    <View style={[styles.statusDot, { backgroundColor: item.enabled ? '#00ff88' : '#ff6b6b' }]} />
                  </View>
                ))}
              </View>
              <View style={styles.smartAlertsSection}>
                <Text style={[styles.smartAlertsTitle, { color: theme.textMuted }]}>Smart Alerts</Text>
                {schedule.smart_alerts && Object.entries(schedule.smart_alerts).map(([key, val]) => (
                  <View key={key} style={styles.smartAlertRow}>
                    <Ionicons name="flash" size={12} color="#ffd93d" />
                    <Text style={[styles.smartAlertText, { color: theme.textMuted }]}>{String(val)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Notification History */}
          <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
            {t('notif_center_subtitle')}
          </Text>

          {notifications.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
              <Ionicons name="notifications-off-outline" size={48} color={theme.textDim} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('notif_center_empty')}</Text>
              <Text style={[styles.emptyDesc, { color: theme.textMuted }]}>{t('notif_center_empty_desc')}</Text>
            </View>
          ) : (
            notifications.map((notif, index) => {
              const meta = getNotifMeta(notif.type);
              return (
                <View key={index} style={[styles.notifItem, { backgroundColor: theme.bgCard, borderColor: theme.border }, !notif.read && styles.notifUnread]}>
                  <View style={[styles.notifIconContainer, { backgroundColor: meta.color + '15' }]}>
                    <Ionicons name={meta.icon as any} size={20} color={meta.color} />
                  </View>
                  <View style={styles.notifContent}>
                    <View style={styles.notifTitleRow}>
                      <Text style={[styles.notifTitle, { color: theme.text }]} numberOfLines={1}>{notif.title}</Text>
                      {!notif.read && <View style={[styles.unreadDot, { backgroundColor: theme.accent }]} />}
                    </View>
                    <Text style={[styles.notifBody, { color: theme.textMuted }]} numberOfLines={2}>{notif.body}</Text>
                    <Text style={[styles.notifTime, { color: theme.textDim }]}>{formatTime(notif.sent_at)}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  unreadBadge: { backgroundColor: '#ff6b6b', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  markReadBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Schedule card
  scheduleCard: { borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1 },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  scheduleTitle: { fontSize: 16, fontWeight: '700', marginLeft: 8, flex: 1 },
  smartBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  smartBadgeText: { color: '#00ff88', fontSize: 11, fontWeight: '700' },
  scheduleGrid: { gap: 8 },
  scheduleItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  scheduleItemLabel: { fontSize: 13, fontWeight: '600' },
  scheduleItemDesc: { fontSize: 11, marginTop: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  smartAlertsSection: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  smartAlertsTitle: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  smartAlertRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  smartAlertText: { fontSize: 12 },

  // Notification items
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  notifItem: { flexDirection: 'row', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1 },
  notifUnread: { borderLeftWidth: 3, borderLeftColor: '#00d4ff' },
  notifIconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notifContent: { flex: 1 },
  notifTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifTitle: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  notifTime: { fontSize: 11, marginTop: 4 },

  // Empty state
  emptyState: { alignItems: 'center', padding: 40, borderRadius: 16, borderWidth: 1 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptyDesc: { fontSize: 13, marginTop: 8, textAlign: 'center' },
});
