import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../LanguageContext';

interface NutrientGap {
  nutrient: string;
  current: number;
  target: number;
  unit: string;
  severity: 'critical' | 'low' | 'ok';
  icon: string;
  color: string;
  foods: string[];
}

const NUTRIENT_TARGETS: Record<string, { target: number; unit: string; icon: string; color: string; foods: string[] }> = {
  protein_g: { target: 50, unit: 'g', icon: 'barbell', color: '#ff6b6b', foods: ['Chicken', 'Eggs', 'Greek Yogurt', 'Lentils', 'Tofu'] },
  fiber_g: { target: 25, unit: 'g', icon: 'leaf', color: '#00ff88', foods: ['Oats', 'Broccoli', 'Chia Seeds', 'Beans', 'Apples'] },
  calcium_mg: { target: 1000, unit: 'mg', icon: 'fitness', color: '#00d4ff', foods: ['Milk', 'Cheese', 'Kale', 'Sardines', 'Almonds'] },
  iron_mg: { target: 18, unit: 'mg', icon: 'water', color: '#ff9f43', foods: ['Spinach', 'Red Meat', 'Lentils', 'Pumpkin Seeds', 'Quinoa'] },
  vitamin_c_mg: { target: 90, unit: 'mg', icon: 'sunny', color: '#ffd93d', foods: ['Oranges', 'Strawberries', 'Bell Peppers', 'Kiwi', 'Broccoli'] },
  potassium_mg: { target: 4700, unit: 'mg', icon: 'flash', color: '#a29bfe', foods: ['Bananas', 'Potatoes', 'Avocados', 'Spinach', 'Coconut Water'] },
  magnesium_mg: { target: 400, unit: 'mg', icon: 'diamond', color: '#fd79a8', foods: ['Dark Chocolate', 'Almonds', 'Avocado', 'Spinach', 'Pumpkin Seeds'] },
  zinc_mg: { target: 11, unit: 'mg', icon: 'shield', color: '#6c5ce7', foods: ['Oysters', 'Beef', 'Chickpeas', 'Pumpkin Seeds', 'Cashews'] },
};

function GapCard({ gap, index }: { gap: NutrientGap; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, []);

  const pct = gap.target > 0 ? Math.round((gap.current / gap.target) * 100) : 0;
  const isCritical = gap.severity === 'critical';

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={[styles.gapCard, isCritical && styles.gapCardCritical]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.gapHeader}>
          <View style={[styles.gapIconCircle, { backgroundColor: gap.color + '15' }]}>
            <Ionicons name={gap.icon as any} size={18} color={gap.color} />
          </View>
          <View style={styles.gapInfo}>
            <Text style={styles.gapName}>{gap.nutrient}</Text>
            <View style={styles.gapProgressTrack}>
              <View style={[styles.gapProgressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: gap.color }]} />
            </View>
          </View>
          <View style={styles.gapStats}>
            <Text style={[styles.gapPct, { color: gap.color }]}>{pct}%</Text>
            <Text style={styles.gapValues}>{Math.round(gap.current)}/{gap.target}{gap.unit}</Text>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#555" />
        </View>

        {expanded && (
          <View style={styles.gapExpanded}>
            <Text style={styles.gapExpandedTitle}>
              <Ionicons name="restaurant" size={12} color={gap.color} /> Try these foods:
            </Text>
            <View style={styles.foodChips}>
              {gap.foods.map((food, i) => (
                <View key={i} style={[styles.foodChip, { borderColor: gap.color + '25' }]}>
                  <Text style={[styles.foodChipText, { color: gap.color }]}>{food}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function NutrientGapAlerts({ nutrients }: { nutrients: Record<string, number> }) {
  const { t } = useLanguage();

  // Compute gaps
  const gaps: NutrientGap[] = Object.entries(NUTRIENT_TARGETS)
    .map(([key, target]) => {
      const current = nutrients[key] || 0;
      const pct = target.target > 0 ? current / target.target : 0;
      const severity: NutrientGap['severity'] = pct < 0.3 ? 'critical' : pct < 0.7 ? 'low' : 'ok';
      const displayName = key.replace('_g', ' (g)').replace('_mg', ' (mg)').replace('_', ' ')
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        nutrient: displayName,
        current,
        target: target.target,
        unit: target.unit,
        severity,
        icon: target.icon,
        color: target.color,
        foods: target.foods,
      };
    })
    .filter(g => g.severity !== 'ok')
    .sort((a, b) => (a.current / a.target) - (b.current / b.target));

  if (gaps.length === 0) {
    return (
      <View style={styles.allGoodCard}>
        <Ionicons name="checkmark-circle" size={28} color="#00ff88" />
        <Text style={styles.allGoodText}>{t('dash_no_gaps')}</Text>
      </View>
    );
  }

  const criticalCount = gaps.filter(g => g.severity === 'critical').length;

  return (
    <View style={styles.container}>
      {/* Summary badge */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryBadge, criticalCount > 0 ? styles.summaryBadgeCritical : styles.summaryBadgeWarn]}>
          <Ionicons name={criticalCount > 0 ? 'warning' : 'alert-circle'} size={14} color={criticalCount > 0 ? '#ff3b30' : '#ffb300'} />
          <Text style={[styles.summaryText, { color: criticalCount > 0 ? '#ff3b30' : '#ffb300' }]}>
            {gaps.length} {t('dash_gaps_found')}
          </Text>
        </View>
      </View>

      {/* Gap cards */}
      {gaps.slice(0, 5).map((gap, i) => (
        <GapCard key={gap.nutrient} gap={gap} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  // Summary
  summaryRow: { flexDirection: 'row', marginBottom: 4 },
  summaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  summaryBadgeCritical: { backgroundColor: 'rgba(255, 59, 48, 0.08)' },
  summaryBadgeWarn: { backgroundColor: 'rgba(255, 179, 0, 0.08)' },
  summaryText: { fontSize: 12, fontWeight: '700' },
  // Gap card
  gapCard: {
    backgroundColor: '#0d0d22',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  gapCardCritical: {
    borderColor: 'rgba(255, 59, 48, 0.15)',
  },
  gapHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  gapIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gapInfo: { flex: 1 },
  gapName: { fontSize: 13, fontWeight: '700', color: '#ccc', marginBottom: 6 },
  gapProgressTrack: { height: 4, backgroundColor: '#1a1a3e', borderRadius: 2, overflow: 'hidden' },
  gapProgressFill: { height: '100%', borderRadius: 2 },
  gapStats: { alignItems: 'flex-end' },
  gapPct: { fontSize: 16, fontWeight: '900' },
  gapValues: { fontSize: 10, color: '#555', marginTop: 2 },
  // Expanded
  gapExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  gapExpandedTitle: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 8 },
  foodChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  foodChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
  },
  foodChipText: { fontSize: 11, fontWeight: '600' },
  // All good
  allGoodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 255, 136, 0.06)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.1)',
  },
  allGoodText: { fontSize: 14, fontWeight: '600', color: '#00ff88' },
});
