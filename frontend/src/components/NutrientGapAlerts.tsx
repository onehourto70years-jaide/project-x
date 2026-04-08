import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface NutrientGap { nutrient: string; key: string; current: number; target: number; unit: string; severity: 'critical' | 'low' | 'ok'; icon: string; color: string; foods: string[]; tip: string; }

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
  const { theme } = useTheme();
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }).start(); }, []);
  const pct = gap.target > 0 ? Math.round((gap.current / gap.target) * 100) : 0;
  const isCritical = gap.severity === 'critical';
  const needed = Math.max(0, Math.round(gap.target - gap.current));
  const toggleExpand = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(!expanded); };
  const searchFood = (food: string) => { router.push({ pathname: '/(tabs)/search', params: { q: food } }); };

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity
        style={[{ backgroundColor: theme.bgSecondary, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border }, isCritical && { borderColor: 'rgba(255,59,48,0.15)' }, expanded && { borderColor: `${theme.accent}24` }]}
        onPress={toggleExpand} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }, { backgroundColor: gap.color + '15' }]}>
            <Ionicons name={gap.icon as any} size={18} color={gap.color} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>{gap.nutrient}</Text>
              {isCritical && <View style={{ backgroundColor: 'rgba(255,59,48,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}><Text style={{ fontSize: 9, fontWeight: '800', color: '#ff3b30', letterSpacing: 0.5 }}>LOW</Text></View>}
            </View>
            <View style={{ height: 4, backgroundColor: theme.bgInput, borderRadius: 2, overflow: 'hidden' }}>
              <Animated.View style={{ height: '100%', borderRadius: 2, width: `${Math.min(pct, 100)}%`, backgroundColor: gap.color }} />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: gap.color }}>{pct}%</Text>
            <Text style={{ fontSize: 10, color: theme.textDim, marginTop: 2 }}>{Math.round(gap.current)}/{gap.target}{gap.unit}</Text>
          </View>
          <View style={[{ width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }, { backgroundColor: expanded ? gap.color + '20' : theme.border }]}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={expanded ? gap.color : theme.textDim} />
          </View>
        </View>
        {!expanded && <Text style={{ fontSize: 11, color: theme.textDim, marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>Tap for food suggestions — need {needed}{gap.unit} more</Text>}
        {expanded && (
          <View style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: gap.color, marginBottom: 14 }}>
              <Ionicons name="bulb" size={14} color={gap.color} />
              <Text style={{ fontSize: 13, color: theme.textSecondary, flex: 1, lineHeight: 18 }}>{gap.tip}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 14, justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, color: theme.textDim }}>You still need</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: gap.color }}>{needed}{gap.unit}</Text>
              <Text style={{ fontSize: 12, color: theme.textDim }}>today</Text>
            </View>
            <Text style={{ fontSize: 12, color: theme.textMuted, fontWeight: '600', marginBottom: 8 }}><Ionicons name="restaurant" size={12} color={gap.color} /> Recommended foods:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {gap.foods.map((food, i) => (
                <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: gap.color + '30', backgroundColor: gap.color + '08' }} onPress={() => searchFood(food)}>
                  <Ionicons name="search" size={11} color={gap.color} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: gap.color }}>{food}</Text>
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
  const gaps: NutrientGap[] = Object.entries(NUTRIENT_TARGETS)
    .map(([key, target]) => {
      const current = nutrients[key] || 0;
      const pct = target.target > 0 ? current / target.target : 0;
      const severity: NutrientGap['severity'] = pct < 0.3 ? 'critical' : pct < 0.7 ? 'low' : 'ok';
      const displayName = key.replace('_g', ' (g)').replace('_mg', ' (mg)').replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { nutrient: displayName, key, current, target: target.target, unit: target.unit, severity, icon: target.icon, color: target.color, foods: target.foods, tip: target.tip };
    })
    .filter(g => g.severity !== 'ok')
    .sort((a, b) => (a.current / a.target) - (b.current / b.target));

  if (gaps.length === 0) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: `${theme.success}0f`, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: `${theme.success}1a` }}>
        <Ionicons name="checkmark-circle" size={28} color={theme.success} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.success }}>{t('dash_no_gaps')}</Text>
      </View>
    );
  }

  const criticalCount = gaps.filter(g => g.severity === 'critical').length;
  const displayed = showAll ? gaps : gaps.slice(0, 3);
  const hasMore = gaps.length > 3 && !showAll;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: criticalCount > 0 ? 'rgba(255,59,48,0.08)' : 'rgba(255,179,0,0.08)' }}>
          <Ionicons name={criticalCount > 0 ? 'warning' : 'alert-circle'} size={14} color={criticalCount > 0 ? '#ff3b30' : '#ffb300'} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: criticalCount > 0 ? '#ff3b30' : '#ffb300' }}>{gaps.length} {t('dash_gaps_found')} {criticalCount > 0 ? `(${criticalCount} critical)` : ''}</Text>
        </View>
        <Text style={{ fontSize: 11, color: theme.textDim, fontStyle: 'italic' }}>Tap any gap for food tips</Text>
      </View>
      {displayed.map((gap, i) => <GapCard key={gap.key} gap={gap} index={i} />)}
      {hasMore && (
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowAll(true); }}>
          <Text style={{ fontSize: 13, color: theme.accent, fontWeight: '600' }}>Show all {gaps.length} gaps</Text>
          <Ionicons name="chevron-down" size={16} color={theme.accent} />
        </TouchableOpacity>
      )}
      {showAll && gaps.length > 3 && (
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 }} onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setShowAll(false); }}>
          <Text style={{ fontSize: 13, color: theme.accent, fontWeight: '600' }}>Show less</Text>
          <Ionicons name="chevron-up" size={16} color={theme.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}
