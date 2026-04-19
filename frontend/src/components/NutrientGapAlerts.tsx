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
  category: string;
  foods: string[];
  tip: string;
}

// Complete nutrient targets based on adult daily recommended values
const NUTRIENT_TARGETS: Record<string, { target: number; unit: string; icon: string; color: string; category: string; foods: string[]; tip: string }> = {
  // ═══════ MACRONUTRIENTI ═══════
  protein_g: { target: 50, unit: 'g', icon: 'barbell', color: '#ff6b6b', category: 'macro', foods: ['Chicken', 'Eggs', 'Greek Yogurt', 'Lentils', 'Tofu'], tip: 'Add a palm-sized protein to each meal' },
  carbohydrate_g: { target: 275, unit: 'g', icon: 'flash', color: '#ffd93d', category: 'macro', foods: ['Rice', 'Pasta', 'Bread', 'Oats', 'Potatoes'], tip: 'Complex carbs provide sustained energy' },
  fat_g: { target: 65, unit: 'g', icon: 'water', color: '#fd79a8', category: 'macro', foods: ['Olive Oil', 'Avocado', 'Nuts', 'Seeds', 'Fish'], tip: 'Focus on healthy unsaturated fats' },
  fiber_g: { target: 25, unit: 'g', icon: 'leaf', color: '#00ff88', category: 'macro', foods: ['Oats', 'Broccoli', 'Chia Seeds', 'Beans', 'Apples'], tip: 'Start breakfast with oats or add beans to lunch' },
  water_g: { target: 2500, unit: 'g', icon: 'water', color: '#74b9ff', category: 'macro', foods: ['Water', 'Cucumber', 'Watermelon', 'Soups', 'Herbal Tea'], tip: '8 glasses of water = ~2L daily' },
  // ═══════ ZUCCHERI ═══════
  sugars_g: { target: 50, unit: 'g', icon: 'cafe', color: '#e17055', category: 'sugar', foods: ['Fruit', 'Honey', 'Maple Syrup'], tip: 'Limit added sugars; fruit sugars are better' },
  // ═══════ GRASSI DETTAGLIATI ═══════
  saturated_fat_g: { target: 20, unit: 'g', icon: 'alert-circle', color: '#d63031', category: 'fats', foods: ['Butter', 'Cheese', 'Coconut Oil'], tip: 'Keep saturated fats under 10% of calories' },
  monounsaturated_fat_g: { target: 25, unit: 'g', icon: 'heart', color: '#00b894', category: 'fats', foods: ['Olive Oil', 'Avocado', 'Almonds', 'Peanuts'], tip: 'Monounsaturated fats protect your heart' },
  polyunsaturated_fat_g: { target: 15, unit: 'g', icon: 'fish', color: '#0984e3', category: 'fats', foods: ['Salmon', 'Walnuts', 'Flaxseed', 'Sunflower Seeds'], tip: 'Include omega-3 and omega-6 sources' },
  trans_fat_g: { target: 2, unit: 'g', icon: 'close-circle', color: '#636e72', category: 'fats', foods: [], tip: 'Avoid trans fats — they increase heart disease risk' },
  cholesterol_mg: { target: 300, unit: 'mg', icon: 'analytics', color: '#e84393', category: 'fats', foods: ['Eggs', 'Shrimp', 'Liver'], tip: 'Most people can have 1-2 eggs daily safely' },
  // ═══════ MINERALI ═══════
  sodium_mg: { target: 2300, unit: 'mg', icon: 'cube', color: '#636e72', category: 'mineral', foods: ['Salt', 'Olives', 'Pickles', 'Soy Sauce'], tip: 'Too much sodium raises blood pressure — limit processed foods' },
  salt_g: { target: 5, unit: 'g', icon: 'cube', color: '#b2bec3', category: 'mineral', foods: ['Salt'], tip: 'WHO recommends less than 5g salt/day' },
  calcium_mg: { target: 1000, unit: 'mg', icon: 'fitness', color: '#00d4ff', category: 'mineral', foods: ['Milk', 'Cheese', 'Kale', 'Sardines', 'Almonds'], tip: 'A glass of milk + a serving of kale covers 50%' },
  iron_mg: { target: 18, unit: 'mg', icon: 'water', color: '#ff9f43', category: 'mineral', foods: ['Spinach', 'Red Meat', 'Lentils', 'Pumpkin Seeds', 'Quinoa'], tip: 'Pair iron-rich foods with vitamin C for 5x absorption' },
  magnesium_mg: { target: 400, unit: 'mg', icon: 'diamond', color: '#fd79a8', category: 'mineral', foods: ['Dark Chocolate', 'Almonds', 'Avocado', 'Spinach', 'Pumpkin Seeds'], tip: 'A handful of almonds covers 20% of daily needs' },
  phosphorus_mg: { target: 700, unit: 'mg', icon: 'flame', color: '#e17055', category: 'mineral', foods: ['Chicken', 'Fish', 'Dairy', 'Lentils', 'Sunflower Seeds'], tip: 'Most protein-rich foods provide phosphorus' },
  potassium_mg: { target: 4700, unit: 'mg', icon: 'flash', color: '#a29bfe', category: 'mineral', foods: ['Bananas', 'Potatoes', 'Avocados', 'Spinach', 'Coconut Water'], tip: 'Avocados pack more potassium than bananas' },
  zinc_mg: { target: 11, unit: 'mg', icon: 'shield', color: '#6c5ce7', category: 'mineral', foods: ['Oysters', 'Beef', 'Chickpeas', 'Pumpkin Seeds', 'Cashews'], tip: 'Pumpkin seeds are a quick zinc-rich snack' },
  copper_mg: { target: 0.9, unit: 'mg', icon: 'color-palette', color: '#e67e22', category: 'mineral', foods: ['Liver', 'Oysters', 'Dark Chocolate', 'Cashews', 'Mushrooms'], tip: 'Dark chocolate is a delicious copper source' },
  manganese_mg: { target: 2.3, unit: 'mg', icon: 'prism', color: '#2d3436', category: 'mineral', foods: ['Pecans', 'Oats', 'Brown Rice', 'Spinach', 'Pineapple'], tip: 'Whole grains and nuts are rich in manganese' },
  selenium_mcg: { target: 55, unit: 'µg', icon: 'globe', color: '#00cec9', category: 'mineral', foods: ['Brazil Nuts', 'Tuna', 'Eggs', 'Sunflower Seeds', 'Mushrooms'], tip: 'Just 1 Brazil nut covers your daily selenium' },
  fluoride_mcg: { target: 4000, unit: 'µg', icon: 'sparkles', color: '#81ecec', category: 'mineral', foods: ['Tea', 'Seafood', 'Tap Water'], tip: 'Fluoride supports strong teeth and bones' },
  choline_mg: { target: 550, unit: 'mg', icon: 'brain', color: '#fdcb6e', category: 'mineral', foods: ['Eggs', 'Liver', 'Soybeans', 'Salmon', 'Cauliflower'], tip: 'One egg provides about 150mg of choline' },
  // ═══════ VITAMINE ═══════
  vitamin_a_mcg: { target: 900, unit: 'µg', icon: 'eye', color: '#ff7675', category: 'vitamin', foods: ['Sweet Potato', 'Carrots', 'Spinach', 'Liver', 'Cantaloupe'], tip: 'Orange & dark green veggies are rich in Vitamin A' },
  vitamin_b1_mg: { target: 1.2, unit: 'mg', icon: 'battery-charging', color: '#ffeaa7', category: 'vitamin', foods: ['Pork', 'Sunflower Seeds', 'Lentils', 'Peas', 'Whole Grains'], tip: 'Thiamin helps convert food to energy' },
  vitamin_b2_mg: { target: 1.3, unit: 'mg', icon: 'sunny', color: '#fab1a0', category: 'vitamin', foods: ['Milk', 'Eggs', 'Almonds', 'Mushrooms', 'Spinach'], tip: 'Riboflavin supports energy and skin health' },
  vitamin_b3_mg: { target: 16, unit: 'mg', icon: 'pulse', color: '#e17055', category: 'vitamin', foods: ['Chicken', 'Tuna', 'Turkey', 'Mushrooms', 'Peanuts'], tip: 'Niacin supports metabolism and nervous system' },
  vitamin_b5_mg: { target: 5, unit: 'mg', icon: 'medkit', color: '#00b894', category: 'vitamin', foods: ['Avocado', 'Chicken', 'Mushrooms', 'Sunflower Seeds', 'Eggs'], tip: 'Pantothenic acid is found in nearly all foods' },
  vitamin_b6_mg: { target: 1.3, unit: 'mg', icon: 'trending-up', color: '#0984e3', category: 'vitamin', foods: ['Chickpeas', 'Banana', 'Potatoes', 'Tuna', 'Turkey'], tip: 'B6 supports brain function and immune health' },
  folate_mcg: { target: 400, unit: 'µg', icon: 'leaf', color: '#55efc4', category: 'vitamin', foods: ['Lentils', 'Spinach', 'Asparagus', 'Broccoli', 'Avocado'], tip: 'Folate is crucial for cell growth and DNA' },
  vitamin_b12_mcg: { target: 2.4, unit: 'µg', icon: 'nuclear', color: '#d63031', category: 'vitamin', foods: ['Clams', 'Liver', 'Tuna', 'Salmon', 'Fortified Cereals'], tip: 'B12 is mainly in animal foods — vegans need supplements' },
  vitamin_c_mg: { target: 90, unit: 'mg', icon: 'sunny', color: '#ffd93d', category: 'vitamin', foods: ['Oranges', 'Strawberries', 'Bell Peppers', 'Kiwi', 'Broccoli'], tip: 'One bell pepper has 150% of your daily need' },
  vitamin_d_mcg: { target: 15, unit: 'µg', icon: 'sunny', color: '#fdcb6e', category: 'vitamin', foods: ['Salmon', 'Fortified Milk', 'Egg Yolks', 'Mushrooms', 'Sunlight'], tip: '15 min of sunlight helps your body make vitamin D' },
  vitamin_e_mg: { target: 15, unit: 'mg', icon: 'shield-checkmark', color: '#00b894', category: 'vitamin', foods: ['Almonds', 'Sunflower Seeds', 'Spinach', 'Avocado', 'Olive Oil'], tip: 'A handful of almonds covers 50% of daily vitamin E' },
  vitamin_k_mcg: { target: 120, unit: 'µg', icon: 'bandage', color: '#2d3436', category: 'vitamin', foods: ['Kale', 'Spinach', 'Broccoli', 'Brussels Sprouts', 'Green Beans'], tip: 'Dark leafy greens are the best source of vitamin K' },
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
  const needed = Math.max(0, Math.round((item.target - item.current) * 10) / 10);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 50, useNativeDriver: true }).start();
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
          { backgroundColor: theme.bgSecondary, borderRadius: 14, padding: 12, borderWidth: 1 },
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: item.color + '15' }}>
            <Ionicons name={item.icon as any} size={16} color={item.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary }} numberOfLines={1}>{item.nutrient}</Text>
              <View style={{ backgroundColor: statusColor + '18', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ fontSize: 8, fontWeight: '800', color: statusColor, letterSpacing: 0.5 }}>
                  {statusLabel.toUpperCase()}
                </Text>
              </View>
            </View>
            {/* Progress Bar */}
            <View style={{ height: 4, backgroundColor: theme.bgInput, borderRadius: 2, overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: '100%',
                  borderRadius: 2,
                  width: `${Math.min(item.percentage, 100)}%`,
                  backgroundColor: isOptimized ? theme.success : item.color,
                }}
              />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 44 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name={statusIcon as any} size={12} color={statusColor} />
              <Text style={{ fontSize: 14, fontWeight: '900', color: isOptimized ? theme.success : item.color }}>{item.percentage}%</Text>
            </View>
            <Text style={{ fontSize: 9, color: theme.textDim, marginTop: 1 }}>
              {item.current < 10 ? item.current.toFixed(1) : Math.round(item.current)}/{item.target}{item.unit}
            </Text>
          </View>
          <View style={{ width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', backgroundColor: expanded ? item.color + '20' : 'transparent' }}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={expanded ? item.color : theme.textDim} />
          </View>
        </View>

        {/* Expanded details */}
        {expanded && (
          <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
            {/* Tip */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 8, borderLeftWidth: 3, borderLeftColor: isOptimized ? theme.success : item.color, marginBottom: 12 }}>
              <Ionicons name="bulb" size={13} color={isOptimized ? theme.success : item.color} />
              <Text style={{ fontSize: 12, color: theme.textSecondary, flex: 1, lineHeight: 17 }}>
                {isOptimized ? t('gap_keep_it_up') : item.tip}
              </Text>
            </View>

            {!isOptimized && (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginBottom: 12, justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, color: theme.textDim }}>{t('gap_still_need')}</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: item.color }}>{needed}{item.unit}</Text>
                <Text style={{ fontSize: 11, color: theme.textDim }}>{t('gap_today')}</Text>
              </View>
            )}

            {isOptimized && (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12, backgroundColor: `${theme.success}0c`, paddingVertical: 8, borderRadius: 10 }}>
                <Ionicons name="checkmark-done-circle" size={18} color={theme.success} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.success }}>{t('gap_daily_target_met')}</Text>
              </View>
            )}

            {/* Recommended foods */}
            {item.foods.length > 0 && (
              <>
                <Text style={{ fontSize: 11, color: theme.textMuted, fontWeight: '600', marginBottom: 6 }}>
                  <Ionicons name="restaurant" size={11} color={isOptimized ? theme.success : item.color} /> {isOptimized ? t('gap_good_sources') : t('gap_recommended_foods')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {item.foods.map((food, i) => (
                    <TouchableOpacity
                      key={i}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                        borderWidth: 1, borderColor: (isOptimized ? theme.success : item.color) + '30',
                        backgroundColor: (isOptimized ? theme.success : item.color) + '08'
                      }}
                      onPress={() => searchFood(food)}
                    >
                      <Ionicons name="search" size={10} color={isOptimized ? theme.success : item.color} />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: isOptimized ? theme.success : item.color }}>{food}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

type CategoryFilter = 'all' | 'macro' | 'vitamin' | 'mineral' | 'fats' | 'gaps' | 'optimized';

export default function NutrientGapAlerts({ nutrients }: { nutrients: Record<string, number> }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const allItems: NutrientItem[] = Object.entries(NUTRIENT_TARGETS)
    .map(([key, target]) => {
      const current = nutrients[key] || 0;
      const pct = target.target > 0 ? Math.min(Math.round((current / target.target) * 100), 100) : 0;
      const status = getStatus(pct);
      // Build display name from key
      const displayName = key
        .replace('vitamin_', 'Vit. ')
        .replace('saturated_fat_g', 'Saturated Fat (g)')
        .replace('monounsaturated_fat_g', 'Monounsat. Fat (g)')
        .replace('polyunsaturated_fat_g', 'Polyunsat. Fat (g)')
        .replace('trans_fat_g', 'Trans Fat (g)')
        .replace('cholesterol_mg', 'Cholesterol (mg)')
        .replace('folate_mcg', 'Folate/B9 (µg)')
        .replace('choline_mg', 'Choline (mg)')
        .replace('fluoride_mcg', 'Fluoride (µg)')
        .replace('salt_g', 'Salt (g)')
        .replace('sugars_g', 'Sugars (g)')
        .replace('water_g', 'Water (g)')
        .replace('alcohol_g', 'Alcohol (g)')
        .replace(/_g$/, ' (g)')
        .replace(/_mg$/, ' (mg)')
        .replace(/_mcg$/, ' (µg)')
        .replace(/_/g, ' ')
        .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return {
        nutrient: displayName, key, current, target: target.target, unit: target.unit,
        status, percentage: pct, icon: target.icon, color: target.color,
        category: target.category, foods: target.foods, tip: target.tip
      };
    })
    .sort((a, b) => a.percentage - b.percentage);

  const getFiltered = (): NutrientItem[] => {
    switch (filter) {
      case 'all': return allItems;
      case 'gaps': return allItems.filter(i => i.status !== 'optimized');
      case 'optimized': return allItems.filter(i => i.status === 'optimized');
      case 'macro': return allItems.filter(i => i.category === 'macro' || i.category === 'sugar');
      case 'vitamin': return allItems.filter(i => i.category === 'vitamin');
      case 'mineral': return allItems.filter(i => i.category === 'mineral');
      case 'fats': return allItems.filter(i => i.category === 'fats');
      default: return allItems;
    }
  };

  const filteredItems = getFiltered();
  const optimizedCount = allItems.filter(i => i.status === 'optimized').length;
  const criticalCount = allItems.filter(i => i.status === 'critical').length;
  const gapCount = allItems.filter(i => i.status !== 'optimized').length;
  const overallPct = allItems.length > 0
    ? Math.round(allItems.reduce((s, i) => s + i.percentage, 0) / allItems.length)
    : 0;

  const displayed = showAll ? filteredItems : filteredItems.slice(0, 5);
  const hasMore = filteredItems.length > 5 && !showAll;

  const FILTER_TABS: { key: CategoryFilter; label: string; count: number }[] = [
    { key: 'all', label: t('gap_all'), count: allItems.length },
    { key: 'gaps', label: t('gap_needs_work'), count: gapCount },
    { key: 'macro', label: t('gap_cat_macro'), count: allItems.filter(i => i.category === 'macro' || i.category === 'sugar').length },
    { key: 'vitamin', label: t('gap_cat_vitamins'), count: allItems.filter(i => i.category === 'vitamin').length },
    { key: 'mineral', label: t('gap_cat_minerals'), count: allItems.filter(i => i.category === 'mineral').length },
    { key: 'fats', label: t('gap_cat_fats'), count: allItems.filter(i => i.category === 'fats').length },
    { key: 'optimized', label: '✓', count: optimizedCount },
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
            <Text style={{ fontSize: 13, fontWeight: '900', color: overallPct >= 70 ? theme.success : overallPct >= 40 ? theme.warning : theme.danger }}>{overallPct}%</Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.text }}>{t('gap_overall_nutrition')}</Text>
            <Text style={{ fontSize: 11, color: theme.textDim }}>
              {optimizedCount}/{allItems.length} {t('gap_targets_met')}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {criticalCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,59,48,0.08)', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
              <Ionicons name="warning" size={11} color={theme.danger} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.danger }}>{criticalCount}</Text>
            </View>
          )}
          {optimizedCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: `${theme.success}10`, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
              <Ionicons name="checkmark-circle" size={11} color={theme.success} />
              <Text style={{ fontSize: 10, fontWeight: '700', color: theme.success }}>{optimizedCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filter Tabs - Scrollable */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 4 }}>
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFilter(tab.key); setShowAll(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
              backgroundColor: filter === tab.key ? theme.accent : theme.bgInput,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: filter === tab.key ? '#fff' : theme.textMuted }}>
              {tab.label}
            </Text>
            <View style={{
              backgroundColor: filter === tab.key ? 'rgba(255,255,255,0.2)' : theme.border,
              paddingHorizontal: 4, paddingVertical: 0, borderRadius: 5
            }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: filter === tab.key ? '#fff' : theme.textDim }}>{tab.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Nutrient Cards */}
      {filteredItems.length === 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${theme.success}0f`, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: `${theme.success}1a` }}>
          <Ionicons name="checkmark-circle" size={24} color={theme.success} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.success }}>
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
      {showAll && filteredItems.length > 5 && (
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
