import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './_layout';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type Tab = 'suggest' | 'analyze' | 'generate';
type GoalKey = 'muscle_gain' | 'brain_health' | 'immune_system' | 'gut_microbiome' | 'longevity' | 'reduce_inflammation';

const GOAL_META: Record<GoalKey, { icon: string; color: string; label: string }> = {
  muscle_gain: { icon: 'barbell', color: '#ff6b6b', label: 'Muscle Growth' },
  brain_health: { icon: 'bulb', color: '#a29bfe', label: 'Brain Health' },
  immune_system: { icon: 'shield-checkmark', color: '#00ff88', label: 'Immune System' },
  gut_microbiome: { icon: 'leaf', color: '#4ecdc4', label: 'Gut Health' },
  longevity: { icon: 'heart', color: '#ffd93d', label: 'Longevity' },
  reduce_inflammation: { icon: 'flame', color: '#ff9f43', label: 'Anti-Inflammation' },
};

export default function MolecularEngineScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('suggest');
  const [selectedGoals, setSelectedGoals] = useState<GoalKey[]>(['muscle_gain']);
  const [profiles, setProfiles] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<any>(null);
  const [generatedMeal, setGeneratedMeal] = useState<any>(null);
  const [mealType, setMealType] = useState('lunch');
  // Analyze tab state
  const [todaysMeals, setTodaysMeals] = useState<any[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [fixSuggestions, setFixSuggestions] = useState<any>(null);
  const [fixLoading, setFixLoading] = useState(false);

  useEffect(() => { loadProfiles(); loadTodaysMeals(); }, []);

  const getToken = async () => AsyncStorage.getItem('session_token');

  const loadProfiles = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/molecular/profiles`);
      if (res.ok) setProfiles(await res.json());
    } catch (e) {}
  };

  const loadTodaysMeals = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/meals/today`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setTodaysMeals(data.meals || []); }
    } catch (e) {}
  };

  const toggleGoal = (goal: GoalKey) => {
    setSelectedGoals(prev =>
      prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]
    );
    setSuggestions(null);
    setGeneratedMeal(null);
    setAnalysisResult(null);
    setFixSuggestions(null);
  };

  const fetchSuggestions = async () => {
    setLoading(true); setSuggestions(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/molecular/suggest-combinations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goals: selectedGoals }),
      });
      if (res.ok) setSuggestions(await res.json());
    } catch (e) { Alert.alert('Error', 'Failed to load suggestions'); }
    finally { setLoading(false); }
  };

  const analyzeMeals = async () => {
    if (todaysMeals.length === 0) { Alert.alert('No Meals', 'Log some meals first to analyze.'); return; }
    setLoading(true); setAnalysisResult(null); setFixSuggestions(null);
    try {
      const token = await getToken();
      const foods = todaysMeals.map(m => ({
        food_name: m.food_name, elements: m.elements || {}, nutrients: m.nutrients || {},
      }));
      const res = await fetch(`${BACKEND_URL}/api/molecular/analyze-meal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ foods, goals: selectedGoals }),
      });
      if (res.ok) setAnalysisResult(await res.json());
    } catch (e) { Alert.alert('Error', 'Failed to analyze meals'); }
    finally { setLoading(false); }
  };

  const fetchFixes = async () => {
    if (!analysisResult) return;
    setFixLoading(true);
    try {
      const token = await getToken();
      const foods = todaysMeals.map(m => ({ food_name: m.food_name, elements: m.elements || {}, nutrients: m.nutrients || {} }));
      const res = await fetch(`${BACKEND_URL}/api/molecular/fix-meal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ foods, goals: selectedGoals, deficiencies: analysisResult.deficiencies }),
      });
      if (res.ok) { const data = await res.json(); setFixSuggestions(data.suggestions); }
    } catch (e) { Alert.alert('Error', 'Failed to get fix suggestions'); }
    finally { setFixLoading(false); }
  };

  const generateMeal = async () => {
    setLoading(true); setGeneratedMeal(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/molecular/generate-meal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ goals: selectedGoals, meal_type: mealType, num_foods: 5 }),
      });
      if (res.ok) setGeneratedMeal(await res.json());
    } catch (e) { Alert.alert('Error', 'Failed to generate meal'); }
    finally { setLoading(false); }
  };

  const getScoreColor = (score: number) => score >= 80 ? '#00ff88' : score >= 60 ? '#ffd93d' : score >= 40 ? '#ff9f43' : '#ff6b6b';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Molecular Engine</Text>
          <Text style={styles.headerSub}>Elemental food optimization</Text>
        </View>
        <Ionicons name="flask" size={28} color="#00d4ff" />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([
          { key: 'suggest', icon: 'nutrition', label: 'Synergies' },
          { key: 'analyze', icon: 'analytics', label: 'Analyze' },
          { key: 'generate', icon: 'sparkles', label: 'Generate' },
        ] as const).map(tab => (
          <TouchableOpacity key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}>
            <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.key ? '#00d4ff' : '#666'} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Goal Selection */}
        <Text style={styles.sectionLabel}>Select Goals</Text>
        <View style={styles.goalsGrid}>
          {(Object.keys(GOAL_META) as GoalKey[]).map(key => {
            const meta = GOAL_META[key];
            const isSelected = selectedGoals.includes(key);
            return (
              <TouchableOpacity key={key}
                style={[styles.goalChip, isSelected && { backgroundColor: meta.color + '20', borderColor: meta.color }]}
                onPress={() => toggleGoal(key)}>
                <Ionicons name={meta.icon as any} size={16} color={isSelected ? meta.color : '#666'} />
                <Text style={[styles.goalChipText, isSelected && { color: meta.color }]}>{meta.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TAB: Synergies */}
        {activeTab === 'suggest' && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={fetchSuggestions} disabled={loading || selectedGoals.length === 0}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="search" size={20} color="#fff" /><Text style={styles.actionBtnText}>Find Best Combinations</Text></>}
            </TouchableOpacity>
            {suggestions && Object.entries(suggestions.goals || {}).map(([goalKey, goalData]: [string, any]) => (
              <View key={goalKey} style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Ionicons name={GOAL_META[goalKey as GoalKey]?.icon as any || 'star'} size={20} color={GOAL_META[goalKey as GoalKey]?.color || '#fff'} />
                  <Text style={styles.resultTitle}>{goalData.name}</Text>
                </View>
                <Text style={styles.resultDesc}>{goalData.description}</Text>
                <Text style={styles.subLabel}>Top Foods</Text>
                <View style={styles.foodChips}>
                  {goalData.key_foods?.map((f: string, i: number) => (
                    <View key={i} style={styles.foodChip}><Text style={styles.foodChipText}>{f}</Text></View>
                  ))}
                </View>
                <Text style={styles.subLabel}>Synergy Pairs</Text>
                {goalData.synergy_pairs?.map((pair: any, i: number) => (
                  <View key={i} style={styles.synergyCard}>
                    <View style={styles.synergyFoods}>
                      <Text style={styles.synergyFood}>{pair.foods[0]}</Text>
                      <Ionicons name="add-circle" size={16} color="#00d4ff" />
                      <Text style={styles.synergyFood}>{pair.foods[1]}</Text>
                    </View>
                    <Text style={styles.synergyReason}>{pair.reason}</Text>
                  </View>
                ))}
                <Text style={styles.subLabel}>Priority Elements</Text>
                <View style={styles.foodChips}>
                  {goalData.priority_elements?.map((el: string, i: number) => (
                    <View key={i} style={[styles.elementChip, { borderColor: '#00d4ff' }]}>
                      <Text style={styles.elementChipText}>{el}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}

        {/* TAB: Analyze */}
        {activeTab === 'analyze' && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={analyzeMeals} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="analytics" size={20} color="#fff" /><Text style={styles.actionBtnText}>Analyze Today's Meals ({todaysMeals.length})</Text></>}
            </TouchableOpacity>
            {analysisResult && (
              <View style={styles.resultCard}>
                <View style={styles.scoreContainer}>
                  <View style={[styles.scoreBadge, { borderColor: getScoreColor(analysisResult.balance_score) }]}>
                    <Text style={[styles.scoreNum, { color: getScoreColor(analysisResult.balance_score) }]}>{analysisResult.balance_score}</Text>
                    <Text style={styles.scoreLabel}>Balance</Text>
                  </View>
                  <View style={styles.scoreInfo}>
                    <Text style={styles.resultTitle}>Elemental Balance</Text>
                    <Text style={styles.resultDesc}>Based on {analysisResult.food_names?.join(', ')}</Text>
                  </View>
                </View>

                {/* Element breakdown */}
                {Object.entries(analysisResult.elements || {}).map(([el, data]: [string, any]) => (
                  <View key={el} style={styles.elementRow}>
                    <View style={[styles.elementBadge, { backgroundColor: data.status === 'optimal' ? '#00ff8820' : data.status === 'low' ? '#ff6b6b20' : data.status === 'high' ? '#ffd93d20' : '#ffffff10' }]}>
                      <Text style={styles.elementSymbol}>{el}</Text>
                    </View>
                    <View style={styles.elementInfo}>
                      <Text style={styles.elementName}>{data.role}</Text>
                      <View style={styles.elementBar}>
                        <View style={[styles.elementFill, { width: `${Math.min(data.score, 100)}%`, backgroundColor: getScoreColor(data.score) }]} />
                      </View>
                    </View>
                    <Text style={[styles.elementPct, { color: getScoreColor(data.score) }]}>{data.actual_pct}%</Text>
                  </View>
                ))}

                {/* Deficiencies */}
                {analysisResult.deficiencies?.length > 0 && (
                  <>
                    <Text style={[styles.subLabel, { color: '#ff6b6b', marginTop: 16 }]}>Deficiencies Found</Text>
                    {analysisResult.deficiencies.map((d: any, i: number) => (
                      <View key={i} style={styles.deficiencyRow}>
                        <Ionicons name="warning" size={16} color="#ff6b6b" />
                        <Text style={styles.deficiencyText}>{d.element} — {d.role} (at {d.actual}%, ideal {d.ideal}%)</Text>
                      </View>
                    ))}
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ff6b6b', marginTop: 12 }]} onPress={fetchFixes} disabled={fixLoading}>
                      {fixLoading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="hammer" size={20} color="#fff" /><Text style={styles.actionBtnText}>AI: Fix My Meal</Text></>}
                    </TouchableOpacity>
                  </>
                )}

                {/* Fix suggestions */}
                {fixSuggestions && (
                  <View style={styles.fixCard}>
                    <Text style={[styles.subLabel, { color: '#00ff88' }]}>AI Suggestions</Text>
                    <Text style={styles.fixExplanation}>{fixSuggestions.explanation}</Text>
                    {fixSuggestions.additions?.map((a: any, i: number) => (
                      <View key={i} style={styles.fixItem}>
                        <Ionicons name="add-circle" size={18} color="#00ff88" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.fixFood}>Add: {a.food} ({a.portion_g}g)</Text>
                          <Text style={styles.fixReason}>{a.reason}</Text>
                        </View>
                      </View>
                    ))}
                    {fixSuggestions.swaps?.map((s: any, i: number) => (
                      <View key={i} style={styles.fixItem}>
                        <Ionicons name="swap-horizontal" size={18} color="#ffd93d" />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                          <Text style={styles.fixFood}>Swap: {s.remove} → {s.replace_with}</Text>
                          <Text style={styles.fixReason}>{s.reason}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {/* TAB: Generate */}
        {activeTab === 'generate' && (
          <>
            <Text style={styles.sectionLabel}>Meal Type</Text>
            <View style={styles.mealTypeRow}>
              {['breakfast', 'lunch', 'dinner', 'snack'].map(t => (
                <TouchableOpacity key={t} style={[styles.mealTypeBtn, mealType === t && styles.mealTypeBtnActive]} onPress={() => setMealType(t)}>
                  <Text style={[styles.mealTypeText, mealType === t && styles.mealTypeTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#a29bfe' }]} onPress={generateMeal} disabled={loading || selectedGoals.length === 0}>
              {loading ? <ActivityIndicator color="#fff" /> : <><Ionicons name="sparkles" size={20} color="#fff" /><Text style={styles.actionBtnText}>Generate Perfect Meal</Text></>}
            </TouchableOpacity>
            {generatedMeal?.meal && (
              <View style={styles.resultCard}>
                <Text style={[styles.resultTitle, { fontSize: 18 }]}>{generatedMeal.meal.meal_name}</Text>
                <Text style={styles.resultDesc}>Optimized for: {generatedMeal.goals?.join(', ')}</Text>

                {generatedMeal.meal.foods?.map((f: any, i: number) => (
                  <View key={i} style={styles.genFoodCard}>
                    <View style={styles.genFoodHeader}>
                      <Ionicons name="restaurant" size={16} color="#4ecdc4" />
                      <Text style={styles.genFoodName}>{f.food_name}</Text>
                      <Text style={styles.genFoodPortion}>{f.portion_g}g • {f.cooking_method}</Text>
                    </View>
                    <Text style={styles.genFoodContrib}>{f.goal_contribution}</Text>
                    {f.key_elements?.length > 0 && (
                      <View style={styles.foodChips}>
                        {f.key_elements.map((el: string, j: number) => (
                          <View key={j} style={[styles.elementChip, { borderColor: '#4ecdc4' }]}>
                            <Text style={[styles.elementChipText, { color: '#4ecdc4' }]}>{el}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ))}

                {generatedMeal.meal.synergies?.length > 0 && (
                  <>
                    <Text style={[styles.subLabel, { marginTop: 16 }]}>Synergies</Text>
                    {generatedMeal.meal.synergies.map((s: string, i: number) => (
                      <View key={i} style={styles.synergyCard}>
                        <Ionicons name="flash" size={14} color="#ffd93d" />
                        <Text style={styles.synergyReason}>{s}</Text>
                      </View>
                    ))}
                  </>
                )}

                <Text style={[styles.subLabel, { marginTop: 16 }]}>Molecular Reasoning</Text>
                <Text style={styles.reasoningText}>{generatedMeal.meal.elemental_reasoning}</Text>

                {generatedMeal.meal.estimated_macros && (
                  <View style={styles.macroRow}>
                    {Object.entries(generatedMeal.meal.estimated_macros).map(([key, val]: [string, any]) => (
                      <View key={key} style={styles.macroItem}>
                        <Text style={styles.macroVal}>{val}</Text>
                        <Text style={styles.macroLabel}>{key.replace('_g', 'g').replace('_', ' ')}</Text>
                      </View>
                    ))}
                  </View>
                )}
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
  container: { flex: 1, backgroundColor: '#080818' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: '#666' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)' },
  tabActive: { backgroundColor: 'rgba(0,212,255,0.12)', borderWidth: 1, borderColor: 'rgba(0,212,255,0.3)' },
  tabText: { fontSize: 13, color: '#666', fontWeight: '600', marginLeft: 6 },
  tabTextActive: { color: '#00d4ff' },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  sectionLabel: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  goalChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  goalChipText: { fontSize: 12, color: '#666', fontWeight: '600', marginLeft: 6 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00d4ff', paddingVertical: 16, borderRadius: 14, marginBottom: 16 },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', marginLeft: 8 },
  resultCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  resultHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  resultTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginLeft: 8 },
  resultDesc: { fontSize: 13, color: '#888', marginBottom: 12, lineHeight: 18 },
  subLabel: { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  foodChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  foodChip: { backgroundColor: 'rgba(0,212,255,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  foodChipText: { color: '#00d4ff', fontSize: 12, fontWeight: '500' },
  elementChip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  elementChipText: { color: '#00d4ff', fontSize: 12, fontWeight: '700' },
  synergyCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10, marginBottom: 8 },
  synergyFoods: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  synergyFood: { color: '#ffd93d', fontSize: 13, fontWeight: '600', marginHorizontal: 4 },
  synergyReason: { color: '#aaa', fontSize: 12, lineHeight: 17, marginLeft: 6, flex: 1 },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  scoreBadge: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  scoreNum: { fontSize: 22, fontWeight: '800' },
  scoreLabel: { fontSize: 9, color: '#888', fontWeight: '600' },
  scoreInfo: { flex: 1 },
  elementRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  elementBadge: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  elementSymbol: { color: '#fff', fontSize: 14, fontWeight: '800' },
  elementInfo: { flex: 1 },
  elementName: { color: '#aaa', fontSize: 12, marginBottom: 4 },
  elementBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  elementFill: { height: 6, borderRadius: 3 },
  elementPct: { fontSize: 13, fontWeight: '700', width: 45, textAlign: 'right' },
  deficiencyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  deficiencyText: { color: '#ff6b6b', fontSize: 12, marginLeft: 6, flex: 1 },
  fixCard: { marginTop: 12, backgroundColor: 'rgba(0,255,136,0.04)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(0,255,136,0.15)' },
  fixExplanation: { color: '#aaa', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  fixItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  fixFood: { color: '#fff', fontSize: 13, fontWeight: '600' },
  fixReason: { color: '#888', fontSize: 12, lineHeight: 17 },
  mealTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  mealTypeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  mealTypeBtnActive: { backgroundColor: 'rgba(162,155,254,0.15)', borderWidth: 1, borderColor: '#a29bfe' },
  mealTypeText: { fontSize: 13, color: '#666', fontWeight: '600' },
  mealTypeTextActive: { color: '#a29bfe' },
  genFoodCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10, marginBottom: 8 },
  genFoodHeader: { flexDirection: 'row', alignItems: 'center' },
  genFoodName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  genFoodPortion: { color: '#888', fontSize: 11 },
  genFoodContrib: { color: '#888', fontSize: 12, marginTop: 4, lineHeight: 17 },
  reasoningText: { color: '#aaa', fontSize: 13, lineHeight: 20 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  macroItem: { alignItems: 'center' },
  macroVal: { color: '#fff', fontSize: 18, fontWeight: '700' },
  macroLabel: { color: '#888', fontSize: 10, marginTop: 2, textTransform: 'capitalize' },
});
