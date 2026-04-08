import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../src/LanguageContext';
import { SkeletonAIInsights } from '../../src/components/Skeleton';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Recommendation {
  food: string;
  key_nutrients: string[];
  key_elements: string[];
  health_benefit: string;
  best_cooking: string;
  synergistic_foods: string[];
}

interface Insight {
  category: string;
  title: string;
  message: string;
  priority: string;
  action_type?: string;
}

interface PredictiveRec {
  type: string;
  title: string;
  description: string;
  optimal_time?: string;
  expected_benefit?: string;
}

const GOALS = [
  { id: 'muscle_gain', label: 'Muscle Gain', icon: 'barbell', color: '#ff6b6b' },
  { id: 'immune_system', label: 'Immune Boost', icon: 'shield-checkmark', color: '#4ecdc4' },
  { id: 'brain_health', label: 'Brain Health', icon: 'bulb', color: '#ffd93d' },
  { id: 'gut_microbiome', label: 'Gut Health', icon: 'leaf', color: '#00d4ff' },
  { id: 'energy', label: 'Energy Boost', icon: 'flash', color: '#a29bfe' },
  { id: 'weight_loss', label: 'Weight Loss', icon: 'fitness', color: '#fd79a8' },
];

export default function AIScreen() {
  const { t } = useLanguage();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [predictive, setPredictive] = useState<PredictiveRec[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingPredictive, setLoadingPredictive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [aiModel, setAiModel] = useState('');

  const fetchInsights = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/ai/insights`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    }
  };

  useFocusEffect(useCallback(() => { fetchInsights(); }, []));

  const generateInsights = async () => {
    setLoadingInsights(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/ai/generate-insights`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setInsights(data.insights || []);
      }
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const fetchPredictive = async () => {
    setLoadingPredictive(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/ai/predictive-recommendations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPredictive(data.recommendations || []);
      }
    } catch (error) {
      console.error('Error fetching predictive:', error);
    } finally {
      setLoadingPredictive(false);
    }
  };

  const getRecommendations = async (goal: string) => {
    setSelectedGoal(goal);
    setLoading(true);
    setRecommendations([]);

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, current_foods: [], dietary_restrictions: [] })
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
        setAiModel(data.ai_model || 'gemini-3-flash');
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGoalInfo = (goalId: string) => GOALS.find(g => g.id === goalId);

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = { nutrition: 'nutrition', hydration: 'water', routine: 'calendar', prediction: 'analytics' };
    return icons[category] || 'information-circle';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = { nutrition: '#4ecdc4', hydration: '#00d4ff', routine: '#a29bfe', prediction: '#ffd93d' };
    return colors[category] || '#888';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchInsights().finally(() => setRefreshing(false)); }} tintColor="#00d4ff" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('ai_title')}</Text>
          <Text style={styles.subtitle}>Personalized insights powered by AI</Text>
        </View>

        {/* Daily Insights */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="sparkles" size={20} color="#ffd93d" />
              <Text style={styles.sectionTitle}>Daily Insights</Text>
            </View>
            <TouchableOpacity style={styles.generateBtn} onPress={generateInsights} disabled={loadingInsights}>
              {loadingInsights ? (
                <ActivityIndicator size="small" color="#ffd93d" />
              ) : (
                <>
                  <Ionicons name="refresh" size={16} color="#ffd93d" />
                  <Text style={styles.generateBtnText}>Generate</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {insights.length > 0 ? (
            insights.map((insight, index) => (
              <View key={index} style={[styles.insightCard, { borderLeftColor: insight.priority === 'high' ? '#ff6b6b' : getCategoryColor(insight.category) }]}>
                <View style={styles.insightHeader}>
                  <View style={[styles.insightIcon, { backgroundColor: getCategoryColor(insight.category) + '20' }]}>
                    <Ionicons name={getCategoryIcon(insight.category) as any} size={18} color={getCategoryColor(insight.category)} />
                  </View>
                  <View style={styles.insightInfo}>
                    <Text style={styles.insightTitle}>{insight.title}</Text>
                    <Text style={styles.insightCategory}>{insight.category}</Text>
                  </View>
                  {insight.priority === 'high' && (
                    <View style={styles.priorityBadge}>
                      <Text style={styles.priorityText}>High</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.insightMessage}>{insight.message}</Text>
                {insight.action_type && (
                  <TouchableOpacity style={styles.actionBtn}>
                    <Text style={styles.actionBtnText}>Take Action</Text>
                    <Ionicons name="arrow-forward" size={14} color="#00d4ff" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyInsights}>
              <Text style={styles.emptyText}>Tap "Generate" to get AI insights based on your data</Text>
            </View>
          )}
        </View>

        {/* Predictive Recommendations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="analytics" size={20} color="#a29bfe" />
              <Text style={styles.sectionTitle}>Predictive Recommendations</Text>
            </View>
            <TouchableOpacity style={styles.generateBtn} onPress={fetchPredictive} disabled={loadingPredictive}>
              {loadingPredictive ? (
                <ActivityIndicator size="small" color="#a29bfe" />
              ) : (
                <Ionicons name="arrow-forward" size={16} color="#a29bfe" />
              )}
            </TouchableOpacity>
          </View>

          {predictive.length > 0 ? (
            predictive.map((rec, index) => (
              <View key={index} style={styles.predictiveCard}>
                <View style={styles.predictiveHeader}>
                  <Text style={styles.predictiveType}>{rec.type}</Text>
                  {rec.optimal_time && <Text style={styles.predictiveTime}>{rec.optimal_time}</Text>}
                </View>
                <Text style={styles.predictiveTitle}>{rec.title}</Text>
                <Text style={styles.predictiveDesc}>{rec.description}</Text>
                {rec.expected_benefit && (
                  <View style={styles.benefitRow}>
                    <Ionicons name="checkmark-circle" size={14} color="#4ecdc4" />
                    <Text style={styles.benefitText}>{rec.expected_benefit}</Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyInsights}>
              <Text style={styles.emptyText}>Tap to analyze your patterns and get predictions</Text>
            </View>
          )}
        </View>

        {/* Food Recommendations by Goal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Food Recommendations</Text>
          <Text style={styles.sectionSubtitle}>Select your health goal</Text>

          <View style={styles.goalsGrid}>
            {GOALS.map((goal) => (
              <TouchableOpacity
                key={goal.id}
                style={[styles.goalCard, selectedGoal === goal.id && { borderColor: goal.color, backgroundColor: goal.color + '15' }]}
                onPress={() => getRecommendations(goal.id)}
              >
                <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                  <Ionicons name={goal.icon as any} size={22} color={goal.color} />
                </View>
                <Text style={styles.goalLabel}>{goal.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading && (
            <SkeletonAIInsights />
          )}

          {!loading && recommendations.length > 0 && (
            <View style={styles.recommendationsSection}>
              <View style={styles.recHeader}>
                <Text style={styles.recTitle}>Recommended for {getGoalInfo(selectedGoal!)?.label}</Text>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={12} color="#ffd93d" />
                  <Text style={styles.aiText}>{aiModel}</Text>
                </View>
              </View>

              {recommendations.map((rec, index) => (
                <View key={index} style={styles.recCard}>
                  <View style={styles.recCardHeader}>
                    <View style={styles.recNumber}>
                      <Text style={styles.recNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.recFood}>{rec.food}</Text>
                  </View>
                  <Text style={styles.recBenefit}>{rec.health_benefit}</Text>
                  
                  <View style={styles.recTags}>
                    {rec.key_nutrients.slice(0, 3).map((n, i) => (
                      <View key={i} style={styles.nutrientTag}>
                        <Text style={styles.tagText}>{n}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.recFooter}>
                    <View style={styles.cookingBadge}>
                      <Ionicons name="flame" size={12} color="#ff6b6b" />
                      <Text style={styles.cookingText}>{rec.best_cooking}</Text>
                    </View>
                    <Text style={styles.synergyText}>+ {rec.synergistic_foods.slice(0, 2).join(', ')}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 24, marginTop: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 8 },
  sectionSubtitle: { fontSize: 13, color: '#888', marginBottom: 16, marginTop: -8 },
  generateBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 217, 61, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  generateBtnText: { color: '#ffd93d', fontSize: 12, marginLeft: 4 },
  insightCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 3 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  insightIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  insightInfo: { flex: 1, marginLeft: 12 },
  insightTitle: { fontSize: 15, fontWeight: '600', color: '#fff' },
  insightCategory: { fontSize: 11, color: '#888', marginTop: 2, textTransform: 'capitalize' },
  priorityBadge: { backgroundColor: 'rgba(255, 107, 107, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  priorityText: { color: '#ff6b6b', fontSize: 10, fontWeight: '600' },
  insightMessage: { fontSize: 13, color: '#aaa', lineHeight: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  actionBtnText: { color: '#00d4ff', fontSize: 13, marginRight: 4 },
  emptyInsights: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 30, alignItems: 'center' },
  emptyText: { color: '#666', textAlign: 'center' },
  predictiveCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  predictiveHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  predictiveType: { fontSize: 11, color: '#a29bfe', textTransform: 'uppercase', fontWeight: '600' },
  predictiveTime: { fontSize: 11, color: '#888' },
  predictiveTitle: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 6 },
  predictiveDesc: { fontSize: 13, color: '#aaa', lineHeight: 18 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  benefitText: { color: '#4ecdc4', fontSize: 12, marginLeft: 6 },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  goalCard: { width: '48%', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  goalIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  goalLabel: { fontSize: 13, fontWeight: '500', color: '#fff' },
  loadingContainer: { alignItems: 'center', padding: 40 },
  loadingText: { color: '#888', marginTop: 16 },
  recommendationsSection: { marginTop: 20 },
  recHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  recTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  aiBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 217, 61, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  aiText: { color: '#ffd93d', fontSize: 10, marginLeft: 4 },
  recCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  recCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  recNumber: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center' },
  recNumberText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  recFood: { fontSize: 16, fontWeight: '600', color: '#fff', marginLeft: 12 },
  recBenefit: { fontSize: 13, color: '#aaa', lineHeight: 18, marginBottom: 12 },
  recTags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  nutrientTag: { backgroundColor: 'rgba(0, 212, 255, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, marginRight: 6, marginBottom: 4 },
  tagText: { color: '#00d4ff', fontSize: 11 },
  recFooter: { flexDirection: 'row', alignItems: 'center' },
  cookingBadge: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  cookingText: { color: '#ff6b6b', fontSize: 11, marginLeft: 4 },
  synergyText: { color: '#4ecdc4', fontSize: 11 },
});
