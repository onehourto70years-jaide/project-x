import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './_layout';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
  const [selectedGoals, setSelectedGoals] = useState<GoalKey[]>(['muscle_gain']);
  const [loading, setLoading] = useState(false);
  const [todaysMeals, setTodaysMeals] = useState<any[]>([]);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [fixSuggestions, setFixSuggestions] = useState<any>(null);
  const [fixLoading, setFixLoading] = useState(false);

  useEffect(() => { loadTodaysMeals(); }, []);

  const getToken = async () => AsyncStorage.getItem('session_token');

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
    setAnalysisResult(null);
    setFixSuggestions(null);
  };

  const analyzeMeals = async () => {
    if (todaysMeals.length === 0) { Alert.alert('No Meals', 'Log some meals first to analyze their elemental balance.'); return; }
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

  const getScoreColor = (score: number) => score >= 80 ? '#00ff88' : score >= 60 ? '#ffd93d' : score >= 40 ? '#ff9f43' : '#ff6b6b';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Molecular Engine</Text>
          <Text style={styles.headerSub}>Elemental food optimization</Text>
        </View>
        <Ionicons name="flask" size={28} color="#00d4ff" />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Goal Selection */}
        <Text style={styles.sectionLabel}>Select Your Goals</Text>
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

        {/* Meals info */}
        <View style={styles.mealsInfoCard}>
          <Ionicons name="restaurant" size={18} color="#4ecdc4" />
          <Text style={styles.mealsInfoText}>
            {todaysMeals.length > 0
              ? `${todaysMeals.length} meal${todaysMeals.length > 1 ? 's' : ''} logged today: ${todaysMeals.map(m => m.food_name).join(', ')}`
              : 'No meals logged today. Log some meals to analyze.'}
          </Text>
        </View>

        {/* Analyze Button */}
        <TouchableOpacity style={styles.actionBtn} onPress={analyzeMeals} disabled={loading || todaysMeals.length === 0}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="analytics" size={22} color="#fff" />
              <Text style={styles.actionBtnText}>Analyze Elemental Balance</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Analysis Results */}
        {analysisResult && (
          <View style={styles.resultCard}>
            {/* Score */}
            <View style={styles.scoreContainer}>
              <View style={[styles.scoreBadge, { borderColor: getScoreColor(analysisResult.balance_score) }]}>
                <Text style={[styles.scoreNum, { color: getScoreColor(analysisResult.balance_score) }]}>{analysisResult.balance_score}</Text>
                <Text style={styles.scoreLabel}>/ 100</Text>
              </View>
              <View style={styles.scoreInfo}>
                <Text style={styles.resultTitle}>Elemental Balance Score</Text>
                <Text style={styles.resultDesc}>Total mass: {analysisResult.total_mass_g}g across {analysisResult.food_names?.length || 0} food(s)</Text>
              </View>
            </View>

            {/* Element breakdown */}
            <Text style={styles.subLabel}>Element Breakdown</Text>
            {Object.entries(analysisResult.elements || {}).map(([el, data]: [string, any]) => (
              <View key={el} style={styles.elementRow}>
                <View style={[styles.elementBadge, {
                  backgroundColor: data.status === 'optimal' ? '#00ff8820' : data.status === 'low' ? '#ff6b6b20' : data.status === 'high' ? '#ffd93d20' : '#ffffff10'
                }]}>
                  <Text style={styles.elementSymbol}>{el}</Text>
                </View>
                <View style={styles.elementInfo}>
                  <Text style={styles.elementName}>{data.role}</Text>
                  <View style={styles.elementBar}>
                    <View style={[styles.elementFill, { width: `${Math.min(data.score, 100)}%`, backgroundColor: getScoreColor(data.score) }]} />
                  </View>
                </View>
                <View style={styles.elementPctContainer}>
                  <Text style={[styles.elementPct, { color: getScoreColor(data.score) }]}>{data.actual_pct}%</Text>
                  <Text style={styles.elementIdeal}>ideal {data.ideal_pct}%</Text>
                </View>
              </View>
            ))}

            {/* Goal Scores */}
            {Object.keys(analysisResult.goal_scores || {}).length > 0 && (
              <>
                <Text style={[styles.subLabel, { marginTop: 16 }]}>Goal Alignment</Text>
                {Object.entries(analysisResult.goal_scores || {}).map(([goalKey, data]: [string, any]) => {
                  const meta = GOAL_META[goalKey as GoalKey];
                  return (
                    <View key={goalKey} style={styles.goalScoreRow}>
                      <Ionicons name={meta?.icon as any || 'star'} size={18} color={meta?.color || '#fff'} />
                      <Text style={styles.goalScoreName}>{data.profile_name}</Text>
                      <Text style={[styles.goalScoreVal, { color: data.score >= 60 ? '#00ff88' : data.score >= 30 ? '#ffd93d' : '#ff6b6b' }]}>{data.score}</Text>
                    </View>
                  );
                })}
              </>
            )}

            {/* Deficiencies */}
            {analysisResult.deficiencies?.length > 0 && (
              <>
                <Text style={[styles.subLabel, { color: '#ff6b6b', marginTop: 16 }]}>Deficiencies Found</Text>
                {analysisResult.deficiencies.map((d: any, i: number) => (
                  <View key={i} style={styles.deficiencyRow}>
                    <Ionicons name="warning" size={16} color="#ff6b6b" />
                    <Text style={styles.deficiencyText}>
                      <Text style={{ fontWeight: '700' }}>{d.element}</Text> — {d.role} (at {d.actual}%, ideal {d.ideal}%)
                    </Text>
                  </View>
                ))}
                <TouchableOpacity style={styles.fixBtn} onPress={fetchFixes} disabled={fixLoading}>
                  {fixLoading ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="hammer" size={20} color="#fff" />
                      <Text style={styles.fixBtnText}>Auto-Fix My Meal</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Excesses */}
            {analysisResult.excesses?.length > 0 && (
              <>
                <Text style={[styles.subLabel, { color: '#ffd93d', marginTop: 16 }]}>Excesses</Text>
                {analysisResult.excesses.map((d: any, i: number) => (
                  <View key={i} style={styles.deficiencyRow}>
                    <Ionicons name="arrow-up-circle" size={16} color="#ffd93d" />
                    <Text style={[styles.deficiencyText, { color: '#ffd93d' }]}>
                      <Text style={{ fontWeight: '700' }}>{d.element}</Text> — {d.role} (at {d.actual}%, ideal {d.ideal}%)
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* No issues */}
            {analysisResult.deficiencies?.length === 0 && analysisResult.excesses?.length === 0 && (
              <View style={styles.perfectCard}>
                <Ionicons name="checkmark-circle" size={28} color="#00ff88" />
                <Text style={styles.perfectText}>Your meal has great elemental balance!</Text>
              </View>
            )}

            {/* Fix suggestions */}
            {fixSuggestions && (
              <View style={styles.fixCard}>
                <Text style={[styles.subLabel, { color: '#00ff88' }]}>AI Fix Suggestions</Text>
                <Text style={styles.fixExplanation}>{fixSuggestions.explanation}</Text>
                {fixSuggestions.additions?.map((a: any, i: number) => (
                  <View key={i} style={styles.fixItem}>
                    <Ionicons name="add-circle" size={18} color="#00ff88" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.fixFood}>Add: {a.food} ({a.portion_g}g)</Text>
                      <Text style={styles.fixReason}>{a.reason}</Text>
                      {a.fixes_elements?.length > 0 && (
                        <View style={styles.fixElements}>
                          {a.fixes_elements.map((el: string, j: number) => (
                            <View key={j} style={styles.fixElChip}>
                              <Text style={styles.fixElText}>{el}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>
                ))}
                {fixSuggestions.swaps?.map((s: any, i: number) => (
                  <View key={i} style={styles.fixItem}>
                    <Ionicons name="swap-horizontal" size={18} color="#ffd93d" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.fixFood}>Swap: {s.remove} → {s.replace_with}</Text>
                      <Text style={styles.fixReason}>{s.reason}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
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
  content: { paddingHorizontal: 16, paddingTop: 16 },
  sectionLabel: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  goalChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  goalChipText: { fontSize: 12, color: '#666', fontWeight: '600', marginLeft: 6 },
  mealsInfoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(78,205,196,0.08)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(78,205,196,0.15)' },
  mealsInfoText: { flex: 1, color: '#aaa', fontSize: 13, marginLeft: 10, lineHeight: 18 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00d4ff', paddingVertical: 16, borderRadius: 14, marginBottom: 16 },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: '#fff', marginLeft: 8 },
  resultCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  scoreContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  scoreBadge: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  scoreNum: { fontSize: 24, fontWeight: '800' },
  scoreLabel: { fontSize: 10, color: '#888', fontWeight: '600' },
  scoreInfo: { flex: 1 },
  resultTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  resultDesc: { fontSize: 13, color: '#888', marginTop: 2 },
  subLabel: { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  elementRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  elementBadge: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  elementSymbol: { color: '#fff', fontSize: 15, fontWeight: '800' },
  elementInfo: { flex: 1 },
  elementName: { color: '#aaa', fontSize: 12, marginBottom: 4 },
  elementBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  elementFill: { height: 6, borderRadius: 3 },
  elementPctContainer: { alignItems: 'flex-end', width: 55 },
  elementPct: { fontSize: 14, fontWeight: '700' },
  elementIdeal: { fontSize: 9, color: '#555' },
  goalScoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 10 },
  goalScoreName: { flex: 1, color: '#ccc', fontSize: 14, fontWeight: '500', marginLeft: 10 },
  goalScoreVal: { fontSize: 18, fontWeight: '800' },
  deficiencyRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  deficiencyText: { color: '#ff6b6b', fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 18 },
  perfectCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 12 },
  perfectText: { color: '#00ff88', fontSize: 15, fontWeight: '600', marginLeft: 10 },
  fixBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff6b6b', paddingVertical: 14, borderRadius: 12, marginTop: 12 },
  fixBtnText: { fontSize: 15, fontWeight: '700', color: '#fff', marginLeft: 8 },
  fixCard: { marginTop: 16, backgroundColor: 'rgba(0,255,136,0.04)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(0,255,136,0.15)' },
  fixExplanation: { color: '#aaa', fontSize: 13, lineHeight: 20, marginBottom: 12 },
  fixItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  fixFood: { color: '#fff', fontSize: 14, fontWeight: '600' },
  fixReason: { color: '#888', fontSize: 12, lineHeight: 17, marginTop: 2 },
  fixElements: { flexDirection: 'row', gap: 6, marginTop: 4 },
  fixElChip: { backgroundColor: 'rgba(0,212,255,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  fixElText: { color: '#00d4ff', fontSize: 11, fontWeight: '700' },
});
