import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const SEVERITY_COLORS: Record<string, string> = {
  high: '#ff6b6b', medium: '#ffd93d', low: '#00d4ff', positive: '#00ff88',
};

const SEVERITY_LABELS: Record<string, string> = {
  high: 'CRITICAL', medium: 'ATTENTION', low: 'NOTE', positive: 'POSITIVE',
};

export default function AdaptiveInsightsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [patterns, setPatterns] = useState<any>(null);
  const [behavioral, setBehavioral] = useState<any>(null);
  const [foodResponse, setFoodResponse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'patterns' | 'behavioral' | 'foods'>('patterns');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const headers = { 'Authorization': `Bearer ${token}` };

      const [pRes, bRes, fRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/adaptive/patterns`, { headers }),
        fetch(`${BACKEND_URL}/api/adaptive/behavioral-insights`, { headers }),
        fetch(`${BACKEND_URL}/api/adaptive/food-response`, { headers }),
      ]);

      if (pRes.ok) setPatterns(await pRes.json());
      if (bRes.ok) setBehavioral(await bRes.json());
      if (fRes.ok) setFoodResponse(await fRes.json());
    } catch (err) {
      console.error('Adaptive fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const renderInsightCard = (insight: any, idx: number) => {
    const color = SEVERITY_COLORS[insight.severity] || theme.accent;
    return (
      <View key={idx} style={[styles.insightCard, { backgroundColor: theme.bgCard, borderLeftColor: color }]}>
        <View style={styles.insightHeader}>
          <Text style={styles.insightIcon}>{insight.icon}</Text>
          <View style={[styles.severityBadge, { backgroundColor: color + '18' }]}>
            <Text style={[styles.severityText, { color }]}>{SEVERITY_LABELS[insight.severity] || 'INFO'}</Text>
          </View>
        </View>
        <Text style={[styles.insightMessage, { color: theme.text }]}>{insight.message}</Text>
        <View style={[styles.recommendationRow, { backgroundColor: theme.bgInput }]}>
          <Ionicons name="bulb" size={14} color={theme.warning} />
          <Text style={[styles.recommendationText, { color: theme.textSecondary }]}>{insight.recommendation}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>Analyzing your patterns...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Adaptive Learning</Text>
        <Ionicons name="analytics" size={22} color={theme.accent} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {[
          { id: 'patterns' as const, label: 'Patterns', icon: 'pulse' },
          { id: 'behavioral' as const, label: 'Behavioral', icon: 'brain' },
          { id: 'foods' as const, label: 'Food Response', icon: 'nutrition' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, { backgroundColor: theme.bgInput }, activeTab === tab.id && { backgroundColor: theme.accentGlow, borderWidth: 1, borderColor: theme.accent + '4D' }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.id ? theme.accent : theme.textDim} />
            <Text style={[styles.tabText, { color: activeTab === tab.id ? theme.accent : theme.textDim }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll(); }} tintColor={theme.accent} />}>

        {/* ══ PATTERNS TAB ══ */}
        {activeTab === 'patterns' && patterns && (
          <>
            {/* Timing Overview */}
            <View style={[styles.overviewCard, { backgroundColor: theme.bgCard }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>⏰ Timing Patterns</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{patterns.timing_patterns?.meals_per_day || '-'}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>meals/day</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{patterns.timing_patterns?.breakfast_skip_rate || 0}%</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>breakfast skipped</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{patterns.timing_patterns?.late_eating_rate || 0}%</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>late eating</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: theme.text }]}>{patterns.timing_patterns?.total_days_tracked || 0}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>days tracked</Text>
                </View>
              </View>
            </View>

            {/* Food Variety */}
            <View style={[styles.overviewCard, { backgroundColor: theme.bgCard }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>🌈 Food Variety</Text>
              <View style={styles.varietyRow}>
                <View style={[styles.varietyRing, { borderColor: (patterns.food_frequency?.variety_score || 0) > 50 ? theme.success : theme.warning }]}>
                  <Text style={[styles.varietyScore, { color: theme.text }]}>{patterns.food_frequency?.variety_score || 0}</Text>
                </View>
                <View style={styles.varietyInfo}>
                  <Text style={[styles.varietyLabel, { color: theme.text }]}>{patterns.food_frequency?.unique_foods || 0} unique foods</Text>
                  <Text style={[styles.varietySub, { color: theme.textMuted }]}>Higher variety = broader nutrient coverage</Text>
                </View>
              </View>

              {/* Top Foods */}
              {patterns.food_frequency?.top_foods?.slice(0, 5).map((f: any, i: number) => (
                <View key={i} style={[styles.topFoodRow, { borderTopColor: theme.border }]}>
                  <Text style={[styles.topFoodRank, { color: theme.textDim }]}>#{i + 1}</Text>
                  <Text style={[styles.topFoodName, { color: theme.text }]}>{f.name}</Text>
                  <Text style={[styles.topFoodFreq, { color: theme.accent }]}>{f.frequency}</Text>
                </View>
              ))}
            </View>

            {/* Nutrient Trends */}
            {patterns.nutrient_trends?.trends?.length > 0 && (
              <View style={[styles.overviewCard, { backgroundColor: theme.bgCard }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>📈 Nutrient Trends (30d)</Text>
                {patterns.nutrient_trends.trends.map((t: any, i: number) => (
                  <View key={i} style={[styles.trendRow, { borderTopColor: theme.border }]}>
                    <Text style={[styles.trendName, { color: theme.text }]}>{t.nutrient}</Text>
                    <View style={styles.trendValues}>
                      <Text style={[styles.trendOld, { color: theme.textMuted }]}>{t.old_avg}</Text>
                      <Ionicons
                        name={t.direction === 'improving' ? 'trending-up' : t.direction === 'declining' ? 'trending-down' : 'remove'}
                        size={16}
                        color={t.direction === 'improving' ? theme.success : t.direction === 'declining' ? theme.danger : theme.textDim}
                      />
                      <Text style={[styles.trendNew, { color: t.direction === 'improving' ? theme.success : t.direction === 'declining' ? theme.danger : theme.textSecondary }]}>{t.new_avg}</Text>
                      <Text style={[styles.trendPct, { color: t.direction === 'improving' ? theme.success : t.direction === 'declining' ? theme.danger : theme.textDim }]}>
                        {t.change_pct > 0 ? '+' : ''}{t.change_pct}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Combined Insights */}
            {patterns.combined_insights?.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>💡 Pattern Insights</Text>
                {patterns.combined_insights.map((ins: any, i: number) => renderInsightCard(ins, i))}
              </>
            )}
          </>
        )}

        {/* ══ BEHAVIORAL TAB ══ */}
        {activeTab === 'behavioral' && (
          <>
            <View style={[styles.jaideNote, { backgroundColor: theme.bgCard }]}>
              <Image source={require('../assets/jaide/jaide-cartoon.png')} style={styles.jaideAvatar} />
              <View style={styles.jaideContent}>
                <Text style={[styles.jaideLabel, { color: theme.accent }]}>JAIDE BEHAVIORAL ANALYSIS</Text>
                <Text style={[styles.jaideText, { color: theme.textSecondary }]}>
                  "I observe your patterns. Not to judge — but to reveal what hides beneath habit."
                </Text>
              </View>
            </View>

            {behavioral?.insights?.length > 0 ? (
              behavioral.insights.map((ins: any, i: number) => renderInsightCard(ins, i))
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: theme.bgCard }]}>
                <Ionicons name="analytics" size={40} color={theme.textDim} />
                <Text style={[styles.emptyTitle, { color: theme.textMuted }]}>Insufficient Data</Text>
                <Text style={[styles.emptyText, { color: theme.textDim }]}>Log meals for 5-7 days to unlock behavioral insights. The more data, the deeper the patterns.</Text>
              </View>
            )}

            {behavioral?.data_points > 0 && (
              <Text style={[styles.footerNote, { color: theme.textDim }]}>Based on {behavioral.data_points} meals over {behavioral.analysis_period_days || 30} days</Text>
            )}
          </>
        )}

        {/* ══ FOOD RESPONSE TAB ══ */}
        {activeTab === 'foods' && (
          <>
            {foodResponse?.jaide_note && (
              <View style={[styles.jaideNote, { backgroundColor: theme.bgCard }]}>
                <Image source={require('../assets/jaide/jaide-cartoon.png')} style={styles.jaideAvatar} />
                <View style={styles.jaideContent}>
                  <Text style={[styles.jaideLabel, { color: theme.accent }]}>JAIDE ON YOUR FOOD</Text>
                  <Text style={[styles.jaideText, { color: theme.textSecondary }]}>"{foodResponse.jaide_note}"</Text>
                </View>
              </View>
            )}

            {/* Works for You */}
            {foodResponse?.works_for_you?.length > 0 && (
              <View style={[styles.overviewCard, { backgroundColor: theme.bgCard }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>✅ Works for Your Goal ({foodResponse.goal?.replace(/_/g, ' ')})</Text>
                {foodResponse.works_for_you.map((f: any, i: number) => (
                  <View key={i} style={[styles.foodRow, { borderTopColor: theme.border }]}>
                    <View style={[styles.foodScoreBadge, { backgroundColor: 'rgba(0, 255, 136, 0.12)' }]}>
                      <Text style={[styles.foodScoreText, { color: theme.success }]}>{f.goal_score}</Text>
                    </View>
                    <View style={styles.foodInfo}>
                      <Text style={[styles.foodName, { color: theme.text }]}>{f.name}</Text>
                      <Text style={[styles.foodMeta, { color: theme.textMuted }]}>Eaten {f.times_eaten}x</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                  </View>
                ))}
              </View>
            )}

            {/* Less Optimal */}
            {foodResponse?.less_optimal?.length > 0 && (
              <View style={[styles.overviewCard, { backgroundColor: theme.bgCard }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>⚠️ Less Optimal for Your Goal</Text>
                {foodResponse.less_optimal.map((f: any, i: number) => (
                  <View key={i} style={[styles.foodRow, { borderTopColor: theme.border }]}>
                    <View style={[styles.foodScoreBadge, { backgroundColor: 'rgba(255, 107, 107, 0.12)' }]}>
                      <Text style={[styles.foodScoreText, { color: theme.danger }]}>{f.goal_score}</Text>
                    </View>
                    <View style={styles.foodInfo}>
                      <Text style={[styles.foodName, { color: theme.text }]}>{f.name}</Text>
                      <Text style={[styles.foodMeta, { color: theme.textMuted }]}>Eaten {f.times_eaten}x</Text>
                    </View>
                    <Ionicons name="close-circle" size={18} color={theme.danger} />
                  </View>
                ))}
              </View>
            )}

            {!foodResponse?.works_for_you?.length && !foodResponse?.less_optimal?.length && (
              <View style={[styles.emptyCard, { backgroundColor: theme.bgCard }]}>
                <Ionicons name="nutrition" size={40} color={theme.textDim} />
                <Text style={[styles.emptyTitle, { color: theme.textMuted }]}>Need More Data</Text>
                <Text style={[styles.emptyText, { color: theme.textDim }]}>{foodResponse?.message || 'Log 10+ meals to unlock personalized food analysis'}</Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16 },

  // Tabs
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  tabText: { fontSize: 12, fontWeight: '600' },

  // Cards
  overviewCard: { borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 8, marginBottom: 12 },

  // Stats
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },

  // Variety
  varietyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  varietyRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  varietyScore: { fontSize: 20, fontWeight: 'bold' },
  varietyInfo: { marginLeft: 14, flex: 1 },
  varietyLabel: { fontSize: 15, fontWeight: '600' },
  varietySub: { fontSize: 11, marginTop: 2 },

  // Top foods
  topFoodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1 },
  topFoodRank: { fontSize: 12, width: 28 },
  topFoodName: { flex: 1, fontSize: 14, fontWeight: '500' },
  topFoodFreq: { fontSize: 12 },

  // Trends
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1 },
  trendName: { fontSize: 13, fontWeight: '500', flex: 1 },
  trendValues: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trendOld: { fontSize: 12 },
  trendNew: { fontSize: 13, fontWeight: '600' },
  trendPct: { fontSize: 11, fontWeight: '600', width: 45, textAlign: 'right' },

  // Insight cards
  insightCard: { borderRadius: 14, padding: 16, marginBottom: 10, borderLeftWidth: 4 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  insightIcon: { fontSize: 22 },
  severityBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  severityText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  insightMessage: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: 8 },
  recommendationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, padding: 10 },
  recommendationText: { fontSize: 12, flex: 1, lineHeight: 16 },

  // Jaide note
  jaideNote: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.15)' },
  jaideAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.3)' },
  jaideContent: { flex: 1, marginLeft: 12 },
  jaideLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  jaideText: { fontSize: 13, fontStyle: 'italic', lineHeight: 18 },

  // Food response
  foodRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1 },
  foodScoreBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  foodScoreText: { fontSize: 14, fontWeight: 'bold' },
  foodInfo: { flex: 1, marginLeft: 12 },
  foodName: { fontSize: 14, fontWeight: '600' },
  foodMeta: { fontSize: 11, marginTop: 2 },

  // Empty
  emptyCard: { borderRadius: 16, padding: 32, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  // Footer
  footerNote: { fontSize: 11, textAlign: 'center', marginTop: 16 },
});
