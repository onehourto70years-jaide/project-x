import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type Period = 'daily' | 'weekly' | 'monthly' | 'annual';

const PERIOD_ICONS: Record<Period, string> = { daily: '☀️', weekly: '📅', monthly: '🌙', annual: '🌟' };
const PERIOD_LABELS: Record<Period, string> = { daily: 'Today', weekly: 'This Week', monthly: 'This Month', annual: 'This Year' };

export default function FeedbackReportsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [activePeriod, setActivePeriod] = useState<Period>('daily');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReport = useCallback(async (period: Period) => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/feedback/${period}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('Feedback fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchReport(activePeriod); }, [activePeriod, fetchReport]);

  const switchPeriod = (p: Period) => { setActivePeriod(p); };

  const renderFeedback = () => {
    if (!data?.feedback) return null;
    const fb = data.feedback;
    return (
      <View style={styles.feedbackSection}>
        {/* Jaide Observation */}
        <View style={[styles.jaideCard, { backgroundColor: theme.card }]}>
          <Image source={require('../assets/jaide/jaide-cartoon.png')} style={styles.jaideAvatar} />
          <View style={styles.jaideContent}>
            <Text style={styles.jaideLabel}>JAIDE OBSERVES</Text>
            <Text style={[styles.jaideObservation, { color: theme.text }]}>"{fb.jaide_observation}"</Text>
          </View>
        </View>

        {/* Body Impact */}
        <View style={[styles.impactCard, { backgroundColor: theme.card }]}>
          <Text style={styles.cardTitle}>🧬 Body Impact</Text>
          <Text style={[styles.impactText, { color: theme.text }]}>{fb.body_impact}</Text>
        </View>

        {/* Wins */}
        {fb.wins?.length > 0 && (
          <View style={[styles.listCard, { backgroundColor: theme.card }]}>
            <Text style={styles.cardTitle}>✅ Wins</Text>
            {fb.wins.map((w: string, i: number) => (
              <View key={i} style={styles.listItem}>
                <Ionicons name="checkmark-circle" size={16} color="#00ff88" />
                <Text style={[styles.listText, { color: theme.text }]}>{w}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Improvements */}
        {fb.improvements?.length > 0 && (
          <View style={[styles.listCard, { backgroundColor: theme.card }]}>
            <Text style={styles.cardTitle}>🎯 Areas to Improve</Text>
            {fb.improvements.map((imp: string, i: number) => (
              <View key={i} style={styles.listItem}>
                <Ionicons name="arrow-forward-circle" size={16} color="#ffd93d" />
                <Text style={[styles.listText, { color: theme.text }]}>{imp}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Main Recommendation */}
        {fb.main_recommendation && (
          <View style={[styles.recommendCard, { backgroundColor: theme.card }]}>
            <Ionicons name="bulb" size={22} color="#00d4ff" />
            <Text style={[styles.recommendText, { color: theme.text }]}>{fb.main_recommendation}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderStats = () => {
    if (!data?.stats) return null;
    const s = data.stats;

    if (activePeriod === 'daily') {
      return (
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <Text style={styles.cardTitle}>📊 Today's Numbers</Text>
          <View style={styles.statsGrid}>
            <StatItem label="Calories" value={`${s.calories || 0}`} unit="kcal" color="#ff6b6b" />
            <StatItem label="Protein" value={`${s.protein_g || 0}`} unit="g" color="#6c5ce7" />
            <StatItem label="Carbs" value={`${s.carbs_g || 0}`} unit="g" color="#00cec9" />
            <StatItem label="Fat" value={`${s.fat_g || 0}`} unit="g" color="#fdcb6e" />
            <StatItem label="Fiber" value={`${s.fiber_g || 0}`} unit="g" color="#00ff88" />
            <StatItem label="Water" value={`${s.water_ml || 0}`} unit="ml" color="#00b4d8" />
          </View>
        </View>
      );
    }

    if (activePeriod === 'weekly') {
      return (
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <Text style={styles.cardTitle}>📊 Weekly Summary</Text>
          <View style={styles.statsGrid}>
            <StatItem label="Days Tracked" value={`${s.days_tracked || 0}/7`} unit="" color="#00d4ff" />
            <StatItem label="Consistency" value={`${s.consistency_pct || 0}`} unit="%" color="#00ff88" />
            <StatItem label="Avg Calories" value={`${s.avg_calories || 0}`} unit="kcal" color="#ff6b6b" />
            <StatItem label="Avg Protein" value={`${s.avg_protein || 0}`} unit="g" color="#6c5ce7" />
            <StatItem label="Avg Water" value={`${s.avg_water_ml || 0}`} unit="ml" color="#00b4d8" />
            <StatItem label="Total Meals" value={`${s.meals_count || 0}`} unit="" color="#ffd93d" />
          </View>
        </View>
      );
    }

    if (activePeriod === 'monthly') {
      return (
        <>
          <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
            <Text style={styles.cardTitle}>📊 Monthly Overview</Text>
            <View style={styles.statsGrid}>
              <StatItem label="Days Tracked" value={`${s.days_tracked || 0}`} unit="/30" color="#00d4ff" />
              <StatItem label="Unique Foods" value={`${s.unique_foods || 0}`} unit="" color="#a29bfe" />
              <StatItem label="Avg Calories" value={`${s.avg_calories || 0}`} unit="kcal" color="#ff6b6b" />
              <StatItem label="Avg Protein" value={`${s.avg_protein || 0}`} unit="g" color="#6c5ce7" />
            </View>
          </View>
          {data.evolution && (
            <View style={[styles.evolutionCard, { backgroundColor: theme.card }]}>
              <Text style={styles.cardTitle}>📈 Evolution (First Half → Second Half)</Text>
              {Object.entries(data.evolution).map(([key, vals]: [string, any]) => {
                const diff = vals.second_half_avg - vals.first_half_avg;
                const isUp = diff > 0;
                return (
                  <View key={key} style={styles.evolutionRow}>
                    <Text style={[styles.evolutionLabel, { color: theme.text }]}>{key.replace(/_/g, ' ')}</Text>
                    <Text style={styles.evolutionOld}>{vals.first_half_avg || vals.first_half}</Text>
                    <Ionicons name={isUp ? 'arrow-up' : diff < 0 ? 'arrow-down' : 'remove'} size={14} color={isUp ? '#00ff88' : diff < 0 ? '#ff6b6b' : '#666'} />
                    <Text style={[styles.evolutionNew, { color: isUp ? '#00ff88' : diff < 0 ? '#ff6b6b' : '#ccc' }]}>{vals.second_half_avg || vals.second_half}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </>
      );
    }

    // Annual
    if (data?.insufficient_data) {
      return (
        <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
          <Ionicons name="hourglass" size={40} color="#444" />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Building Your Story</Text>
          <Text style={styles.emptyText}>{data.message}</Text>
          <Text style={styles.emptyMeta}>{data.days_tracked || 0} days tracked so far</Text>
        </View>
      );
    }

    if (data?.quarterly) {
      return (
        <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
          <Text style={styles.cardTitle}>📊 Quarterly Breakdown</Text>
          {data.quarterly.map((q: any, i: number) => (
            <View key={i} style={styles.quarterRow}>
              <Text style={[styles.quarterLabel, { color: theme.text }]}>{q.quarter}</Text>
              <View style={styles.quarterStats}>
                <Text style={styles.quarterStat}>{q.avg_calories} kcal</Text>
                <Text style={styles.quarterStat}>{q.avg_protein}g prot</Text>
                <Text style={styles.quarterStat}>{q.days_tracked}d</Text>
              </View>
            </View>
          ))}
          {data.stats && (
            <View style={styles.annualTotals}>
              <Text style={[styles.annualTotal, { color: theme.text }]}>Total: {data.stats.total_meals} meals · {data.stats.unique_foods} unique foods · {data.stats.total_days_tracked} days</Text>
            </View>
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Feedback Reports</Text>
        <Ionicons name="document-text" size={22} color="#00d4ff" />
      </View>

      {/* Period Tabs */}
      <View style={styles.tabRow}>
        {(['daily', 'weekly', 'monthly', 'annual'] as Period[]).map(p => (
          <TouchableOpacity key={p} style={[styles.tab, activePeriod === p && styles.tabActive]} onPress={() => switchPeriod(p)}>
            <Text style={styles.tabIcon}>{PERIOD_ICONS[p]}</Text>
            <Text style={[styles.tabText, activePeriod === p && styles.tabTextActive]}>{PERIOD_LABELS[p]}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#00d4ff" />
          <Text style={styles.loadingText}>Generating {PERIOD_LABELS[activePeriod]} report...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReport(activePeriod); }} tintColor="#00d4ff" />}>
          {renderStats()}
          {renderFeedback()}
          {data?.range && (
            <Text style={styles.rangeText}>{data.range.start} — {data.range.end}</Text>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatItem({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}<Text style={styles.statUnit}>{unit}</Text></Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  tabActive: { backgroundColor: 'rgba(0, 212, 255, 0.12)', borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.3)' },
  tabIcon: { fontSize: 18, marginBottom: 2 },
  tabText: { fontSize: 11, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#00d4ff' },

  // Jaide
  jaideCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.15)' },
  jaideAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.3)' },
  jaideContent: { flex: 1, marginLeft: 14 },
  jaideLabel: { fontSize: 10, fontWeight: '700', color: '#00d4ff', letterSpacing: 2, marginBottom: 4 },
  jaideObservation: { fontSize: 15, fontStyle: 'italic', lineHeight: 22 },

  // Cards
  feedbackSection: { gap: 12 },
  impactCard: { borderRadius: 16, padding: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 12 },
  impactText: { fontSize: 14, lineHeight: 20 },
  listCard: { borderRadius: 16, padding: 16 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  listText: { fontSize: 14, lineHeight: 20, flex: 1 },
  recommendCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.2)', backgroundColor: 'rgba(0, 212, 255, 0.05)' },
  recommendText: { fontSize: 14, lineHeight: 20, flex: 1, fontWeight: '500' },

  // Stats
  statsCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statItem: { width: '30%', alignItems: 'center', paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12 },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statUnit: { fontSize: 12, fontWeight: '400', color: '#888' },
  statLabel: { fontSize: 10, color: '#888', marginTop: 4 },

  // Evolution
  evolutionCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
  evolutionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)', gap: 8 },
  evolutionLabel: { flex: 1, fontSize: 14, fontWeight: '500', textTransform: 'capitalize' },
  evolutionOld: { fontSize: 13, color: '#888' },
  evolutionNew: { fontSize: 14, fontWeight: '700' },

  // Annual / Quarterly
  quarterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' },
  quarterLabel: { fontSize: 16, fontWeight: '700' },
  quarterStats: { flexDirection: 'row', gap: 12 },
  quarterStat: { fontSize: 12, color: '#aaa' },
  annualTotals: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  annualTotal: { fontSize: 13, textAlign: 'center' },

  // Empty
  emptyCard: { borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyText: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 8, lineHeight: 18 },
  emptyMeta: { fontSize: 12, color: '#00d4ff', marginTop: 12 },

  // Range
  rangeText: { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 16 },
});
