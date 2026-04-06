import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedFetch, CacheKeys, CacheTTL, clearCacheForKey } from '../../src/cache';

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
  const [waterData, setWaterData] = useState<WaterData | null>(null);
  const [history, setHistory] = useState<WaterHistory[]>([]);
  const [smartGoal, setSmartGoal] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

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

  const addWater = async (amount: number) => {
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
        await Promise.all([
          clearCacheForKey(CacheKeys.waterToday),
          clearCacheForKey('water_history_7'),
          clearCacheForKey(CacheKeys.dashboard),
        ]);
        fetchWaterData();
      }
    } catch (error) {
      console.error('Error adding water:', error);
      Alert.alert('Error', 'Failed to log water');
    } finally {
      setAdding(false);
    }
  };

  const getHydrationStatus = () => {
    const pct = waterData?.percentage || 0;
    if (pct >= 100) return { text: 'Goal Reached!', color: '#4ecdc4', icon: 'checkmark-circle' };
    if (pct >= 75) return { text: 'Almost there!', color: '#00d4ff', icon: 'water' };
    if (pct >= 50) return { text: 'Keep drinking!', color: '#ffd93d', icon: 'water-outline' };
    return { text: 'Need more water', color: '#ff6b6b', icon: 'alert-circle' };
  };

  const status = getHydrationStatus();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWaterData(); }} tintColor="#00d4ff" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Water Tracking</Text>
          <Text style={styles.subtitle}>Stay hydrated, stay healthy</Text>
        </View>

        {isOffline && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,217,61,0.12)', paddingVertical: 8, marginHorizontal: 16, marginBottom: 12, borderRadius: 10, gap: 8 }}>
            <Ionicons name="cloud-offline" size={16} color="#ffd93d" />
            <Text style={{ color: '#ffd93d', fontSize: 13, fontWeight: '500' }}>Offline — showing cached data</Text>
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
                <Text style={styles.gaugeGoal}>of {((waterData?.goal_ml || 2500) / 1000).toFixed(1)}L</Text>
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
          <Text style={styles.sectionTitle}>Quick Add</Text>
          <View style={styles.quickAddGrid}>
            {[{ amount: 250, label: '1 Glass', icon: 'water' }, { amount: 500, label: '2 Glasses', icon: 'water' }, { amount: 750, label: 'Bottle', icon: 'water' }, { amount: 1000, label: 'Large', icon: 'water' }].map((item) => (
              <TouchableOpacity
                key={item.amount}
                style={[styles.quickAddBtn, adding && styles.quickAddBtnDisabled]}
                onPress={() => addWater(item.amount)}
                disabled={adding}
              >
                <Ionicons name={item.icon as any} size={24} color="#00d4ff" />
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
              <Ionicons name="sparkles" size={18} color="#ffd93d" />
              <Text style={styles.smartGoalTitle}>Smart Hydration Goal</Text>
            </View>
            <Text style={styles.smartGoalValue}>{(smartGoal.recommended_ml / 1000).toFixed(1)}L recommended</Text>
            <View style={styles.smartGoalFactors}>
              <View style={styles.factor}>
                <Ionicons name="body" size={14} color="#888" />
                <Text style={styles.factorText}>{smartGoal.weight_kg}kg</Text>
              </View>
              <View style={styles.factor}>
                <Ionicons name="fitness" size={14} color="#888" />
                <Text style={styles.factorText}>{smartGoal.activity_level}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Today's Logs */}
        <View style={styles.logsSection}>
          <Text style={styles.sectionTitle}>Today's Log ({waterData?.logs?.length || 0} entries)</Text>
          {waterData?.logs && waterData.logs.length > 0 ? (
            waterData.logs.slice().reverse().slice(0, 8).map((log, index) => (
              <View key={log.id || index} style={styles.logItem}>
                <View style={styles.logIcon}>
                  <Ionicons name="water" size={16} color="#00d4ff" />
                </View>
                <Text style={styles.logAmount}>{log.amount_ml}ml</Text>
                <Text style={styles.logTime}>
                  {new Date(log.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyLogs}>
              <Ionicons name="water-outline" size={40} color="#444" />
              <Text style={styles.emptyText}>No water logged yet today</Text>
            </View>
          )}
        </View>

        {/* Weekly History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.historyChart}>
            {history.map((day, index) => {
              const goal = waterData?.goal_ml || 2500;
              const pct = Math.min((day.total_ml / goal) * 100, 100);
              return (
                <View key={day.date} style={styles.historyBar}>
                  <View style={styles.historyBarBg}>
                    <View style={[styles.historyBarFill, { height: `${pct}%`, backgroundColor: pct >= 100 ? '#4ecdc4' : pct >= 50 ? '#00d4ff' : '#ff6b6b' }]} />
                  </View>
                  <Text style={styles.historyDay}>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.sectionTitle}>Hydration Tips</Text>
          {['Drink a glass of water first thing in the morning', 'Set reminders every 2 hours', 'Eat water-rich foods like cucumbers and watermelon', 'Drink before you feel thirsty'].map((tip, i) => (
            <View key={i} style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4ecdc4" />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 20, marginTop: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  gaugeCard: { backgroundColor: '#1a1a2e', borderRadius: 20, padding: 24, marginBottom: 16, alignItems: 'center' },
  gaugeContainer: { alignItems: 'center', marginBottom: 20 },
  gauge: { width: 140, height: 180, backgroundColor: '#2a2a4e', borderRadius: 70, overflow: 'hidden', justifyContent: 'flex-end' },
  gaugeFill: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#00d4ff', opacity: 0.6 },
  gaugeContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  gaugeAmount: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  gaugeGoal: { fontSize: 12, color: '#888' },
  statusBadge: { marginTop: 12 },
  statusText: { fontSize: 16, fontWeight: '600' },
  percentageRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  percentageBar: { flex: 1, height: 8, backgroundColor: '#2a2a4e', borderRadius: 4, marginRight: 12 },
  percentageFill: { height: 8, backgroundColor: '#00d4ff', borderRadius: 4 },
  percentageText: { fontSize: 16, fontWeight: 'bold', color: '#00d4ff', width: 50, textAlign: 'right' },
  quickAddSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  quickAddGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  quickAddBtn: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginHorizontal: 4, alignItems: 'center' },
  quickAddBtnDisabled: { opacity: 0.5 },
  quickAddAmount: { fontSize: 14, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  quickAddLabel: { fontSize: 10, color: '#888', marginTop: 2 },
  smartGoalCard: { backgroundColor: 'rgba(255, 217, 61, 0.1)', borderRadius: 16, padding: 16, marginBottom: 16 },
  smartGoalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  smartGoalTitle: { fontSize: 14, fontWeight: '600', color: '#ffd93d', marginLeft: 8 },
  smartGoalValue: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  smartGoalFactors: { flexDirection: 'row' },
  factor: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  factorText: { color: '#888', fontSize: 12, marginLeft: 4 },
  logsSection: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  logItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a4e' },
  logIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0, 212, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  logAmount: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '500', color: '#fff' },
  logTime: { fontSize: 12, color: '#888' },
  emptyLogs: { alignItems: 'center', padding: 30 },
  emptyText: { color: '#666', marginTop: 12 },
  historySection: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  historyChart: { flexDirection: 'row', justifyContent: 'space-between', height: 100, alignItems: 'flex-end' },
  historyBar: { alignItems: 'center', flex: 1 },
  historyBarBg: { width: 20, height: 70, backgroundColor: '#2a2a4e', borderRadius: 10, justifyContent: 'flex-end', overflow: 'hidden' },
  historyBarFill: { width: '100%', borderRadius: 10 },
  historyDay: { fontSize: 10, color: '#888', marginTop: 6 },
  tipsCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16 },
  tipItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tipText: { color: '#aaa', fontSize: 13, marginLeft: 10, flex: 1 },
});
