import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../LanguageContext';
import { useTheme, ThemeColors } from '../ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface NutrientItem {
  nutrient: string;
  key: string;
  current: number;
  target: number;
  unit: string;
  status: 'critical' | 'low' | 'moderate' | 'optimized';
  percentage: number;
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

function getStatus(pct: number): NutrientItem['status'] {
  if (pct >= 80) return 'optimized';
  if (pct >= 50) return 'moderate';
  if (pct >= 25) return 'low';
  return 'critical';
}

function getStatusLabel(status: NutrientItem['status'], t: (k: string) => string): string {
  switch (status) {
    case 'optimized': return t('gap_optimized');
    case 'moderate': return t('gap_moderate');
    case 'low': return t('gap_low');
    case 'critical': return t('gap_critical');
  }
}

function getStatusColor(status: NutrientItem['status'], theme: ThemeColors): string {
  switch (status) {
    case 'optimized': return theme.success;
    case 'moderate': return theme.warning;
    case 'low': return '#ff9f43';
    case 'critical': return theme.danger;
  }
}

function getStatusIcon(status: NutrientItem['status']): string {
  switch (status) {
    case 'optimized': return 'checkmark-circle';
    case 'moderate': return 'trending-up';
    case 'low': return 'alert-circle';
    case 'critical': return 'warning';
  }
}

function SmartGapCard({ item, index }: { item: NutrientItem; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const statusColor = getStatusColor(item.status, theme);
  const statusLabel = getStatusLabel(item.status, t);
  const statusIcon = getStatusIcon(item.status);
  const isOptimized = item.status === 'optimized';
  const needed = Math.max(0, Math.round(item.target - item.current));

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }).start();
  }, []);

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
        style={[
          { backgroundColor: theme.bgSecondary, borderRadius: 14, padding: 14, borderWidth: 1 },
          isOptimized
            ? { borderColor: `${theme.success}25` }
            : item.status === 'critical'
              ? { borderColor: 'rgba(255,59,48,0.15)' }
              : { borderColor: theme.border },
          expanded && { borderColor: `${item.color}30` }
        ]}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        {/* Main Row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: item.color + '15' }}>
            <Ionicons name={item.icon as any} size={18} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>{item.nutrient}</Text>
              <View style={{ backgroundColor: statusColor + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: statusColor, letterSpacing: 0.5 }}>
                  {statusLabel.toUpperCase()}
                </Text>
              </View>
            </View>
            {/* Progress Bar */}
            <View style={{ height: 5, backgroundColor: theme.bgInput, borderRadius: 3, overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: '100%',
                  borderRadius: 3,
                  width: `${Math.min(item.percentage, 100)}%`,
                  backgroundColor: isOptimized ? theme.success : item.color,
                }}
              />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 48 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name={statusIcon as any} size={14} color={statusColor} />
              <Text style={{ fontSize: 16, fontWeight: '900', color: isOptimized ? theme.success : item.color }}>{item.percentage}%</Text>
            </View>
            <Text style={{ fontSize: 10, color: theme.textDim, marginTop: 2 }}>
              {Math.round(item.current)}/{item.target}{item.unit}
            </Text>
          </View>
          <View style={{ width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: expanded ? item.color + '20' : theme.border }}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={expanded ? item.color : theme.textDim} />
          </View>
        </View>

        {/* Collapsed hint */}
        {!expanded && !isOptimized && (
          <Text style={{ fontSize: 11, color: theme.textDim, marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
            {t('gap_tap_tips')} — {t('gap_need')} {needed}{item.unit} {t('gap_more')}
          </Text>
        )}
        {!expanded && isOptimized && (
          <Text style={{ fontSize: 11, color: theme.success, marginTop: 8, textAlign: 'center', fontWeight: '500' }}>
            {t('gap_goal_reached')}
          </Text>
        )}

        {/* Expanded details */}
        {expanded && (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.border }}>
            {/* Tip */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: isOptimized ? theme.success : item.color, marginBottom: 14 }}>
              <Ionicons name="bulb" size={14} color={isOptimized ? theme.success : item.color} />
              <Text style={{ fontSize: 13, color: theme.textSecondary, flex: 1, lineHeight: 18 }}>
                {isOptimized ? t('gap_keep_it_up') : item.tip}
              </Text>
            </View>

            {/* Remaining needed */}
            {!isOptimized && (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, color: theme.textDim }}>{t('gap_still_need')}</Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: item.color }}>{needed}{item.unit}</Text>
                <Text style={{ fontSize: 12, color: theme.textDim }}>{t('gap_today')}</Text>
              </View>
            )}

            {isOptimized && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14, backgroundColor: `${theme.success}0c`, paddingVertical: 10, borderRadius: 10 }}>
                <Ionicons name="checkmark-done-circle" size={22} color={theme.success} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.success }}>{t('gap_daily_target_met')}</Text>
              </View>
            )}

            {/* Recommended foods */}
            <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '600', marginBottom: 8 }}>
              <Ionicons name="restaurant" size={12} color={isOptimized ? theme.success : item.color} /> {isOptimized ? t('gap_good_sources') : t('gap_recommended_foods')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {item.foods.map((food, i) => (
                <TouchableOpacity
                  key={i}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                    borderWidth: 1, borderColor: (isOptimized ? theme.success : item.color) + '30',
                    backgroundColor: (isOptimized ? theme.success : item.color) + '08'
                  }}
                  onPress={() => searchFood(food)}
                >
                  <Ionicons name="search" size={11} color={isOptimized ? theme.success : item.color} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isOptimized ? theme.success : item.color }}>{food}</Text>
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
  const { theme } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'gaps' | 'optimized'>('all');

  const allItems: NutrientItem[] = Object.entries(NUTRIENT_TARGETS)
    .map(([key, target]) => {
      const current = nutrients[key] || 0;
      const pct = target.target > 0 ? Math.min(Math.round((current / target.target) * 100), 100) : 0;
      const status = getStatus(pct);
      const displayName = key.replace('_g', ' (g)').replace('_mg', ' (mg)').replace('_', ' ')
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        nutrient: displayName, key, current, target: target.target, unit: target.unit,
        status, percentage: pct, icon: target.icon, color: target.color,
        foods: target.foods, tip: target.tip
      };
    })
    .sort((a, b) => a.percentage - b.percentage);

  const filteredItems = filter === 'all'
    ? allItems
    : filter === 'gaps'
      ? allItems.filter(i => i.status !== 'optimized')
      : allItems.filter(i => i.status === 'optimized');

  const optimizedCount = allItems.filter(i => i.status === 'optimized').length;
  const criticalCount = allItems.filter(i => i.status === 'critical').length;
  const gapCount = allItems.filter(i => i.status !== 'optimized').length;
  const overallPct = allItems.length > 0
    ? Math.round(allItems.reduce((s, i) => s + i.percentage, 0) / allItems.length)
    : 0;

  const displayed = showAll ? filteredItems : filteredItems.slice(0, 4);
  const hasMore = filteredItems.length > 4 && !showAll;

  const FILTER_TABS = [
    { key: 'all' as const, label: t('gap_all'), count: allItems.length },
    { key: 'gaps' as const, label: t('gap_needs_work'), count: gapCount },
    { key: 'optimized' as const, label: t('gap_optimized'), count: optimizedCount },
  ];

  return (
    <View style={{ gap: 8 }}>
      {/* Overall Summary Bar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: theme.bgSecondary, borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: theme.border, marginBottom: 4
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: overallPct >= 70 ? `${theme.success}15` : overallPct >= 40 ? `${theme.warning}15` : `${theme.danger}15` }}>
            <Text style={{ fontSize: 14, fontWeight: '900', color: overallPct >= 70 ? theme.success : overallPct >= 40 ? theme.warning : theme.danger }}>{overallPct}%</Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{t('gap_overall_nutrition')}</Text>
            <Text style={{ fontSize: 11, color: theme.textDim }}>
              {optimizedCount}/{allItems.length} {t('gap_targets_met')}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {criticalCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,59,48,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Ionicons name="warning" size={12} color={theme.danger} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.danger }}>{criticalCount}</Text>
            </View>
          )}
          {optimizedCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${theme.success}10`, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Ionicons name="checkmark-circle" size={12} color={theme.success} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.success }}>{optimizedCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFilter(tab.key); setShowAll(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
              backgroundColor: filter === tab.key ? theme.accent : theme.bgInput,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: filter === tab.key ? '#fff' : theme.textMuted }}>
              {tab.label}
            </Text>
            <View style={{
              backgroundColor: filter === tab.key ? 'rgba(255,255,255,0.2)' : theme.border,
              paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6
            }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: filter === tab.key ? '#fff' : theme.textDim }}>{tab.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Nutrient Cards */}
      {filteredItems.length === 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${theme.success}0f`, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: `${theme.success}1a` }}>
          <Ionicons name="checkmark-circle" size={28} color={theme.success} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.success }}>
            {filter === 'gaps' ? t('gap_all_optimized') : t('gap_log_more')}
          </Text>
        </View>
      ) : (
        displayed.map((item, i) => <SmartGapCard key={item.key} item={item} index={i} />)
      )}

      {/* Show more / less */}
      {hasMore && (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 }}
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowAll(true); }}
        >
          <Text style={{ fontSize: 13, color: theme.accent, fontWeight: '600' }}>
            {t('gap_show_all')} ({filteredItems.length})
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.accent} />
        </TouchableOpacity>
      )}
      {showAll && filteredItems.length > 4 && (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 }}
          onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowAll(false); }}
        >
          <Text style={{ fontSize: 13, color: theme.accent, fontWeight: '600' }}>{t('gap_show_less')}</Text>
          <Ionicons name="chevron-up" size={16} color={theme.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}
