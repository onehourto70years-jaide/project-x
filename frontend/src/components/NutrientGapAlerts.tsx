import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../LanguageContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface NutrientGap {
  nutrient: string;
  key: string;
  current: number;
  target: number;
  unit: string;
  severity: 'critical' | 'low' | 'ok';
  icon: string;
  color: string;
  foods: string[];
  tip: string;
}

const NUTRIENT_TARGETS: Record<string, { target: number; unit: string; icon: string; color: string; foods: string[]; tip: string }> = {
  protein_g: { target: 50, unit: 'g', icon: 'barbell', color: '#ff6b6b', foods: ['Chicken Breast', 'Eggs', 'Greek Yogurt', 'Lentils', 'Tofu'], tip: 'Add a palm-sized protein to each meal' },
  fiber_g: { target: 25, unit: 'g', icon: 'leaf', color: '#00ff88', foods: ['Oats', 'Broccoli', 'Chia Seeds', 'Beans', 'Apples'], tip: 'Start breakfast with oats or add beans to lunch' },
  calcium_mg: { target: 1000, unit: 'mg', icon: 'fitness', color: '#00d4ff', foods: ['Milk', 'Cheese', 'Kale', 'Sardines', 'Almonds'], tip: 'A glass of milk + a serving of kale covers 50%' },
  iron_mg: { target: 18, unit: 'mg', icon: 'water', color: '#ff9f43', foods: ['Spinach', 'Red Meat', 'Lentils', 'Pumpkin Seeds', 'Quinoa'], tip: 'Pair iron-rich foods with vitamin C for 5x absorption' },
  vitamin_c_mg: { target: 90, unit: 'mg', icon: 'sunny', color: '#ffd93d', foods: ['Oranges', 'Strawberries', 'Bell Peppers', 'Kiwi', 'Broccoli'], tip: 'One bell pepper has 150% of your daily need' },
  potassium_mg: { target: 4700, unit: 'mg', icon: 'flash', color: '#a29bfe', foods: ['Bananas', 'Potatoes', 'Avocados', 'Spinach', 'Coconut Water'], tip: 'Avocados pack more potassium than bananas' },
  magnesium_mg: { target: 400, unit: 'mg', icon: 'diamond', color: '#fd79a8', foods: ['Dark Chocolate', 'Almonds', 'Avocado', 'Spinach', 'Pumpkin Seeds'], tip: 'A handful of almonds covers 20% of daily needs' },
  zinc_mg: { target: 11, unit: 'mg', icon: 'shield', color: '#6c5ce7', foods: ['Oysters', 'Beef', 'Chickpeas', 'Pumpkin Seeds', 'Cashews'], tip: 'Pumpkin seeds are a quick zinc-rich snack' },
};

function GapCard({ gap, index }: { gap: NutrientGap; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true,
    }).start();
  }, []);

  const pct = gap.target > 0 ? Math.round((gap.current / gap.target) * 100) : 0;
  const isCritical = gap.severity === 'critical';
  const needed = Math.max(0, Math.round(gap.target - gap.current));

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const searchFood = (food: string) => {
    router.push({ pathname: '/(tabs)/search', params: { q: food } });
  };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={[s.card, isCritical && s.cardCritical, expanded && s.cardExpanded]}
        onPress={toggleExpand}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${gap.nutrient}: ${pct}% of daily target. Tap for food suggestions.`}
        accessibilityHint="Double tap to expand and see recommended foods"
      >
        {/* Header row */}
        <View style={s.header}>
          <View style={[s.iconCircle, { backgroundColor: gap.color + '15' }]}>
            <Ionicons name={gap.icon as any} size={18} color={gap.color} />
          </View>
          <View style={s.info}>
            <View style={s.nameRow}>
              <Text style={s.name}>{gap.nutrient}</Text>
              {isCritical && (
                <View style={s.criticalBadge}>
                  <Text style={s.criticalText}>LOW</Text>
                </View>
              )}
            </View>
            <View style={s.progressTrack}>
              <Animated.View style={[s.progressFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: gap.color }]} />
            </View>
          </View>
          <View style={s.stats}>
            <Text style={[s.pct, { color: gap.color }]}>{pct}%</Text>
            <Text style={s.values}>{Math.round(gap.current)}/{gap.target}{gap.unit}</Text>
          </View>
          <View style={[s.chevronCircle, expanded && { backgroundColor: gap.color + '20' }]}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={expanded ? gap.color : '#555'} />
          </View>
        </View>

        {/* "Tap to see tips" hint when collapsed */}
        {!expanded && (
          <Text style={s.tapHint}>Tap for food suggestions — need {needed}{gap.unit} more</Text>
        )}

        {/* Expanded details */}
        {expanded && (
          <View style={s.expandedSection}>
            {/* Quick tip */}
            <View style={[s.tipRow, { borderLeftColor: gap.color }]}>
              <Ionicons name="bulb" size={14} color={gap.color} />
              <Text style={s.tipText}>{gap.tip}</Text>
            </View>

            {/* Needed amount */}
            <View style={s.neededRow}>
              <Text style={s.neededLabel}>You still need</Text>
              <Text style={[s.neededValue, { color: gap.color }]}>{needed}{gap.unit}</Text>
              <Text style={s.neededLabel}>today</Text>
            </View>

            {/* Food suggestions */}
            <Text style={s.foodsTitle}>
              <Ionicons name="restaurant" size={12} color={gap.color} /> Recommended foods:
            </Text>
            <View style={s.foodChips}>
              {gap.foods.map((food, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.foodChip, { borderColor: gap.color + '30', backgroundColor: gap.color + '08' }]}
                  onPress={() => searchFood(food)}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${food}`}
                >
                  <Ionicons name="search" size={11} color={gap.color} />
                  <Text style={[s.foodChipText, { color: gap.color }]}>{food}</Text>
                </TouchableOpacity>
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
  const [showAll, setShowAll] = useState(false);

  const gaps: NutrientGap[] = Object.entries(NUTRIENT_TARGETS)
    .map(([key, target]) => {
      const current = nutrients[key] || 0;
      const pct = target.target > 0 ? current / target.target : 0;
      const severity: NutrientGap['severity'] = pct < 0.3 ? 'critical' : pct < 0.7 ? 'low' : 'ok';
      const displayName = key.replace('_g', ' (g)').replace('_mg', ' (mg)').replace('_', ' ')
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        nutrient: displayName,
        key,
        current,
        target: target.target,
        unit: target.unit,
        severity,
        icon: target.icon,
        color: target.color,
        foods: target.foods,
        tip: target.tip,
      };
    })
    .filter(g => g.severity !== 'ok')
    .sort((a, b) => (a.current / a.target) - (b.current / b.target));

  if (gaps.length === 0) {
    return (
      <View style={s.allGood}>
        <Ionicons name="checkmark-circle" size={28} color="#00ff88" />
        <Text style={s.allGoodText}>{t('dash_no_gaps')}</Text>
      </View>
    );
  }

  const criticalCount = gaps.filter(g => g.severity === 'critical').length;
  const displayed = showAll ? gaps : gaps.slice(0, 3);
  const hasMore = gaps.length > 3 && !showAll;

  return (
    <View style={s.container}>
      {/* Summary badge */}
      <View style={s.summaryRow}>
        <View style={[s.summaryBadge, criticalCount > 0 ? s.summaryBadgeCrit : s.summaryBadgeWarn]}>
          <Ionicons name={criticalCount > 0 ? 'warning' : 'alert-circle'} size={14} color={criticalCount > 0 ? '#ff3b30' : '#ffb300'} />
          <Text style={[s.summaryText, { color: criticalCount > 0 ? '#ff3b30' : '#ffb300' }]}>
            {gaps.length} {t('dash_gaps_found')} {criticalCount > 0 ? `(${criticalCount} critical)` : ''}
          </Text>
        </View>
        <Text style={s.summaryHint}>Tap any gap for food tips</Text>
      </View>

      {/* Gap cards */}
      {displayed.map((gap, i) => (
        <GapCard key={gap.key} gap={gap} index={i} />
      ))}

      {/* Show more / less */}
      {hasMore && (
        <TouchableOpacity style={s.showMoreBtn} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowAll(true); }}>
          <Text style={s.showMoreText}>Show all {gaps.length} gaps</Text>
          <Ionicons name="chevron-down" size={16} color="#00d4ff" />
        </TouchableOpacity>
      )}
      {showAll && gaps.length > 3 && (
        <TouchableOpacity style={s.showMoreBtn} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowAll(false); }}>
          <Text style={s.showMoreText}>Show less</Text>
          <Ionicons name="chevron-up" size={16} color="#00d4ff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 8 },
  // Summary
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  summaryBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  summaryBadgeCrit: { backgroundColor: 'rgba(255, 59, 48, 0.08)' },
  summaryBadgeWarn: { backgroundColor: 'rgba(255, 179, 0, 0.08)' },
  summaryText: { fontSize: 12, fontWeight: '700' },
  summaryHint: { fontSize: 11, color: '#555', fontStyle: 'italic' },
  // Card
  card: {
    backgroundColor: '#0d0d22',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  cardCritical: { borderColor: 'rgba(255, 59, 48, 0.15)' },
  cardExpanded: { borderColor: 'rgba(0, 212, 255, 0.15)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  name: { fontSize: 13, fontWeight: '700', color: '#ccc' },
  criticalBadge: { backgroundColor: 'rgba(255,59,48,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  criticalText: { fontSize: 9, fontWeight: '800', color: '#ff3b30', letterSpacing: 0.5 },
  progressTrack: { height: 4, backgroundColor: '#1a1a3e', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  stats: { alignItems: 'flex-end' },
  pct: { fontSize: 16, fontWeight: '900' },
  values: { fontSize: 10, color: '#555', marginTop: 2 },
  chevronCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center' },
  // Tap hint
  tapHint: { fontSize: 11, color: '#444', marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  // Expanded
  expandedSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, borderLeftWidth: 3, marginBottom: 14 },
  tipText: { fontSize: 13, color: '#aaa', flex: 1, lineHeight: 18 },
  neededRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 14, justifyContent: 'center' },
  neededLabel: { fontSize: 12, color: '#666' },
  neededValue: { fontSize: 22, fontWeight: '900' },
  foodsTitle: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 8 },
  foodChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  foodChipText: { fontSize: 12, fontWeight: '600' },
  // Show more
  showMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  showMoreText: { fontSize: 13, color: '#00d4ff', fontWeight: '600' },
  // All good
  allGood: {
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
