import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator, Platform, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/ThemeContext';
import { useLanguage } from '../src/LanguageContext';
import Svg, { Circle } from 'react-native-svg';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface MetabolicData {
  user_profile: {
    weight_kg: number; height_cm: number; age: number; sex: string;
    activity_level: string; sleep_hours: number; diet_type: string;
    health_goals: string[]; primary_goal: string;
  };
  bmr: number;
  tdee: number;
  macros: {
    calories: number; calorie_adjustment: number;
    protein_g: number; protein_pct: number;
    carbs_g: number; carbs_pct: number;
    fat_g: number; fat_pct: number;
    priority_nutrients: string[];
  };
  hydration: { daily_target_ml: number; base_ml: number; activity_bonus_ml: number; sleep_adj_ml: number; };
  metabolic_identity: { primary: string; qualifiers: string[]; evolution_note: string; };
  meals_summary_7d: { avg_calories: number; avg_protein: number; days_logged: number; total_meals: number; };
  formula: string;
}

function ProgressRing({ size, strokeWidth, progress, color, label, value, trackColor, textColor, labelColor }: { size: number; strokeWidth: number; progress: number; color: string; label: string; value: string; trackColor: string; textColor: string; labelColor: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(progress, 1) * circumference);

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: textColor, fontSize: size * 0.18, fontWeight: 'bold' }}>{value}</Text>
      </View>
      <Text style={{ color: labelColor, fontSize: 11, marginTop: 4 }}>{label}</Text>
    </View>
  );
}

export default function MetabolicProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [data, setData] = useState<MetabolicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/metabolic/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Metabolic fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const onRefresh = () => { setRefreshing(true); fetchProfile(); };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={theme.accent} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 100 }}>Unable to load metabolic profile</Text>
      </SafeAreaView>
    );
  }

  const { bmr, tdee, macros, hydration, metabolic_identity, meals_summary_7d, user_profile } = data;
  const calProgress = meals_summary_7d.avg_calories > 0 ? meals_summary_7d.avg_calories / macros.calories : 0;
  const protProgress = meals_summary_7d.avg_protein > 0 ? meals_summary_7d.avg_protein / macros.protein_g : 0;

  const activityLabels: Record<string, string> = {
    sedentary: '🛋️ Sedentary', light: '🚶 Light', moderate: '🚴 Moderate', active: '🏋️ Active', very_active: '🔥 Very Active',
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Metabolic Profile</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}>
        {/* ── Metabolic Identity Card ── */}
        <View style={[styles.identityCard, { backgroundColor: theme.bgCard, borderColor: theme.accent + '26' }]}>
          <Image source={require('../assets/jaide/jaide-cartoon.png')} style={styles.identityAvatar} />
          <View style={styles.identityContent}>
            <Text style={[styles.identityLabel, { color: theme.accent }]}>METABOLIC IDENTITY</Text>
            <Text style={[styles.identityPrimary, { color: theme.text }]}>{metabolic_identity.primary}</Text>
            <View style={styles.qualifierRow}>
              {metabolic_identity.qualifiers.map((q, i) => (
                <View key={i} style={[styles.qualifierBadge, { backgroundColor: theme.accentGlow }]}>
                  <Text style={[styles.qualifierText, { color: theme.accent }]}>{q}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.evolutionNote, { color: theme.textMuted }]}>{metabolic_identity.evolution_note}</Text>
          </View>
        </View>

        {/* ── BMR & TDEE Card ── */}
        <View style={[styles.engineCard, { backgroundColor: theme.bgCard }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>⚡ Energy Engine</Text>
          <Text style={[styles.formulaTag, { color: theme.textMuted }]}>Mifflin-St Jeor</Text>
          <View style={styles.engineRow}>
            <View style={styles.engineBlock}>
              <Text style={[styles.engineValue, { color: theme.danger }]}>{Math.round(bmr)}</Text>
              <Text style={[styles.engineLabel, { color: theme.text }]}>BMR</Text>
              <Text style={[styles.engineSub, { color: theme.textMuted }]}>kcal at rest</Text>
            </View>
            <View style={[styles.engineDivider, { backgroundColor: theme.border }]} />
            <View style={styles.engineBlock}>
              <Text style={[styles.engineValue, { color: theme.accent }]}>{Math.round(tdee)}</Text>
              <Text style={[styles.engineLabel, { color: theme.text }]}>TDEE</Text>
              <Text style={[styles.engineSub, { color: theme.textMuted }]}>{activityLabels[user_profile.activity_level] || user_profile.activity_level}</Text>
            </View>
          </View>
          <View style={styles.profileMeta}>
            <Text style={[styles.metaText, { color: theme.textMuted }]}>{user_profile.sex === 'female' ? '♀' : '♂'} {user_profile.age}y · {user_profile.height_cm}cm · {user_profile.weight_kg}kg · {user_profile.sleep_hours}h sleep</Text>
          </View>
        </View>

        {/* ── Macro Targets ── */}
        <View style={[styles.macroCard, { backgroundColor: theme.bgCard }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>🎯 Daily Macro Targets</Text>
          {macros.calorie_adjustment !== 0 && (
            <Text style={[styles.adjTag, { color: theme.warning }]}>
              {macros.calorie_adjustment > 0 ? `+${macros.calorie_adjustment}` : macros.calorie_adjustment} kcal ({macros.calorie_adjustment > 0 ? 'surplus' : 'deficit'})
            </Text>
          )}
          <View style={styles.ringsRow}>
            <ProgressRing size={90} strokeWidth={8} progress={calProgress} color="#ff6b6b" label="Calories" value={`${macros.calories}`} trackColor={theme.border} textColor={theme.text} labelColor={theme.textMuted} />
            <ProgressRing size={90} strokeWidth={8} progress={protProgress} color={theme.purple} label="Protein" value={`${macros.protein_g}g`} trackColor={theme.border} textColor={theme.text} labelColor={theme.textMuted} />
            <ProgressRing size={90} strokeWidth={8} progress={0.5} color={theme.teal} label="Carbs" value={`${macros.carbs_g}g`} trackColor={theme.border} textColor={theme.text} labelColor={theme.textMuted} />
          </View>

          <View style={styles.macroBreakdown}>
            {[
              { label: 'Protein', g: macros.protein_g, pct: macros.protein_pct, color: theme.purple },
              { label: 'Carbs', g: macros.carbs_g, pct: macros.carbs_pct, color: theme.teal },
              { label: 'Fat', g: macros.fat_g, pct: macros.fat_pct, color: theme.warning },
            ].map((m) => (
              <View key={m.label} style={styles.macroRow}>
                <View style={[styles.macroDot, { backgroundColor: m.color }]} />
                <Text style={[styles.macroLabel, { color: theme.textSecondary }]}>{m.label}</Text>
                <Text style={[styles.macroGrams, { color: theme.text }]}>{m.g}g</Text>
                <View style={[styles.macroBarBg, { backgroundColor: theme.bgInput }]}>
                  <View style={[styles.macroBarFill, { width: `${m.pct}%`, backgroundColor: m.color }]} />
                </View>
                <Text style={[styles.macroPct, { color: theme.textMuted }]}>{m.pct}%</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Hydration Target ── */}
        <View style={[styles.hydrationCard, { backgroundColor: theme.bgCard }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>💧 Hydration Intelligence</Text>
          <View style={styles.hydrationMain}>
            <Text style={styles.hydrationValue}>{(hydration.daily_target_ml / 1000).toFixed(1)}L</Text>
            <Text style={[styles.hydrationSub, { color: theme.textMuted }]}>daily target</Text>
          </View>
          <View style={styles.hydrationBreakdown}>
            <View style={styles.hydrationItem}>
              <Text style={[styles.hydrationItemValue, { color: theme.text }]}>{(hydration.base_ml / 1000).toFixed(1)}L</Text>
              <Text style={[styles.hydrationItemLabel, { color: theme.textMuted }]}>Base ({user_profile.weight_kg}kg × 35ml)</Text>
            </View>
            {hydration.activity_bonus_ml > 0 && (
              <View style={styles.hydrationItem}>
                <Text style={[styles.hydrationItemValue, { color: theme.accent }]}>+{hydration.activity_bonus_ml}ml</Text>
                <Text style={[styles.hydrationItemLabel, { color: theme.textMuted }]}>Activity bonus</Text>
              </View>
            )}
            {hydration.sleep_adj_ml > 0 && (
              <View style={styles.hydrationItem}>
                <Text style={[styles.hydrationItemValue, { color: theme.purple }]}>+{hydration.sleep_adj_ml}ml</Text>
                <Text style={[styles.hydrationItemLabel, { color: theme.textMuted }]}>Sleep deficit adj.</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── 7-Day Summary ── */}
        <View style={[styles.summaryCard, { backgroundColor: theme.bgCard }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>📊 7-Day Average</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{meals_summary_7d.avg_calories}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Avg Calories</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{meals_summary_7d.avg_protein}g</Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Avg Protein</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{meals_summary_7d.days_logged}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Days Logged</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.text }]}>{meals_summary_7d.total_meals}</Text>
              <Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Total Meals</Text>
            </View>
          </View>
        </View>

        {/* ── Priority Nutrients ── */}
        {macros.priority_nutrients.length > 0 && (
          <View style={[styles.priorityCard, { backgroundColor: theme.bgCard }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>🔬 Priority Nutrients for "{user_profile.primary_goal.replace(/_/g, ' ')}"</Text>
            <View style={styles.nutrientChips}>
              {macros.priority_nutrients.map((n, i) => (
                <View key={i} style={[styles.nutrientChip, { backgroundColor: theme.accentGlow, borderColor: theme.accent + '33' }]}>
                  <Text style={[styles.nutrientChipText, { color: theme.accent }]}>{n.replace(/_/g, ' ').replace(/ (mg|mcg|g)$/, '')}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: 16 },

  // Identity Card
  identityCard: { borderRadius: 20, padding: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  identityAvatar: { width: 64, height: 64, borderRadius: 32 },
  identityContent: { flex: 1, marginLeft: 16 },
  identityLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  identityPrimary: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  qualifierRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 6 },
  qualifierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  qualifierText: { fontSize: 11, fontWeight: '600' },
  evolutionNote: { fontSize: 12, marginTop: 8, fontStyle: 'italic', lineHeight: 16 },

  // Engine Card
  engineCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  formulaTag: { fontSize: 11, marginBottom: 16 },
  engineRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  engineBlock: { alignItems: 'center' },
  engineValue: { fontSize: 36, fontWeight: 'bold' },
  engineLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  engineSub: { fontSize: 11, marginTop: 2 },
  engineDivider: { width: 1, height: 60 },
  profileMeta: { marginTop: 16, alignItems: 'center' },
  metaText: { fontSize: 12 },

  // Macro Card
  macroCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  adjTag: { fontSize: 12, marginBottom: 12 },
  ringsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  macroBreakdown: { gap: 10 },
  macroRow: { flexDirection: 'row', alignItems: 'center' },
  macroDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  macroLabel: { width: 60, fontSize: 13 },
  macroGrams: { width: 50, fontSize: 13, fontWeight: '600' },
  macroBarBg: { flex: 1, height: 6, borderRadius: 3, marginHorizontal: 8 },
  macroBarFill: { height: 6, borderRadius: 3 },
  macroPct: { width: 35, fontSize: 12, textAlign: 'right' },

  // Hydration
  hydrationCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  hydrationMain: { alignItems: 'center', marginVertical: 12 },
  hydrationValue: { fontSize: 42, fontWeight: 'bold', color: '#00b4d8' },
  hydrationSub: { fontSize: 13, marginTop: 2 },
  hydrationBreakdown: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  hydrationItem: { alignItems: 'center' },
  hydrationItemValue: { fontSize: 16, fontWeight: '700' },
  hydrationItemLabel: { fontSize: 11, marginTop: 2 },

  // Summary
  summaryCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: 'bold' },
  summaryLabel: { fontSize: 11, marginTop: 4 },

  // Priority Nutrients
  priorityCard: { borderRadius: 20, padding: 20, marginBottom: 16 },
  nutrientChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  nutrientChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  nutrientChipText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
});
