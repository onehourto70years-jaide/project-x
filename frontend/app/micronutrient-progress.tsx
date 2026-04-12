/**
 * Smart Micronutrient Chart — NutriOS
 * Radar chart + deep-dive cards + bioavailability insights + AI gap analysis + symptom correlation
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
  ActivityIndicator, RefreshControl, Alert, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/ThemeContext';
import { useLanguage } from '../src/LanguageContext';
import RadarChart from '../src/components/RadarChart';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface NutrientData {
  key: string; name: string; unit: string; group: string;
  daily_avg: number; rda: number; ul: number | null;
  pct_rda: number; pct_ul: number | null;
  status: string; color: string; key_role: string;
}

interface Insight {
  id: string; type: string; title: string; description: string;
  advice: string; severity: string; nutrients: Record<string, number>;
}

interface GapSuggestion {
  nutrient: string;
  foods: { name: string; amount: string; nutrient_content: string }[];
}

const SYMPTOM_OPTIONS = [
  { id: 'fatigue', label: 'Fatigue', icon: 'bed' },
  { id: 'cramps', label: 'Muscle Cramps', icon: 'fitness' },
  { id: 'hair_loss', label: 'Hair Loss', icon: 'cut' },
  { id: 'brain_fog', label: 'Brain Fog', icon: 'cloudy' },
  { id: 'insomnia', label: 'Insomnia', icon: 'moon' },
  { id: 'anxiety', label: 'Anxiety', icon: 'pulse' },
  { id: 'weak_immunity', label: 'Weak Immunity', icon: 'shield' },
  { id: 'dry_skin', label: 'Dry Skin', icon: 'water' },
  { id: 'bone_pain', label: 'Bone Pain', icon: 'body' },
  { id: 'bruising', label: 'Easy Bruising', icon: 'bandage' },
  { id: 'mouth_sores', label: 'Mouth Sores', icon: 'medical' },
  { id: 'weak_nails', label: 'Weak Nails', icon: 'hand-left' },
];

export default function MicronutrientProgressScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartData, setChartData] = useState<NutrientData[]>([]);
  const [densityScore, setDensityScore] = useState(0);
  const [daysTracked, setDaysTracked] = useState(0);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [gapData, setGapData] = useState<any>(null);
  const [gapLoading, setGapLoading] = useState(false);

  // Deep Dive Modal
  const [selectedNutrient, setSelectedNutrient] = useState<NutrientData | null>(null);

  // Symptom Correlation
  const [showSymptomModal, setShowSymptomModal] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomResults, setSymptomResults] = useState<any[]>([]);
  const [symptomLoading, setSymptomLoading] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<'chart' | 'insights' | 'gaps' | 'symptoms'>('chart');

  const getToken = async () => {
    const session = await AsyncStorage.getItem('session');
    return session ? JSON.parse(session).access_token : null;
  };

  const fetchData = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      const [microRes, bioRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/progress/micronutrients`, { headers }),
        fetch(`${BACKEND_URL}/api/progress/bioavailability`, { headers }),
      ]);

      if (microRes.ok) {
        const data = await microRes.json();
        setChartData(data.chart_data || []);
        setDensityScore(data.density_score || 0);
        setDaysTracked(data.days_tracked || 0);
      }
      if (bioRes.ok) {
        const data = await bioRes.json();
        setInsights(data.insights || []);
      }
    } catch (e) {
      console.error('Micronutrient fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchGapAnalysis = async () => {
    setGapLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/progress/gap-analysis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setGapData(await res.json());
    } catch (e) {
      console.error('Gap analysis error:', e);
    } finally {
      setGapLoading(false);
    }
  };

  const analyzeSymptoms = async () => {
    if (selectedSymptoms.length === 0) return;
    setSymptomLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/progress/symptom-correlation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symptoms: selectedSymptoms }),
      });
      if (res.ok) {
        const data = await res.json();
        setSymptomResults(data.correlations || []);
        setShowSymptomModal(false);
      }
    } catch (e) {
      console.error('Symptom correlation error:', e);
    } finally {
      setSymptomLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // Filter data for radar chart (top 12 nutrients for readability)
  const radarData = chartData.filter(d => d.daily_avg > 0).slice(0, 14);
  // If not enough tracked nutrients, show all
  const displayRadar = radarData.length >= 3 ? radarData : chartData.slice(0, 12);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'optimal': return { icon: 'checkmark-circle', color: '#34c759' };
      case 'adequate': return { icon: 'checkmark-circle-outline', color: '#30d158' };
      case 'low': return { icon: 'warning', color: '#ffd60a' };
      case 'deficient': return { icon: 'alert-circle', color: '#ff453a' };
      case 'excess': return { icon: 'alert', color: '#bf5af2' };
      default: return { icon: 'ellipse-outline', color: '#666' };
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return '#ff453a';
      case 'medium': return '#ffd60a';
      case 'low': return '#30d158';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>Analyzing micronutrients...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Micronutrient Chart</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Density Score Card */}
        <View style={[styles.scoreCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.scoreRow}>
            <View>
              <Text style={[styles.scoreLabel, { color: theme.textMuted }]}>Nutrient Density Score</Text>
              <Text style={[styles.scoreValue, { color: densityScore >= 70 ? '#34c759' : densityScore >= 40 ? '#ffd60a' : '#ff453a' }]}>{densityScore}</Text>
            </View>
            <View style={styles.scoreRight}>
              <Text style={[styles.scoreDays, { color: theme.textMuted }]}>{daysTracked}-day average</Text>
              <View style={[styles.scoreBadge, { backgroundColor: `${densityScore >= 70 ? '#34c759' : densityScore >= 40 ? '#ffd60a' : '#ff453a'}1e` }]}>
                <Text style={[styles.scoreBadgeText, { color: densityScore >= 70 ? '#34c759' : densityScore >= 40 ? '#ffd60a' : '#ff453a' }]}>
                  {densityScore >= 70 ? 'Excellent' : densityScore >= 40 ? 'Moderate' : 'Low'}
                </Text>
              </View>
            </View>
          </View>
          <View style={[styles.scoreBar, { backgroundColor: theme.bgSecondary }]}>
            <View style={[styles.scoreBarFill, { width: `${Math.min(densityScore, 100)}%`, backgroundColor: densityScore >= 70 ? '#34c759' : densityScore >= 40 ? '#ffd60a' : '#ff453a' }]} />
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {(['chart', 'insights', 'gaps', 'symptoms'] as const).map(tab => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && { borderBottomColor: theme.accent, borderBottomWidth: 2 }]}
              onPress={() => { setActiveTab(tab); if (tab === 'gaps' && !gapData) fetchGapAnalysis(); }}>
              <Ionicons name={tab === 'chart' ? 'analytics' : tab === 'insights' ? 'flask' : tab === 'gaps' ? 'nutrition' : 'medical'} size={16}
                color={activeTab === tab ? theme.accent : theme.textMuted} />
              <Text style={[styles.tabText, { color: activeTab === tab ? theme.accent : theme.textMuted }]}>
                {tab === 'chart' ? 'Chart' : tab === 'insights' ? 'Bio' : tab === 'gaps' ? 'Gaps' : 'Symptoms'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ═══ TAB: RADAR CHART ═══ */}
        {activeTab === 'chart' && (
          <View>
            {displayRadar.length >= 3 ? (
              <View style={[styles.chartCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <RadarChart
                  data={displayRadar}
                  theme={theme}
                  onPointPress={(point) => setSelectedNutrient(point)}
                />
              </View>
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <Ionicons name="analytics-outline" size={48} color={theme.textDim} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>Not enough data yet</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Log meals with detailed nutrients for at least 1 day to see your micronutrient radar chart.
                </Text>
              </View>
            )}

            {/* Nutrient List */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>All Micronutrients</Text>
            {chartData.map(n => {
              const si = getStatusIcon(n.status);
              return (
                <TouchableOpacity key={n.key} style={[styles.nutrientRow, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
                  onPress={() => setSelectedNutrient(n)}>
                  <View style={[styles.nutrientIcon, { backgroundColor: `${n.color}1e` }]}>
                    <Ionicons name={si.icon as any} size={18} color={n.color} />
                  </View>
                  <View style={styles.nutrientInfo}>
                    <Text style={[styles.nutrientName, { color: theme.text }]}>{n.name}</Text>
                    <Text style={[styles.nutrientDetail, { color: theme.textMuted }]}>
                      {n.daily_avg}{n.unit} / {n.rda}{n.unit} RDA
                    </Text>
                  </View>
                  <View style={styles.nutrientRight}>
                    <Text style={[styles.nutrientPct, { color: n.color }]}>{n.pct_rda}%</Text>
                    <View style={[styles.miniBar, { backgroundColor: theme.bgSecondary }]}>
                      <View style={[styles.miniBarFill, { width: `${Math.min(n.pct_rda, 100)}%`, backgroundColor: n.color }]} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ═══ TAB: BIOAVAILABILITY INSIGHTS ═══ */}
        {activeTab === 'insights' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Nutrient Interactions</Text>
            {insights.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <Ionicons name="flask-outline" size={48} color={theme.textDim} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No interactions detected</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Track more nutrients to discover bioavailability insights.
                </Text>
              </View>
            ) : (
              insights.map((insight, i) => (
                <View key={insight.id} style={[styles.insightCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                  <View style={styles.insightHeader}>
                    <View style={[styles.insightBadge, { backgroundColor: `${getSeverityColor(insight.severity)}1e` }]}>
                      <Ionicons name={insight.type === 'synergy' ? 'link' : insight.type === 'inhibition' ? 'close-circle' : 'swap-horizontal'} size={16}
                        color={getSeverityColor(insight.severity)} />
                      <Text style={[styles.insightType, { color: getSeverityColor(insight.severity) }]}>
                        {insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}
                      </Text>
                    </View>
                    <View style={[styles.severityDot, { backgroundColor: getSeverityColor(insight.severity) }]} />
                  </View>
                  <Text style={[styles.insightTitle, { color: theme.text }]}>{insight.title}</Text>
                  <Text style={[styles.insightDesc, { color: theme.textMuted }]}>{insight.description}</Text>
                  <View style={[styles.adviceBox, { backgroundColor: `${theme.accent}0d` }]}>
                    <Ionicons name="bulb" size={16} color={theme.accent} />
                    <Text style={[styles.adviceText, { color: theme.text }]}>{insight.advice}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* ═══ TAB: GAP ANALYSIS ═══ */}
        {activeTab === 'gaps' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Top Nutrient Gaps</Text>
            {gapLoading ? (
              <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.accent} /></View>
            ) : gapData ? (
              <>
                {/* ── Progress Summary Banner ── */}
                {gapData.progress_summary && (
                  <View style={[styles.progressBanner, {
                    backgroundColor: gapData.progress_summary.overall_trend === 'improving' ? '#34c75912' : gapData.progress_summary.overall_trend === 'declining' ? '#ff453a12' : `${theme.accent}10`,
                    borderColor: gapData.progress_summary.overall_trend === 'improving' ? '#34c75930' : gapData.progress_summary.overall_trend === 'declining' ? '#ff453a30' : `${theme.accent}25`,
                  }]}>
                    <View style={styles.progressBannerRow}>
                      <Ionicons
                        name={gapData.progress_summary.overall_trend === 'improving' ? 'trending-up' : gapData.progress_summary.overall_trend === 'declining' ? 'trending-down' : 'remove'}
                        size={22}
                        color={gapData.progress_summary.overall_trend === 'improving' ? '#34c759' : gapData.progress_summary.overall_trend === 'declining' ? '#ff453a' : theme.accent}
                      />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.progressBannerTitle, { color: theme.text }]}>
                          {gapData.progress_summary.overall_trend === 'improving' ? 'Nutrition Improving' : gapData.progress_summary.overall_trend === 'declining' ? 'Gaps Increasing' : 'Nutrition Stable'}
                        </Text>
                        <Text style={[styles.progressBannerSub, { color: theme.textMuted }]}>
                          {gapData.progress_summary.current_deficiencies} gaps now vs {gapData.progress_summary.previous_deficiencies} last week · {gapData.progress_summary.days_tracked_this_week} days tracked
                        </Text>
                      </View>
                    </View>
                    {(gapData.progress_summary.trend_improving > 0 || gapData.progress_summary.trend_declining > 0) && (
                      <View style={styles.trendPills}>
                        {gapData.progress_summary.trend_improving > 0 && (
                          <View style={[styles.trendPill, { backgroundColor: '#34c75918' }]}>
                            <Ionicons name="arrow-up" size={12} color="#34c759" />
                            <Text style={{ color: '#34c759', fontSize: 11, fontWeight: '600', marginLeft: 3 }}>{gapData.progress_summary.trend_improving} improving</Text>
                          </View>
                        )}
                        {gapData.progress_summary.trend_declining > 0 && (
                          <View style={[styles.trendPill, { backgroundColor: '#ff453a18' }]}>
                            <Ionicons name="arrow-down" size={12} color="#ff453a" />
                            <Text style={{ color: '#ff453a', fontSize: 11, fontWeight: '600', marginLeft: 3 }}>{gapData.progress_summary.trend_declining} declining</Text>
                          </View>
                        )}
                        {gapData.progress_summary.trend_stable > 0 && (
                          <View style={[styles.trendPill, { backgroundColor: `${theme.accent}15` }]}>
                            <Ionicons name="remove" size={12} color={theme.accent} />
                            <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '600', marginLeft: 3 }}>{gapData.progress_summary.trend_stable} stable</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

                {gapData.top_gaps?.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                    <Ionicons name="checkmark-done-circle" size={48} color="#34c759" />
                    <Text style={[styles.emptyTitle, { color: theme.text }]}>Great job!</Text>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No significant nutrient gaps detected.</Text>
                  </View>
                ) : (
                  gapData.top_gaps?.map((gap: any, i: number) => (
                    <View key={gap.key} style={[styles.gapCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                      <View style={styles.gapHeader}>
                        <View style={[styles.gapRank, { backgroundColor: i === 0 ? '#ff453a1e' : i === 1 ? '#ffd60a1e' : '#bf5af21e' }]}>
                          <Text style={[styles.gapRankText, { color: i === 0 ? '#ff453a' : i === 1 ? '#ffd60a' : '#bf5af2' }]}>#{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.gapName, { color: theme.text }]}>{gap.name}</Text>
                          <Text style={[styles.gapDetail, { color: theme.textMuted }]}>{gap.pct_rda}% of RDA · Missing {gap.deficit}{gap.unit}/day</Text>
                        </View>
                        {/* Trend badge */}
                        {gap.trend && (
                          <View style={[styles.trendBadge, {
                            backgroundColor: gap.trend === 'improving' ? '#34c75918' : gap.trend === 'declining' ? '#ff453a18' : `${theme.accent}12`
                          }]}>
                            <Ionicons
                              name={gap.trend === 'improving' ? 'trending-up' : gap.trend === 'declining' ? 'trending-down' : 'remove'}
                              size={14}
                              color={gap.trend === 'improving' ? '#34c759' : gap.trend === 'declining' ? '#ff453a' : theme.accent}
                            />
                            <Text style={{
                              fontSize: 10, fontWeight: '700', marginLeft: 3,
                              color: gap.trend === 'improving' ? '#34c759' : gap.trend === 'declining' ? '#ff453a' : theme.accent,
                            }}>
                              {gap.delta_pct > 0 ? '+' : ''}{gap.delta_pct}%
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.gapRole, { color: theme.textMuted }]}>{gap.key_role}</Text>
                      <View style={[styles.gapBar, { backgroundColor: theme.bgSecondary }]}>
                        <View style={[styles.gapBarFill, { width: `${Math.min(gap.pct_rda, 100)}%`, backgroundColor: gap.pct_rda < 30 ? '#ff453a' : '#ffd60a' }]} />
                        {/* Show previous week ghost bar */}
                        {gap.prev_pct_rda > 0 && (
                          <View style={[styles.gapBarGhost, { left: `${Math.min(gap.prev_pct_rda, 100)}%` }]} />
                        )}
                      </View>
                    </View>
                  ))
                )}

                {/* AI Food Suggestions */}
                {gapData.ai_suggestions?.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>AI Food Suggestions</Text>
                    {gapData.ai_suggestions.map((suggestion: GapSuggestion, i: number) => (
                      <View key={i} style={[styles.suggestionCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                        <View style={styles.suggestionHeader}>
                          <Ionicons name="sparkles" size={16} color={theme.accent} />
                          <Text style={[styles.suggestionNutrient, { color: theme.accent }]}>{suggestion.nutrient}</Text>
                        </View>
                        {suggestion.foods?.map((food, j) => (
                          <View key={j} style={[styles.foodRow, { borderTopColor: theme.borderLight }]}>
                            <View style={[styles.foodDot, { backgroundColor: theme.accent }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.foodName, { color: theme.text }]}>{food.name}</Text>
                              <Text style={[styles.foodAmount, { color: theme.textMuted }]}>{food.amount} — {food.nutrient_content}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ))}
                  </>
                )}
              </>
            ) : (
              <TouchableOpacity style={[styles.fetchBtn, { backgroundColor: theme.accent }]} onPress={fetchGapAnalysis}>
                <Ionicons name="sparkles" size={18} color="#fff" />
                <Text style={styles.fetchBtnText}>Run AI Gap Analysis</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ═══ TAB: SYMPTOM CORRELATION ═══ */}
        {activeTab === 'symptoms' && (
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Symptom-Nutrient Correlation</Text>
            <Text style={[styles.sectionDesc, { color: theme.textMuted }]}>
              Select symptoms you're experiencing to cross-reference with your nutrient intake data.
            </Text>

            <TouchableOpacity style={[styles.fetchBtn, { backgroundColor: theme.accent }]}
              onPress={() => setShowSymptomModal(true)}>
              <Ionicons name="medical" size={18} color="#fff" />
              <Text style={styles.fetchBtnText}>
                {selectedSymptoms.length > 0 ? `${selectedSymptoms.length} symptoms selected` : 'Select Symptoms'}
              </Text>
            </TouchableOpacity>

            {symptomResults.length > 0 && (
              symptomResults.map((corr, i) => (
                <View key={i} style={[styles.correlationCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                  <View style={styles.corrHeader}>
                    <View style={[styles.corrBadge, { backgroundColor: corr.correlation_strength === 'strong' ? '#ff453a1e' : corr.correlation_strength === 'moderate' ? '#ffd60a1e' : '#30d1581e' }]}>
                      <Ionicons name="pulse" size={16} color={corr.correlation_strength === 'strong' ? '#ff453a' : corr.correlation_strength === 'moderate' ? '#ffd60a' : '#30d158'} />
                      <Text style={{ color: corr.correlation_strength === 'strong' ? '#ff453a' : corr.correlation_strength === 'moderate' ? '#ffd60a' : '#30d158', fontSize: 12, fontWeight: '600' }}>
                        {corr.correlation_strength}
                      </Text>
                    </View>
                    <Text style={[styles.corrSymptom, { color: theme.text }]}>{corr.symptom}</Text>
                  </View>
                  <Text style={[styles.corrNote, { color: theme.textMuted }]}>{corr.note}</Text>
                  {corr.deficient_nutrients?.length > 0 && (
                    <View style={[styles.corrNutrients, { backgroundColor: theme.bgSecondary }]}>
                      <Text style={[styles.corrNutrientsTitle, { color: theme.text }]}>Linked Deficiencies:</Text>
                      {corr.deficient_nutrients.map((n: any, j: number) => (
                        <View key={j} style={styles.corrNutRow}>
                          <Ionicons name="alert-circle" size={14} color="#ff453a" />
                          <Text style={[styles.corrNutText, { color: theme.text }]}>
                            {n.name}: {n.pct_rda}% RDA ({n.daily_avg}{' '}{n.rda && `/ ${n.rda}`})
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═══ DEEP DIVE MODAL ═══ */}
      <Modal visible={!!selectedNutrient} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.bgCard }]}>
            {selectedNutrient && (
              <>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalIcon, { backgroundColor: `${selectedNutrient.color}1e` }]}>
                    <Ionicons name={getStatusIcon(selectedNutrient.status).icon as any} size={24} color={selectedNutrient.color} />
                  </View>
                  <TouchableOpacity onPress={() => setSelectedNutrient(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={24} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedNutrient.name}</Text>
                <Text style={[styles.modalRole, { color: theme.textMuted }]}>{selectedNutrient.key_role}</Text>

                <View style={[styles.modalStats, { backgroundColor: theme.bgSecondary }]}>
                  <View style={styles.modalStat}>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>Daily Avg</Text>
                    <Text style={[styles.statValue, { color: theme.text }]}>{selectedNutrient.daily_avg} {selectedNutrient.unit}</Text>
                  </View>
                  <View style={[styles.modalStatDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.modalStat}>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>RDA Target</Text>
                    <Text style={[styles.statValue, { color: theme.text }]}>{selectedNutrient.rda} {selectedNutrient.unit}</Text>
                  </View>
                  <View style={[styles.modalStatDivider, { backgroundColor: theme.border }]} />
                  <View style={styles.modalStat}>
                    <Text style={[styles.statLabel, { color: theme.textMuted }]}>% RDA</Text>
                    <Text style={[styles.statValue, { color: selectedNutrient.color }]}>{selectedNutrient.pct_rda}%</Text>
                  </View>
                </View>

                {selectedNutrient.ul && (
                  <View style={[styles.ulWarning, { backgroundColor: selectedNutrient.pct_ul && selectedNutrient.pct_ul > 80 ? '#bf5af21e' : `${theme.text}08` }]}>
                    <Ionicons name="shield" size={16} color={selectedNutrient.pct_ul && selectedNutrient.pct_ul > 80 ? '#bf5af2' : theme.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ulLabel, { color: theme.textMuted }]}>Upper Limit (UL)</Text>
                      <Text style={[styles.ulValue, { color: theme.text }]}>{selectedNutrient.ul} {selectedNutrient.unit} ({selectedNutrient.pct_ul}%)</Text>
                    </View>
                  </View>
                )}

                {/* Full progress bar */}
                <View style={styles.modalBarContainer}>
                  <View style={[styles.modalBar, { backgroundColor: theme.bgSecondary }]}>
                    <View style={[styles.modalBarFill, { width: `${Math.min(selectedNutrient.pct_rda, 100)}%`, backgroundColor: selectedNutrient.color }]} />
                  </View>
                  <View style={styles.modalBarLabels}>
                    <Text style={[styles.barLabel, { color: theme.textDim }]}>0%</Text>
                    <Text style={[styles.barLabel, { color: '#34c759' }]}>100% RDA</Text>
                    {selectedNutrient.ul && <Text style={[styles.barLabel, { color: '#bf5af2' }]}>UL</Text>}
                  </View>
                </View>

                <View style={[styles.statusBadgeLarge, { backgroundColor: `${selectedNutrient.color}1e` }]}>
                  <Text style={[styles.statusText, { color: selectedNutrient.color }]}>
                    {selectedNutrient.status === 'optimal' ? '✅ Optimal range' :
                     selectedNutrient.status === 'adequate' ? '👍 Adequate' :
                     selectedNutrient.status === 'low' ? '⚠️ Below recommended' :
                     selectedNutrient.status === 'deficient' ? '🔴 Significantly deficient' :
                     '🟣 Exceeds safe upper limit'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ═══ SYMPTOM SELECTION MODAL ═══ */}
      <Modal visible={showSymptomModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.symptomModal, { backgroundColor: theme.bgCard }]}>
            <View style={styles.symptomModalHeader}>
              <Text style={[styles.symptomModalTitle, { color: theme.text }]}>Select Symptoms</Text>
              <TouchableOpacity onPress={() => setShowSymptomModal(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {SYMPTOM_OPTIONS.map(symptom => {
                const isSelected = selectedSymptoms.includes(symptom.id);
                return (
                  <TouchableOpacity key={symptom.id}
                    style={[styles.symptomOption, { backgroundColor: isSelected ? `${theme.accent}14` : theme.bgSecondary, borderColor: isSelected ? theme.accent : theme.border }]}
                    onPress={() => {
                      setSelectedSymptoms(prev =>
                        isSelected ? prev.filter(s => s !== symptom.id) : [...prev, symptom.id]
                      );
                    }}>
                    <Ionicons name={symptom.icon as any} size={20} color={isSelected ? theme.accent : theme.textMuted} />
                    <Text style={[styles.symptomLabel, { color: isSelected ? theme.accent : theme.text }]}>{symptom.label}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.analyzeBtn, { backgroundColor: selectedSymptoms.length > 0 ? theme.accent : theme.borderLight }]}
              disabled={selectedSymptoms.length === 0 || symptomLoading}
              onPress={analyzeSymptoms}>
              {symptomLoading ? <ActivityIndicator color="#fff" /> :
                <>
                  <Ionicons name="search" size={18} color="#fff" />
                  <Text style={styles.analyzeBtnText}>Analyze Correlation</Text>
                </>
              }
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  refreshBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  // Score Card
  scoreCard: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  scoreLabel: { fontSize: 12, fontWeight: '500', marginBottom: 4 },
  scoreValue: { fontSize: 42, fontWeight: '800' },
  scoreRight: { alignItems: 'flex-end', gap: 6 },
  scoreDays: { fontSize: 12 },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  scoreBadgeText: { fontSize: 12, fontWeight: '700' },
  scoreBar: { height: 6, borderRadius: 3, marginTop: 12 },
  scoreBarFill: { height: 6, borderRadius: 3 },
  // Tabs
  tabs: { flexDirection: 'row', borderRadius: 12, marginBottom: 16, borderWidth: 1, overflow: 'hidden' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 4 },
  tabText: { fontSize: 12, fontWeight: '600' },
  // Chart Card
  chartCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  // Empty
  emptyCard: { borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 16, borderWidth: 1 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  // Nutrient List
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 8 },
  sectionDesc: { fontSize: 13, marginBottom: 12, lineHeight: 20 },
  nutrientRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1 },
  nutrientIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  nutrientInfo: { flex: 1 },
  nutrientName: { fontSize: 14, fontWeight: '600' },
  nutrientDetail: { fontSize: 11, marginTop: 2 },
  nutrientRight: { alignItems: 'flex-end', width: 60 },
  nutrientPct: { fontSize: 14, fontWeight: '700' },
  miniBar: { height: 3, borderRadius: 2, width: 50, marginTop: 4 },
  miniBarFill: { height: 3, borderRadius: 2 },
  // Insight Card
  insightCard: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  insightHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  insightBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  insightType: { fontSize: 12, fontWeight: '600' },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  insightTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  insightDesc: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  adviceBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10 },
  adviceText: { fontSize: 13, flex: 1, lineHeight: 20 },
  // Gap Card
  gapCard: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  gapHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  gapRank: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  gapRankText: { fontSize: 14, fontWeight: '800' },
  gapName: { fontSize: 15, fontWeight: '700' },
  gapDetail: { fontSize: 12, marginTop: 2 },
  gapRole: { fontSize: 12, marginBottom: 8, fontStyle: 'italic' },
  gapBar: { height: 6, borderRadius: 3, position: 'relative' as const },
  gapBarFill: { height: 6, borderRadius: 3 },
  gapBarGhost: { position: 'absolute' as const, top: -2, width: 2, height: 10, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1 },
  progressBanner: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  progressBannerRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  progressBannerTitle: { fontSize: 15, fontWeight: '700' as const, marginBottom: 2 },
  progressBannerSub: { fontSize: 12 },
  trendPills: { flexDirection: 'row' as const, marginTop: 10, gap: 8, flexWrap: 'wrap' as const },
  trendPill: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  trendBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  // AI Suggestions
  suggestionCard: { borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1 },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  suggestionNutrient: { fontSize: 14, fontWeight: '700' },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: 1 },
  foodDot: { width: 6, height: 6, borderRadius: 3 },
  foodName: { fontSize: 13, fontWeight: '600' },
  foodAmount: { fontSize: 11, marginTop: 2 },
  // Buttons
  fetchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, marginBottom: 16 },
  fetchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  // Correlation Card
  correlationCard: { borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1 },
  corrHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  corrBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  corrSymptom: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  corrNote: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  corrNutrients: { borderRadius: 10, padding: 12, marginTop: 4 },
  corrNutrientsTitle: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  corrNutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  corrNutText: { fontSize: 12 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalClose: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  modalRole: { fontSize: 13, marginBottom: 16, lineHeight: 20 },
  modalStats: { flexDirection: 'row', borderRadius: 12, padding: 14, marginBottom: 16 },
  modalStat: { flex: 1, alignItems: 'center' },
  modalStatDivider: { width: 1, marginHorizontal: 8 },
  statLabel: { fontSize: 11, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700' },
  ulWarning: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, marginBottom: 16 },
  ulLabel: { fontSize: 11 },
  ulValue: { fontSize: 14, fontWeight: '600' },
  modalBarContainer: { marginBottom: 16 },
  modalBar: { height: 8, borderRadius: 4 },
  modalBarFill: { height: 8, borderRadius: 4 },
  modalBarLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  barLabel: { fontSize: 10 },
  statusBadgeLarge: { padding: 12, borderRadius: 10, alignItems: 'center' },
  statusText: { fontSize: 14, fontWeight: '600' },
  // Symptom Modal
  symptomModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  symptomModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  symptomModalTitle: { fontSize: 18, fontWeight: '700' },
  symptomOption: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1 },
  symptomLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  analyzeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, marginTop: 12 },
  analyzeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
