import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Platform, RefreshControl, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/ThemeContext';
import Svg, { Circle } from 'react-native-svg';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// Score ring component
function ScoreRing({ size, score, color }: { size: number; score: number; color: string }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(score / 100, 1);
  const strokeDashoffset = circumference - (progress * circumference);
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

const LEVEL_COLORS: Record<string, string> = {
  high: '#00ff88', optimal: '#00ff88', stable: '#00ff88', sharp: '#00ff88', satisfied: '#00ff88',
  moderate: '#ffd93d', normal: '#ffd93d', adequate: '#ffd93d', mild: '#ffd93d', rising: '#ffd93d',
  low: '#ff6b6b', unstable: '#ff6b6b', crash_risk: '#e74c3c', foggy: '#e74c3c', insufficient: '#ff6b6b', intense: '#e74c3c', declining: '#ff9f43', critical: '#e74c3c',
  falling: '#ff9f43', unknown: '#666',
};

const STATE_ICONS: Record<string, string> = {
  energy: '⚡', glycemic_stability: '📈', concentration: '🧠', hunger: '🍽️', recovery: '💪',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ff6b6b', medium: '#ffd93d', low: '#00d4ff',
};

export default function BodyStateScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBodyState = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/body-state`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('Body state fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBodyState(); }, [fetchBodyState]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00d4ff" />
          <Text style={styles.loadingText}>Analyzing body state...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const bodyState = data?.body_state || {};
  const decisions = data?.decisions || [];
  const synergies = data?.synergies || [];
  const conflicts = data?.conflicts || [];
  const mealsCount = data?.meals_count || 0;
  const metabolicNote = data?.metabolic_note || '';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Body State</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); fetchBodyState(); }}>
          <Ionicons name="refresh" size={22} color="#00d4ff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBodyState(); }} tintColor="#00d4ff" />}>

        {/* ── Metabolic Note ── */}
        {metabolicNote && (
          <View style={[styles.noteCard, { backgroundColor: theme.card }]}>
            <Image source={require('../assets/jaide/jaide-cartoon.png')} style={styles.noteAvatar} />
            <View style={styles.noteContent}>
              <Text style={styles.noteLabel}>JAIDE OBSERVES</Text>
              <Text style={styles.noteText}>{metabolicNote}</Text>
            </View>
          </View>
        )}

        {/* ── Body State Indicators ── */}
        <Text style={styles.sectionTitle}>🧬 Body State</Text>
        <View style={styles.stateGrid}>
          {Object.entries(bodyState).map(([key, state]: [string, any]) => {
            if (!state || typeof state !== 'object') return null;
            const color = LEVEL_COLORS[state.level] || '#666';
            const score = state.score || 0;
            const icon = STATE_ICONS[key] || '📊';
            return (
              <View key={key} style={[styles.stateCard, { backgroundColor: theme.card }]}>
                <View style={styles.stateCardHeader}>
                  <Text style={styles.stateIcon}>{icon}</Text>
                  <View style={styles.stateRingContainer}>
                    <ScoreRing size={44} score={score} color={color} />
                    <Text style={[styles.stateScore, { color }]}>{score}</Text>
                  </View>
                </View>
                <Text style={styles.stateLabel}>{key.replace(/_/g, ' ')}</Text>
                <View style={[styles.levelBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
                  <Text style={[styles.levelText, { color }]}>{state.level?.toUpperCase()}</Text>
                </View>
                <Text style={styles.statePrediction}>{state.prediction}</Text>
                {key === 'hunger' && state.hours_until_hungry !== undefined && (
                  <Text style={styles.hungerTime}>~{state.hours_until_hungry}h until hungry</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Decision Engine ── */}
        <Text style={styles.sectionTitle}>🧠 Decision Engine</Text>
        <View style={styles.decisionsContainer}>
          {decisions.map((d: any, i: number) => (
            <View key={i} style={[styles.decisionCard, { backgroundColor: theme.card, borderLeftColor: PRIORITY_COLORS[d.priority] || '#00d4ff' }]}>
              <View style={styles.decisionHeader}>
                <Text style={styles.decisionIcon}>{d.icon || '💡'}</Text>
                <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLORS[d.priority] || '#00d4ff') + '20' }]}>
                  <Text style={[styles.priorityText, { color: PRIORITY_COLORS[d.priority] || '#00d4ff' }]}>
                    {d.priority?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.decisionAction}>{d.action}</Text>
              <Text style={styles.decisionReason}>{d.reason}</Text>
            </View>
          ))}
        </View>

        {/* ── Active Synergies ── */}
        {synergies.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>🔗 Active Nutrient Synergies</Text>
            {synergies.map((s: any, i: number) => (
              <View key={i} style={[styles.synergyCard, { backgroundColor: theme.card, borderLeftColor: s.color || '#4ecdc4' }]}>
                <View style={styles.synergyHeader}>
                  <Text style={styles.synergyIcon}>{s.icon}</Text>
                  <Text style={[styles.synergyEffect, { color: s.color }]}>{s.effect}</Text>
                  {s.strength > 0 && (
                    <View style={[styles.strengthBadge, { backgroundColor: s.color + '20' }]}>
                      <Text style={[styles.strengthText, { color: s.color }]}>{Math.round(s.strength * 100)}%</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.synergyExplanation}>{s.explanation}</Text>
                <Text style={styles.synergyExample}>e.g. {s.food_example}</Text>
              </View>
            ))}
          </>
        )}

        {/* ── Active Conflicts ── */}
        {conflicts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>⚠️ Nutrient Conflicts Detected</Text>
            {conflicts.map((c: any, i: number) => (
              <View key={i} style={[styles.conflictCard, { backgroundColor: theme.card }]}>
                <View style={styles.conflictHeader}>
                  <Text style={styles.conflictIcon}>{c.icon}</Text>
                  <Text style={styles.conflictEffect}>{c.effect}</Text>
                </View>
                <Text style={styles.conflictExplanation}>{c.explanation}</Text>
                <View style={styles.conflictAdvice}>
                  <Ionicons name="bulb" size={14} color="#ffd93d" />
                  <Text style={styles.conflictAdviceText}>{c.advice}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ── No Synergies/Conflicts Info ── */}
        {synergies.length === 0 && conflicts.length === 0 && mealsCount > 0 && (
          <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
            <Ionicons name="flask" size={32} color="#666" />
            <Text style={styles.emptyText}>No synergies or conflicts detected yet. Keep logging meals to unlock nutrient interactions.</Text>
          </View>
        )}

        {/* ── Meals Count ── */}
        <View style={[styles.footerCard, { backgroundColor: theme.card }]}>
          <Ionicons name="analytics" size={18} color="#888" />
          <Text style={styles.footerText}>Analysis based on {mealsCount} meal{mealsCount !== 1 ? 's' : ''} logged today</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#888', marginTop: 12, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16 },

  // Jaide Note
  noteCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.15)' },
  noteAvatar: { width: 44, height: 44, borderRadius: 22 },
  noteContent: { flex: 1, marginLeft: 12 },
  noteLabel: { fontSize: 10, fontWeight: '700', color: '#00d4ff', letterSpacing: 2, marginBottom: 4 },
  noteText: { fontSize: 14, color: '#c0c0dd', lineHeight: 20, fontStyle: 'italic' },

  // Section
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12, marginTop: 8 },

  // Body State Grid
  stateGrid: { gap: 10, marginBottom: 20 },
  stateCard: { borderRadius: 16, padding: 16 },
  stateCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  stateIcon: { fontSize: 28 },
  stateRingContainer: { position: 'relative', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stateScore: { position: 'absolute', fontSize: 13, fontWeight: 'bold' },
  stateLabel: { fontSize: 14, fontWeight: '600', color: '#fff', textTransform: 'capitalize', marginBottom: 6 },
  levelBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, marginBottom: 8 },
  levelText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  statePrediction: { fontSize: 13, color: '#999', lineHeight: 18 },
  hungerTime: { fontSize: 12, color: '#ffd93d', marginTop: 4, fontWeight: '600' },

  // Decision Engine
  decisionsContainer: { gap: 10, marginBottom: 20 },
  decisionCard: { borderRadius: 14, padding: 16, borderLeftWidth: 4 },
  decisionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  decisionIcon: { fontSize: 24 },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  priorityText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  decisionAction: { fontSize: 15, fontWeight: '600', color: '#fff', lineHeight: 22, marginBottom: 4 },
  decisionReason: { fontSize: 12, color: '#888', lineHeight: 16 },

  // Synergies
  synergyCard: { borderRadius: 14, padding: 16, marginBottom: 10, borderLeftWidth: 4 },
  synergyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  synergyIcon: { fontSize: 20 },
  synergyEffect: { fontSize: 14, fontWeight: '700', flex: 1 },
  strengthBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  strengthText: { fontSize: 11, fontWeight: '700' },
  synergyExplanation: { fontSize: 12, color: '#aaa', lineHeight: 16, marginBottom: 4 },
  synergyExample: { fontSize: 11, color: '#666', fontStyle: 'italic' },

  // Conflicts
  conflictCard: { borderRadius: 14, padding: 16, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#e74c3c' },
  conflictHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  conflictIcon: { fontSize: 20 },
  conflictEffect: { fontSize: 14, fontWeight: '700', color: '#e74c3c' },
  conflictExplanation: { fontSize: 12, color: '#aaa', lineHeight: 16, marginBottom: 8 },
  conflictAdvice: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(253, 203, 110, 0.1)', borderRadius: 10, padding: 10, gap: 8 },
  conflictAdviceText: { fontSize: 12, color: '#ffd93d', flex: 1, lineHeight: 16 },

  // Empty / Footer
  emptyCard: { borderRadius: 14, padding: 24, alignItems: 'center', marginVertical: 12 },
  emptyText: { color: '#888', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  footerCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginTop: 12, gap: 8 },
  footerText: { color: '#888', fontSize: 12 },
});
