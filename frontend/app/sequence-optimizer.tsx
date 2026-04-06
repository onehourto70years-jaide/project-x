import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface SequenceStep {
  step: number;
  phase: number;
  phase_name: string;
  food_name: string;
  portion_grams: number;
  category: string;
  digestion_speed: string;
  gi_estimate: string;
  reasoning: string;
  benefits: string[];
  wait_minutes: number;
}

interface Insight {
  type: string;
  icon: string;
  title: string;
  message: string;
  action: string;
  impact: string;
}

interface Synergy {
  type: string;
  icon: string;
  benefit: string;
  boost_percent: number;
  action: string;
  foods: string[];
}

interface Conflict {
  type: string;
  icon: string;
  issue: string;
  reduction_percent: number;
  action: string;
  foods: string[];
}

interface FoodEntry {
  id: string;
  name: string;
  portion_grams: number;
}

const PHASE_COLORS: Record<number, string> = {
  0: '#00b4d8',
  1: '#2ecc71',
  2: '#e17055',
  3: '#fdcb6e',
  4: '#fd79a8',
};

const CATEGORY_ICONS: Record<string, string> = {
  liquid: 'water',
  fermented: 'flask',
  fiber_rich: 'leaf',
  protein_rich: 'fitness',
  healthy_fat: 'nutrition',
  dairy: 'cafe',
  complex_carb: 'grid',
  simple_carb: 'ice-cream',
  fruit: 'flower',
};

export default function SequenceOptimizerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [foods, setFoods] = useState<FoodEntry[]>([]);
  const [foodInput, setFoodInput] = useState('');
  const [portionInput, setPortionInput] = useState('100');
  const [mode, setMode] = useState<'health' | 'performance'>('health');
  const [goal, setGoal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingToday, setLoadingToday] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showInsights, setShowInsights] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const addFood = () => {
    const name = foodInput.trim();
    if (!name) return;
    const grams = parseFloat(portionInput) || 100;
    setFoods(prev => [...prev, { id: `${Date.now()}`, name, portion_grams: grams }]);
    setFoodInput('');
    setPortionInput('100');
  };

  const removeFood = (id: string) => {
    setFoods(prev => prev.filter(f => f.id !== id));
  };

  const optimize = async () => {
    if (foods.length < 2) {
      Alert.alert('Need More Foods', 'Add at least 2 foods to optimize the eating sequence.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const res = await fetch(`${BACKEND_URL}/api/sequence/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          foods: foods.map(f => ({ name: f.name, portion_grams: f.portion_grams })),
          mode,
          goal,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
      } else {
        Alert.alert('Error', 'Failed to optimize. Try again.');
      }
    } catch (e) {
      Alert.alert('Error', 'Connection failed. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  const optimizeToday = async () => {
    setLoadingToday(true);
    setResult(null);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const res = await fetch(`${BACKEND_URL}/api/sequence/from-today?mode=${mode}${goal ? `&goal=${goal}` : ''}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          Alert.alert('Not Enough Data', data.error);
        } else {
          setResult(data);
          fadeAnim.setValue(0);
          Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to load today\'s meals.');
    } finally {
      setLoadingToday(false);
    }
  };

  const renderStepCard = (step: SequenceStep, index: number) => {
    const isExpanded = expandedStep === index;
    const color = PHASE_COLORS[step.phase] || '#00d4ff';
    const icon = CATEGORY_ICONS[step.category] || 'ellipse';
    const isLast = index === (result?.sequence?.length || 0) - 1;

    return (
      <View key={`step-${index}`} style={{ marginBottom: 4 }}>
        {/* Timeline connector */}
        <View style={{ flexDirection: 'row' }}>
          {/* Timeline line */}
          <View style={{ width: 48, alignItems: 'center' }}>
            <View style={[styles.stepNumber, { backgroundColor: color }]}>
              <Text style={styles.stepNumberText}>{step.step}</Text>
            </View>
            {!isLast && <View style={[styles.timelineLine, { backgroundColor: color + '40' }]} />}
          </View>

          {/* Content card */}
          <TouchableOpacity
            style={[styles.stepCard, { borderLeftColor: color, borderLeftWidth: 3 }]}
            onPress={() => setExpandedStep(isExpanded ? null : index)}
            activeOpacity={0.7}
          >
            <View style={styles.stepHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                <Ionicons name={icon as any} size={20} color={color} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.stepFoodName}>{step.food_name}</Text>
                  <Text style={styles.stepPhase}>{step.phase_name}</Text>
                </View>
              </View>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
            </View>

            {/* Benefits pills */}
            <View style={styles.benefitRow}>
              {step.benefits.slice(0, 2).map((b, i) => (
                <View key={i} style={[styles.benefitPill, { backgroundColor: color + '18' }]}>
                  <Text style={[styles.benefitText, { color }]}>{b}</Text>
                </View>
              ))}
            </View>

            {/* Expanded reasoning */}
            {isExpanded && (
              <View style={styles.expandedSection}>
                <Text style={styles.reasoningLabel}>Why this order?</Text>
                <Text style={styles.reasoningText}>{step.reasoning}</Text>
                <View style={styles.metaRow}>
                  <View style={styles.metaTag}>
                    <Text style={styles.metaTagText}>GI: {step.gi_estimate}</Text>
                  </View>
                  <View style={styles.metaTag}>
                    <Text style={styles.metaTagText}>Digestion: {step.digestion_speed}</Text>
                  </View>
                  <View style={styles.metaTag}>
                    <Text style={styles.metaTagText}>{step.portion_grams}g</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Wait indicator */}
            {step.wait_minutes > 0 && !isLast && (
              <View style={styles.waitBadge}>
                <Ionicons name="time-outline" size={12} color="#aaa" />
                <Text style={styles.waitText}>Wait ~{step.wait_minutes} min</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Sequence Optimizer</Text>
          <Text style={styles.headerSub}>Optimal eating order for max absorption</Text>
        </View>
        <Ionicons name="flask" size={24} color="#00d4ff" />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Mode Toggle */}
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'health' && styles.modeBtnActive]}
              onPress={() => setMode('health')}
            >
              <Ionicons name="heart" size={16} color={mode === 'health' ? '#fff' : '#888'} />
              <Text style={[styles.modeBtnText, mode === 'health' && styles.modeBtnTextActive]}>Health</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'performance' && styles.modeBtnActivePerf]}
              onPress={() => setMode('performance')}
            >
              <Ionicons name="flash" size={16} color={mode === 'performance' ? '#fff' : '#888'} />
              <Text style={[styles.modeBtnText, mode === 'performance' && styles.modeBtnTextActive]}>Performance</Text>
            </TouchableOpacity>
          </View>

          {/* Goal Selector (performance mode) */}
          {mode === 'performance' && (
            <View style={styles.goalRow}>
              {[
                { id: 'muscle_gain', label: 'Muscle', icon: 'barbell' },
                { id: 'fat_loss', label: 'Fat Loss', icon: 'flame' },
                { id: 'energy', label: 'Energy', icon: 'flash' },
                { id: 'digestion', label: 'Digest', icon: 'medical' },
              ].map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.goalChip, goal === g.id && styles.goalChipActive]}
                  onPress={() => setGoal(goal === g.id ? null : g.id)}
                >
                  <Ionicons name={g.icon as any} size={14} color={goal === g.id ? '#fff' : '#aaa'} />
                  <Text style={[styles.goalChipText, goal === g.id && { color: '#fff' }]}>{g.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Food Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Foods</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.foodInput}
                placeholder="e.g. Grilled Chicken"
                placeholderTextColor="#555"
                value={foodInput}
                onChangeText={setFoodInput}
                onSubmitEditing={addFood}
                returnKeyType="done"
              />
              <TextInput
                style={styles.portionInput}
                placeholder="g"
                placeholderTextColor="#555"
                value={portionInput}
                onChangeText={setPortionInput}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.addBtn} onPress={addFood}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Food list */}
            {foods.map(f => (
              <View key={f.id} style={styles.foodChip}>
                <Ionicons name="restaurant-outline" size={14} color="#00d4ff" />
                <Text style={styles.foodChipText}>{f.name}</Text>
                <Text style={styles.foodChipGrams}>{f.portion_grams}g</Text>
                <TouchableOpacity onPress={() => removeFood(f.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={18} color="#ff4757" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.optimizeBtn, foods.length < 2 && { opacity: 0.5 }]}
                onPress={optimize}
                disabled={loading || foods.length < 2}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : (
                  <>
                    <Ionicons name="flash" size={18} color="#fff" />
                    <Text style={styles.optimizeBtnText}>Optimize Sequence</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.todayBtn} onPress={optimizeToday} disabled={loadingToday}>
                {loadingToday ? <ActivityIndicator color="#00d4ff" size="small" /> : (
                  <>
                    <Ionicons name="today" size={16} color="#00d4ff" />
                    <Text style={styles.todayBtnText}>Use Today's Meals</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ──── RESULTS ──── */}
          {result && result.sequence && (
            <Animated.View style={{ opacity: fadeAnim }}>
              {/* AI Summary */}
              {result.ai_summary && (
                <View style={styles.aiSummaryCard}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Ionicons name="sparkles" size={18} color="#ffd93d" />
                    <Text style={styles.aiSummaryTitle}>AI Analysis</Text>
                  </View>
                  <Text style={styles.aiSummaryText}>{result.ai_summary}</Text>
                </View>
              )}

              {/* Sequence Timeline */}
              <View style={styles.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Ionicons name="git-branch" size={20} color="#00d4ff" />
                  <Text style={styles.sectionTitle}>Optimal Eating Order</Text>
                </View>
                {result.sequence.map((step: SequenceStep, i: number) => renderStepCard(step, i))}
              </View>

              {/* Synergies & Conflicts */}
              {(result.synergies?.length > 0 || result.conflicts?.length > 0) && (
                <View style={styles.section}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
                    onPress={() => setShowInsights(!showInsights)}
                  >
                    <Ionicons name="bulb" size={20} color="#ffd93d" />
                    <Text style={styles.sectionTitle}>Smart Insights</Text>
                    <Ionicons name={showInsights ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
                  </TouchableOpacity>

                  {showInsights && (
                    <>
                      {result.synergies?.map((s: Synergy, i: number) => (
                        <View key={`syn-${i}`} style={[styles.insightCard, { borderLeftColor: '#2ecc71' }]}>
                          <View style={styles.insightHeader}>
                            <Text style={{ fontSize: 16 }}>✅</Text>
                            <Text style={[styles.insightTitle, { color: '#2ecc71' }]}>Synergy: +{s.boost_percent}%</Text>
                          </View>
                          <Text style={styles.insightMsg}>{s.benefit}</Text>
                          <Text style={styles.insightAction}>{s.action}</Text>
                        </View>
                      ))}

                      {result.conflicts?.map((c: Conflict, i: number) => (
                        <View key={`con-${i}`} style={[styles.insightCard, { borderLeftColor: '#ff6b6b' }]}>
                          <View style={styles.insightHeader}>
                            <Text style={{ fontSize: 16 }}>⚠️</Text>
                            <Text style={[styles.insightTitle, { color: '#ff6b6b' }]}>Conflict: -{c.reduction_percent}%</Text>
                          </View>
                          <Text style={styles.insightMsg}>{c.issue}</Text>
                          <Text style={styles.insightAction}>{c.action}</Text>
                        </View>
                      ))}

                      {result.insights?.map((ins: Insight, i: number) => (
                        <View key={`ins-${i}`} style={[styles.insightCard, { borderLeftColor: ins.type === 'suggestion' ? '#ffd93d' : ins.type === 'performance' ? '#6c5ce7' : '#00d4ff' }]}>
                          <View style={styles.insightHeader}>
                            <Text style={{ fontSize: 16 }}>{ins.icon}</Text>
                            <Text style={styles.insightTitle}>{ins.title}</Text>
                          </View>
                          <Text style={styles.insightMsg}>{ins.message}</Text>
                          <Text style={styles.insightAction}>{ins.action}</Text>
                          <View style={[styles.impactBadge, { backgroundColor: ins.type === 'conflict' ? 'rgba(255,107,107,0.15)' : 'rgba(0,212,255,0.12)' }]}>
                            <Text style={[styles.impactText, { color: ins.type === 'conflict' ? '#ff6b6b' : '#00d4ff' }]}>{ins.impact}</Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}

              {/* Mode Reasoning */}
              {result.mode_reasoning && (
                <View style={styles.modeReasoningCard}>
                  <Ionicons name="information-circle" size={16} color="#a29bfe" />
                  <Text style={styles.modeReasoningText}>{result.mode_reasoning}</Text>
                </View>
              )}
            </Animated.View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#888', fontSize: 12, marginTop: 2 },

  // Mode toggle
  modeRow: { flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 8 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modeBtnActive: { backgroundColor: '#2ecc71', borderColor: '#2ecc71' },
  modeBtnActivePerf: { backgroundColor: '#6c5ce7', borderColor: '#6c5ce7' },
  modeBtnText: { color: '#888', fontSize: 14, fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },

  // Goal chips
  goalRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  goalChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  goalChipActive: { backgroundColor: '#6c5ce7', borderColor: '#6c5ce7' },
  goalChipText: { color: '#aaa', fontSize: 12, fontWeight: '600' },

  // Section
  section: { marginTop: 20 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Input
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  foodInput: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  portionInput: { width: 60, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12, color: '#fff', fontSize: 14, textAlign: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  addBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#00d4ff', alignItems: 'center', justifyContent: 'center' },

  // Food chip
  foodChip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,212,255,0.08)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  foodChipText: { color: '#fff', fontSize: 14, fontWeight: '500', flex: 1 },
  foodChipGrams: { color: '#888', fontSize: 12 },

  // Actions
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  optimizeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: '#00d4ff' },
  optimizeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  todayBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: '#00d4ff' },
  todayBtnText: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },

  // AI Summary
  aiSummaryCard: { marginTop: 20, backgroundColor: 'rgba(255,217,61,0.06)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,217,61,0.15)' },
  aiSummaryTitle: { color: '#ffd93d', fontSize: 15, fontWeight: '700' },
  aiSummaryText: { color: '#ccc', fontSize: 13, lineHeight: 20 },

  // Step card
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  stepNumberText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  timelineLine: { width: 2, flex: 1, marginTop: -2, marginBottom: -2 },
  stepCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginLeft: 10, marginBottom: 8 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepFoodName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stepPhase: { color: '#888', fontSize: 11, marginTop: 2 },
  benefitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  benefitPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  benefitText: { fontSize: 11, fontWeight: '600' },

  // Expanded
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  reasoningLabel: { color: '#00d4ff', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  reasoningText: { color: '#bbb', fontSize: 13, lineHeight: 19 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metaTag: { backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  metaTagText: { color: '#888', fontSize: 11 },

  // Wait
  waitBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  waitText: { color: '#aaa', fontSize: 11 },

  // Insights
  insightCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  insightTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  insightMsg: { color: '#bbb', fontSize: 13, lineHeight: 18, marginBottom: 6 },
  insightAction: { color: '#aaa', fontSize: 12, fontStyle: 'italic' },
  impactBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 8 },
  impactText: { fontSize: 12, fontWeight: '700' },

  // Mode reasoning
  modeReasoningCard: { flexDirection: 'row', gap: 8, marginTop: 16, backgroundColor: 'rgba(162,155,254,0.08)', borderRadius: 12, padding: 14, alignItems: 'flex-start' },
  modeReasoningText: { color: '#a29bfe', fontSize: 12, lineHeight: 18, flex: 1 },
});
