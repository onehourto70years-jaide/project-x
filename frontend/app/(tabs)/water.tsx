import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, Alert, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedFetch, CacheKeys, CacheTTL, clearCacheForKey } from '../../src/cache';
import { useLanguage } from '../../src/LanguageContext';
import { useTheme, ThemeColors } from '../../src/ThemeContext';
import { hapticMedium, hapticSuccess, hapticWarning } from '../../src/haptics';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface WaterData {
  logs: Array<{ id: string; amount_ml: number; timestamp: string }>;
  total_ml: number;
  goal_ml: number;
  percentage: number;
}

interface WaterHistory {
  date: string;
  total_ml: number;
}

export default function WaterScreen() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [waterData, setWaterData] = useState<WaterData | null>(null);
  const [history, setHistory] = useState<WaterHistory[]>([]);
  const [smartGoal, setSmartGoal] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // ─── Undo Delete State ─────────────────
  const [pendingDelete, setPendingDelete] = useState<{ id: string; amount_ml: number; timestamp: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snackbarAnim = useRef(new Animated.Value(0)).current;
  const undoCountdown = useRef(5);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(5);

  const fetchWaterData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const authHeaders = { 'Authorization': `Bearer ${token}` };

      const [todayResult, historyResult, smartResult] = await Promise.all([
        cachedFetch(CacheKeys.waterToday, async () => {
          const res = await fetch(`${BACKEND_URL}/api/water/today`, { headers: authHeaders });
          if (!res.ok) throw new Error('water today failed');
          return res.json();
        }, CacheTTL.SHORT),
        cachedFetch('water_history_7', async () => {
          const res = await fetch(`${BACKEND_URL}/api/water/history?days=7`, { headers: authHeaders });
          if (!res.ok) throw new Error('water history failed');
          return res.json();
        }, CacheTTL.SHORT),
        cachedFetch('water_smart_goal', async () => {
          const res = await fetch(`${BACKEND_URL}/api/water/smart-goal`, { headers: authHeaders });
          if (!res.ok) throw new Error('smart goal failed');
          return res.json();
        }, CacheTTL.MEDIUM),
      ]);

      setWaterData(todayResult.data);
      setHistory(historyResult.data?.history || []);
      setSmartGoal(smartResult.data);
      setIsOffline(todayResult.fromCache || historyResult.fromCache);
    } catch (error) {
      console.error('Error fetching water data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchWaterData(); }, []));

  // ─── Pull-to-refresh: clear cache FIRST, then fetch ────
  const onPullRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      clearCacheForKey(CacheKeys.waterToday),
      clearCacheForKey('water_history_7'),
      clearCacheForKey('water_smart_goal'),
    ]);
    fetchWaterData();
  };

  const addWater = async (amount: number) => {
    hapticMedium();
    setAdding(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/water`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount_ml: amount })
      });

      if (response.ok) {
        hapticSuccess();
        await Promise.all([
          clearCacheForKey(CacheKeys.waterToday),
          clearCacheForKey('water_history_7'),
          clearCacheForKey(CacheKeys.dashboard),
        ]);
        fetchWaterData();
      }
    } catch (error) {
      console.error('Error adding water:', error);
      Alert.alert(t('alert_error'), t('alert_failed_water'));
    } finally {
      setAdding(false);
    }
  };

  // ─── Delete Water Log (with Undo) ─────
  const deleteWaterLog = async (logId: string, amount: number, timestamp: string) => {
    hapticWarning();
    // Cancel any previous pending delete first
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      // Commit the previous pending delete immediately
      if (pendingDelete) {
        commitDelete(pendingDelete.id);
      }
    }

    // Optimistically remove from UI
    if (waterData) {
      setWaterData({
        ...waterData,
        logs: waterData.logs.filter(l => l.id !== logId),
        total_ml: waterData.total_ml - amount,
        percentage: Math.max(0, Math.round(((waterData.total_ml - amount) / waterData.goal_ml) * 1000) / 10),
      });
    }

    // Set pending delete & show snackbar
    setPendingDelete({ id: logId, amount_ml: amount, timestamp });
    setUndoSecondsLeft(5);
    undoCountdown.current = 5;

    Animated.spring(snackbarAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();

    // Countdown timer
    const countdownInterval = setInterval(() => {
      undoCountdown.current -= 1;
      setUndoSecondsLeft(undoCountdown.current);
      if (undoCountdown.current <= 0) clearInterval(countdownInterval);
    }, 1000);

    // Auto-commit after 5s
    undoTimerRef.current = setTimeout(() => {
      clearInterval(countdownInterval);
      commitDelete(logId);
      hideSnackbar();
    }, 5000);
  };

  const commitDelete = async (logId: string) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      await fetch(`${BACKEND_URL}/api/water/${logId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await Promise.all([
        clearCacheForKey(CacheKeys.waterToday),
        clearCacheForKey('water_history_7'),
        clearCacheForKey(CacheKeys.dashboard),
      ]);
    } catch (e) {
      console.error('Error committing water delete:', e);
    }
  };

  const undoDelete = () => {
    hapticMedium();
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    // Restore the log to UI by re-fetching
    setPendingDelete(null);
    hideSnackbar();
    // Re-fetch fresh data
    clearCacheForKey(CacheKeys.waterToday).then(() => {
      clearCacheForKey('water_history_7').then(() => fetchWaterData());
    });
  };

  const hideSnackbar = () => {
    Animated.timing(snackbarAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      setPendingDelete(null);
    });
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const getHydrationStatus = () => {
    const pct = waterData?.percentage || 0;
    if (pct >= 100) return { text: t('water_goal_reached'), color: theme.teal, icon: 'checkmark-circle' };
    if (pct >= 75) return { text: t('water_almost'), color: theme.accent, icon: 'water' };
    if (pct >= 50) return { text: t('water_keep_drinking'), color: theme.warning, icon: 'water-outline' };
    return { text: t('water_need_more'), color: theme.danger, icon: 'alert-circle' };
  };

  const status = getHydrationStatus();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('water_title')}</Text>
          <Text style={styles.subtitle}>{t('water_subtitle')}</Text>
        </View>

        {isOffline && (
          <View style={styles.offlineBanner}>
            <Ionicons name="cloud-offline" size={16} color={theme.warning} />
            <Text style={styles.offlineText}>{t('dash_offline')}</Text>
          </View>
        )}

        {/* Main Gauge */}
        <View style={styles.gaugeCard}>
          <View style={styles.gaugeContainer}>
            <View style={styles.gauge}>
              <View style={[styles.gaugeFill, { height: `${Math.min(waterData?.percentage || 0, 100)}%` }]} />
              <View style={styles.gaugeContent}>
                <Ionicons name={status.icon as any} size={32} color={status.color} />
                <Text style={styles.gaugeAmount}>{((waterData?.total_ml || 0) / 1000).toFixed(1)}L</Text>
                <Text style={styles.gaugeGoal}>{t('common_of')} {((waterData?.goal_ml || 2500) / 1000).toFixed(1)}L</Text>
              </View>
            </View>
            <View style={styles.statusBadge}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
            </View>
          </View>

          {/* Percentage */}
          <View style={styles.percentageRow}>
            <View style={styles.percentageBar}>
              <View style={[styles.percentageFill, { width: `${Math.min(waterData?.percentage || 0, 100)}%` }]} />
            </View>
            <Text style={styles.percentageText}>{Math.round(waterData?.percentage || 0)}%</Text>
          </View>
        </View>

        {/* Quick Add Buttons */}
        <View style={styles.quickAddSection}>
          <Text style={styles.sectionTitle}>{t('water_quick_add')}</Text>
          <View style={styles.quickAddGrid}>
            {[{ amount: 250, label: t('water_glass_1'), icon: 'water' }, { amount: 500, label: t('water_glass_2'), icon: 'water' }, { amount: 750, label: t('water_bottle'), icon: 'water' }, { amount: 1000, label: t('water_large'), icon: 'water' }].map((item) => (
              <TouchableOpacity
                key={item.amount}
                style={[styles.quickAddBtn, adding && styles.quickAddBtnDisabled]}
                onPress={() => addWater(item.amount)}
                disabled={adding}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: +${item.amount}ml`}
                accessibilityState={{ disabled: adding }}
              >
                <Ionicons name={item.icon as any} size={24} color={theme.accent} />
                <Text style={styles.quickAddAmount}>+{item.amount}ml</Text>
                <Text style={styles.quickAddLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Smart Goal */}
        {smartGoal && (
          <View style={styles.smartGoalCard}>
            <View style={styles.smartGoalHeader}>
              <Ionicons name="sparkles" size={18} color={theme.warning} />
              <Text style={styles.smartGoalTitle}>{t('water_smart_title')}</Text>
            </View>
            <Text style={styles.smartGoalValue}>{(smartGoal.recommended_ml / 1000).toFixed(1)}L {t('water_recommended')}</Text>
            <View style={styles.smartGoalFactors}>
              <View style={styles.factor}>
                <Ionicons name="body" size={14} color={theme.textMuted} />
                <Text style={styles.factorText}>{smartGoal.weight_kg}kg</Text>
              </View>
              <View style={styles.factor}>
                <Ionicons name="fitness" size={14} color={theme.textMuted} />
                <Text style={styles.factorText}>{smartGoal.activity_level}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Today's Logs */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>{t('water_today_log')} ({waterData?.logs?.length || 0} {t('water_entries')})</Text>
          {waterData?.logs && waterData.logs.length > 0 ? (
            waterData.logs.slice().reverse().slice(0, 8).map((log, index) => (
              <View key={log.id || index} style={styles.logItem}>
                <View style={styles.logIcon}>
                  <Ionicons name="water" size={16} color={theme.accent} />
                </View>
                <Text style={styles.logAmount}>{log.amount_ml}ml</Text>
                <Text style={styles.logTime}>
                  {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteWaterLog(log.id, log.amount_ml, log.timestamp)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${log.amount_ml}ml water log`}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.danger} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyLogs}>
              <Ionicons name="water-outline" size={40} color={theme.textDim} />
              <Text style={styles.emptyText}>{t('water_no_logs')}</Text>
            </View>
          )}
        </View>

        {/* Weekly History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>{t('water_last_7')}</Text>
          <View style={styles.historyChart}>
            {history.map((day) => {
              const goal = waterData?.goal_ml || 2500;
              const pct = Math.min((day.total_ml / goal) * 100, 100);
              return (
                <View key={day.date} style={styles.historyBar}>
                  <View style={styles.historyBarBg}>
                    <View style={[styles.historyBarFill, { height: `${pct}%`, backgroundColor: pct >= 100 ? theme.teal : pct >= 50 ? theme.accent : theme.danger }]} />
                  </View>
                  <Text style={styles.historyDay}>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.sectionTitle}>{t('water_tips')}</Text>
          {[t('water_tip_1'), t('water_tip_2'), t('water_tip_3'), t('water_tip_4')].map((tip, i) => (
            <View key={i} style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color={theme.teal} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Undo Snackbar */}
      {pendingDelete && (
        <Animated.View style={[
          styles.snackbar,
          {
            transform: [{ translateY: snackbarAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }],
            opacity: snackbarAnim,
          },
        ]}>
          <View style={styles.snackbarContent}>
            <View style={styles.snackbarLeft}>
              <Ionicons name="trash" size={16} color={theme.danger} />
              <Text style={styles.snackbarText}>
                {pendingDelete.amount_ml}ml removed ({undoSecondsLeft}s)
              </Text>
            </View>
            <TouchableOpacity style={styles.undoBtn} onPress={undoDelete} activeOpacity={0.7}>
              <Text style={styles.undoBtnText}>UNDO</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

    </SafeAreaView>
  );
}

const makeStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 20, marginTop: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: theme.text },
  subtitle: { fontSize: 14, color: theme.textMuted, marginTop: 4 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: `${theme.warning}18`, paddingVertical: 8, marginHorizontal: 16, marginBottom: 12, borderRadius: 10, gap: 8 },
  offlineText: { color: theme.warning, fontSize: 13, fontWeight: '500' },
  gaugeCard: { backgroundColor: theme.bgCard, borderRadius: 20, padding: 24, marginBottom: 16, alignItems: 'center' },
  gaugeContainer: { alignItems: 'center', marginBottom: 20 },
  gauge: { width: 140, height: 180, backgroundColor: theme.bgInput, borderRadius: 70, overflow: 'hidden', justifyContent: 'flex-end' },
  gaugeFill: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: theme.accent, opacity: 0.6 },
  gaugeContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  gaugeAmount: { fontSize: 28, fontWeight: 'bold', color: theme.text, marginTop: 8 },
  gaugeGoal: { fontSize: 12, color: theme.textMuted },
  statusBadge: { marginTop: 12 },
  statusText: { fontSize: 16, fontWeight: '600' },
  percentageRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  percentageBar: { flex: 1, height: 8, backgroundColor: theme.bgInput, borderRadius: 4, marginRight: 12 },
  percentageFill: { height: 8, backgroundColor: theme.accent, borderRadius: 4 },
  percentageText: { fontSize: 16, fontWeight: 'bold', color: theme.accent, width: 50, textAlign: 'right' },
  quickAddSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.text, marginBottom: 12 },
  quickAddGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  quickAddBtn: { flex: 1, backgroundColor: theme.bgCard, borderRadius: 16, padding: 16, marginHorizontal: 4, alignItems: 'center' },
  quickAddBtnDisabled: { opacity: 0.5 },
  quickAddAmount: { fontSize: 14, fontWeight: 'bold', color: theme.text, marginTop: 8 },
  quickAddLabel: { fontSize: 10, color: theme.textMuted, marginTop: 2 },
  smartGoalCard: { backgroundColor: `${theme.warning}18`, borderRadius: 16, padding: 16, marginBottom: 16 },
  smartGoalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  smartGoalTitle: { fontSize: 14, fontWeight: '600', color: theme.warning, marginLeft: 8 },
  smartGoalValue: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 8 },
  smartGoalFactors: { flexDirection: 'row' },
  factor: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  factorText: { color: theme.textMuted, fontSize: 12, marginLeft: 4 },
  logsSection: { backgroundColor: theme.bgCard, borderRadius: 16, padding: 16, marginBottom: 16 },
  logItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.bgInput },
  logIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: `${theme.accent}18`, justifyContent: 'center', alignItems: 'center' },
  logAmount: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '500', color: theme.text },
  logTime: { fontSize: 12, color: theme.textMuted },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: `${theme.danger}12`, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  emptyLogs: { alignItems: 'center', padding: 30 },
  emptyText: { color: theme.textDim, marginTop: 12 },
  historySection: { backgroundColor: theme.bgCard, borderRadius: 16, padding: 16, marginBottom: 16 },
  historyChart: { flexDirection: 'row', justifyContent: 'space-between', height: 100, alignItems: 'flex-end' },
  historyBar: { alignItems: 'center', flex: 1 },
  historyBarBg: { width: 20, height: 70, backgroundColor: theme.bgInput, borderRadius: 10, justifyContent: 'flex-end', overflow: 'hidden' },
  historyBarFill: { width: '100%', borderRadius: 10 },
  historyDay: { fontSize: 10, color: theme.textMuted, marginTop: 6 },
  tipsCard: { backgroundColor: theme.bgCard, borderRadius: 16, padding: 16 },
  tipItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tipText: { color: theme.textSecondary, fontSize: 13, marginLeft: 10, flex: 1 },
  snackbar: { position: 'absolute', bottom: 90, left: 16, right: 16, zIndex: 100 },
  snackbarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.bgCard, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: `${theme.danger}30` },
  snackbarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  snackbarText: { fontSize: 14, color: theme.text, fontWeight: '500' },
  undoBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: `${theme.accent}18` },
  undoBtnText: { fontSize: 14, fontWeight: '700', color: theme.accent, letterSpacing: 1 },
});
