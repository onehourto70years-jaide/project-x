import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, Animated, Dimensions, Modal, TextInput, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../_layout';
import { useLanguage } from '../../src/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { cachedFetch, CacheKeys, CacheTTL, clearCacheForKey } from '../../src/cache';
import AnimatedElements from '../../src/components/AnimatedElements';
import StreakSection from '../../src/components/StreakSection';
import EmptyState from '../../src/components/EmptyState';
import NutrientGapAlerts from '../../src/components/NutrientGapAlerts';
import { useMatrix } from '../../src/MatrixContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Progress Ring Component ─────────────────────────
function ProgressRing({ size, strokeWidth, progress, colors, label, value, unit, icon }: {
  size: number; strokeWidth: number; progress: number; colors: string[];
  label: string; value: string; unit: string; icon: string;
}) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: clampedProgress,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress]);

  const strokeDashoffset = circumference - (circumference * clampedProgress) / 100;
  const gradientId = `grad-${label.replace(/\s/g, '')}`;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors[0]} />
              <Stop offset="100%" stopColor={colors[1] || colors[0]} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            rotation="-90" origin={`${size / 2}, ${size / 2}`} />
        </Svg>
        <View style={{ alignItems: 'center' }}>
          <Ionicons name={icon as any} size={size > 100 ? 22 : 16} color={colors[0]} />
          <Text style={[styles.ringValue, { fontSize: size > 100 ? 20 : 14 }]}>{value}</Text>
          <Text style={[styles.ringUnit, { fontSize: size > 100 ? 11 : 9 }]}>{unit}</Text>
        </View>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

// ─── (ElementCard moved to src/components/AnimatedElements.tsx) ──

// ─── Health Score ─────────────────────────────────────
function HealthScore({ score }: { score: number }) {
  const { t } = useLanguage();
  const getGrade = () => {
    if (score >= 90) return { grade: 'A+', color: '#00ff88', msg: t('dash_outstanding') };
    if (score >= 80) return { grade: 'A', color: '#00d4ff', msg: t('dash_excellent') };
    if (score >= 70) return { grade: 'B+', color: '#4ecdc4', msg: t('dash_great') };
    if (score >= 60) return { grade: 'B', color: '#ffd93d', msg: t('dash_good_progress') };
    if (score >= 40) return { grade: 'C', color: '#ff9f43', msg: t('dash_keep_going') };
    return { grade: 'D', color: '#ff6b6b', msg: t('dash_start_tracking') };
  };
  const { grade, color, msg } = getGrade();
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.scoreContainer}>
      <Animated.View style={[styles.scoreGlow, { backgroundColor: color + '20', opacity: pulseAnim }]} />
      <ProgressRing size={130} strokeWidth={8} progress={score} colors={[color, color + 'aa']} label="" value={grade} unit={msg} icon="shield-checkmark" />
      <Text style={[styles.scoreLabel, { color }]}>{t('dash_score')}</Text>
    </View>
  );
}

// ─── Main Dashboard ──────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { matrixEnabled, setPriorityElements, setAdaptiveColor, adaptiveColor } = useMatrix();
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [showQuickMeal, setShowQuickMeal] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<any>(null);
  const [portionAmount, setPortionAmount] = useState('100');
  const [portionUnit, setPortionUnit] = useState<'g' | 'ml'>('g');
  const [cookingMethod, setCookingMethod] = useState('raw');
  const [logging, setLogging] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);

  const fetchDashboard = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const authHeaders = { 'Authorization': `Bearer ${token}` };

      // Dashboard data — cached
      const dashResult = await cachedFetch(
        CacheKeys.dashboard,
        async () => {
          const res = await fetch(`${BACKEND_URL}/api/dashboard`, { headers: authHeaders });
          if (!res.ok) throw new Error('dashboard fetch failed');
          return res.json();
        },
        CacheTTL.SHORT,
      );

      setDashboard(dashResult.data);
      setIsOffline(dashResult.fromCache);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

      // ── Matrix Element Intelligence ──
      // Compute deficiency weights from element data to make the rain adaptive
      if (matrixEnabled && dashResult.data?.elements) {
        const elData = dashResult.data.elements;
        const dailyTargets: Record<string, number> = { C: 300, H: 40, O: 200, N: 16, S: 1, Ca: 1, Fe: 0.018, Mg: 0.4, K: 4.7, Zn: 0.011 };
        const weights: Record<string, number> = {};
        Object.entries(dailyTargets).forEach(([el, target]) => {
          const current = elData[el] || 0;
          const pct = target > 0 ? current / target : 0;
          // Higher weight = more deficient = appears more in rain
          weights[el] = pct < 0.3 ? 1.0 : pct < 0.6 ? 0.5 : 0;
        });
        setPriorityElements(weights);

        // Auto-adaptive color based on nutrition status
        if (adaptiveColor === 'auto') {
          const waterPct = (dashResult.data.water?.current || 0) / (dashResult.data.water?.goal || 2500);
          const proteinHeavy = (elData['N'] || 0) > 10;
          if (waterPct > 0.8) setAdaptiveColor('auto'); // stays auto - will render as cyan-ish internally
          else if (proteinHeavy) setAdaptiveColor('auto'); // amber-ish
        }
      }

      // Payment status — cached (longer TTL, changes rarely)
      const payResult = await cachedFetch(
        'payment_status',
        async () => {
          const res = await fetch(`${BACKEND_URL}/api/payments/status`, { headers: authHeaders });
          if (!res.ok) throw new Error('payment status fetch failed');
          return res.json();
        },
        CacheTTL.MEDIUM,
      );
      setPaymentStatus(payResult.data);
    } catch (e) { console.error('Dashboard fetch error:', e); }
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchDashboard(); }, []));

  const quickAddWater = async (ml: number) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      await fetch(`${BACKEND_URL}/api/water`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount_ml: ml })
      });
      // Invalidate caches so fresh data is fetched
      await Promise.all([
        clearCacheForKey(CacheKeys.dashboard),
        clearCacheForKey(CacheKeys.waterToday),
      ]);
      fetchDashboard();
    } catch (e) { console.error(e); }
  };

  const quickSearchFoods = async () => {
    if (!quickSearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/foods/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: quickSearch, page_size: 5 })
      });
      if (res.ok) setSearchResults((await res.json()).foods || []);
    } catch (e) { }
    finally { setSearching(false); }
  };

  const selectFood = (food: any) => {
    setSelectedFood(food);
    setPortionAmount('100');
    setPortionUnit('g');
    setCookingMethod('raw');
  };

  const confirmLogMeal = async () => {
    if (!selectedFood) return;
    setLogging(true);
    try {
      const grams = parseFloat(portionAmount) || 100;
      const token = await AsyncStorage.getItem('session_token');
      if (!token) { Alert.alert('Error', 'Not logged in'); return; }

      let foodName = selectedFood.description;
      let nutrientData: Record<string, number> = {};
      let elementsData: Record<string, number> = {};
      let allergensList: string[] = [];

      // Try full analysis first
      try {
        const res = await fetch(`${BACKEND_URL}/api/foods/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fdc_id: selectedFood.fdc_id, portion_grams: grams, cooking_method: cookingMethod })
        });
        if (res.ok) {
          const analysis = await res.json();
          foodName = analysis.food_name || selectedFood.description;
          nutrientData = cookingMethod !== 'raw' && analysis.nutrients?.cooked
            ? analysis.nutrients.cooked : analysis.nutrients?.raw || {};
          elementsData = analysis.elements?.mass_grams || {};
          allergensList = analysis.allergens || [];
        } else {
          // Analysis failed — use basic nutrients from search results if available
          console.log('Analysis failed, using basic food data');
          const basicNutrients = selectedFood.foodNutrients || [];
          basicNutrients.forEach((n: any) => {
            const factor = grams / 100;
            if (n.nutrientName?.includes('Energy')) nutrientData['energy_kcal'] = Math.round((n.value || 0) * factor * 10) / 10;
            else if (n.nutrientName?.includes('Protein')) nutrientData['protein_g'] = Math.round((n.value || 0) * factor * 10) / 10;
            else if (n.nutrientName?.includes('fat') || n.nutrientName?.includes('Fat')) nutrientData['fat_g'] = Math.round((n.value || 0) * factor * 10) / 10;
            else if (n.nutrientName?.includes('Carbohydrate')) nutrientData['carbohydrate_g'] = Math.round((n.value || 0) * factor * 10) / 10;
          });
        }
      } catch (analyzeError) {
        console.log('Analysis network error, using basic food data');
      }

      // Log the meal regardless — basic data is better than no data
      const mealRes = await fetch(`${BACKEND_URL}/api/meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          fdc_id: selectedFood.fdc_id, food_name: foodName,
          portion_grams: grams, meal_type: getAutoMealType(), cooking_method: cookingMethod,
          nutrients: nutrientData, elements: elementsData,
          allergens: allergensList
        })
      });

      if (mealRes.ok) {
        setShowQuickMeal(false); setQuickSearch(''); setSearchResults([]); setSelectedFood(null);
        await Promise.all([
          clearCacheForKey(CacheKeys.dashboard),
          clearCacheForKey(CacheKeys.mealsToday),
        ]);
        fetchDashboard();
        Alert.alert(t('dash_logged'), `${foodName} (${grams}${portionUnit}, ${cookingMethod}) ${t('dash_added_to')} ${getAutoMealType()}`);
      } else {
        const errData = await mealRes.json().catch(() => ({}));
        Alert.alert('Error', errData.detail || 'Failed to save meal. Please try again.');
      }
    } catch (e) { Alert.alert('Error', 'Failed to log meal. Check your connection.'); }
    finally { setLogging(false); }
  };

  const getAutoMealType = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 15) return 'lunch';
    if (hour < 20) return 'dinner';
    return 'snack';
  };

  const calculateScore = () => {
    if (!dashboard) return 0;
    const n = dashboard.nutrition || {};
    const h = dashboard.hydration || {};
    const r = dashboard.routines || {};
    const calScore = Math.min(n.calories?.percentage || 0, 100);
    const protScore = Math.min(n.protein?.percentage || 0, 100);
    const waterScore = Math.min(h.percentage || 0, 100);
    const routineScore = r.percentage || 0;
    const mealBonus = Math.min((n.meals_count || 0) * 10, 20);
    return Math.round((calScore * 0.25 + protScore * 0.25 + waterScore * 0.25 + routineScore * 0.15 + mealBonus));
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dash_greeting_morning');
    if (hour < 17) return t('dash_greeting_afternoon');
    return t('dash_greeting_evening');
  };

  // Old getNutrientGaps replaced by NutrientGapAlerts component

  const handleShareDailyReport = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/share/daily-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        await Share.share({ message: data.text, title: 'My NutriOS Daily Report' });
      } else {
        Alert.alert('No Data', 'Start tracking meals to share your progress!');
      }
    } catch (e) { console.error(e); }
  };

  const handleShareWeeklyReport = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/share/weekly-report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        await Share.share({ message: data.text, title: 'My NutriOS Weekly Report' });
      } else {
        Alert.alert('No Data', 'Start tracking to generate a weekly report!');
      }
    } catch (e) { console.error(e); }
  };

  const ELEMENT_COLORS: Record<string, string> = { C: '#00d4ff', H: '#00ff88', O: '#ff6b6b', N: '#a29bfe', S: '#ffd93d', Ca: '#4ecdc4', Fe: '#ff9f43', Mg: '#fd79a8', K: '#6c5ce7', Zn: '#e17055' };
  const ELEMENT_EFFECTS: Record<string, string[]> = { C: ['Energy metabolism'], H: ['Cell hydration'], O: ['Cellular respiration'], N: ['Protein synthesis'], S: ['Protein structure'], Ca: ['Bone health'], Fe: ['Oxygen transport'], Mg: ['Enzyme activation'], K: ['Heart rhythm'], Zn: ['Immune function'] };

  const elements = dashboard?.elements || {};

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboard(); }} tintColor="#00d4ff" />}
        showsVerticalScrollIndicator={false}>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ── Offline Banner ── */}
          {isOffline && (
            <View style={styles.offlineBanner}>
              <Ionicons name="cloud-offline" size={16} color="#ffd93d" />
              <Text style={styles.offlineBannerText}>{t('dash_offline')}</Text>
            </View>
          )}

          {/* ── Header ── */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{getGreeting()},</Text>
              <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
            </View>
            <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/settings')}
              accessibilityRole="button" accessibilityLabel={t('set_title')} accessibilityHint="Open settings screen">
              <View style={[styles.avatarSmall, paymentStatus?.is_premium && styles.avatarPro]}>
                <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
              </View>
              {paymentStatus?.is_premium && (
                <View style={styles.avatarProBadge}>
                  <Ionicons name="diamond" size={10} color="#ffd93d" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Trial Badge ── */}
          {paymentStatus && !paymentStatus.is_premium && (
            <TouchableOpacity
              style={[styles.trialBadge, paymentStatus.trial_days_remaining <= 3 && styles.trialBadgeUrgent]}
              onPress={() => router.push('/upgrade')}
            >
              <Ionicons name={paymentStatus.trial_days_remaining <= 3 ? 'warning' : 'time'} size={16}
                color={paymentStatus.trial_days_remaining <= 3 ? '#ff6b6b' : '#ffd93d'} />
              <Text style={[styles.trialBadgeText, paymentStatus.trial_days_remaining <= 3 && { color: '#ff6b6b' }]}>
                {paymentStatus.trial_days_remaining > 0
                  ? `${paymentStatus.trial_days_remaining} ${t('dash_trial_days')}`
                  : t('dash_trial_expired')}
              </Text>
              <View style={styles.trialBadgeBtn}>
                <Text style={styles.trialBadgeBtnText}>{t('dash_subscribe')}</Text>
              </View>
            </TouchableOpacity>
          )}
          {paymentStatus?.is_premium && (
            <View style={styles.proBadge}>
              <View style={styles.proBadgeGlow} />
              <Ionicons name="diamond" size={16} color="#ffd93d" />
              <Text style={styles.proBadgeText}>NutriOS Pro</Text>
              <Ionicons name="checkmark-circle" size={16} color="#00ff88" />
            </View>
          )}

          {/* ── Score + Main Rings ── */}
          <View style={styles.heroSection}>
            <View style={styles.heroGlow} />
            <HealthScore score={calculateScore()} />
            <View style={styles.mainRings}>
              <ProgressRing size={90} strokeWidth={6} progress={dashboard?.nutrition?.calories?.percentage || 0}
                colors={['#ff6b6b', '#ff9f43']} label={t('dash_calories')} icon="flame"
                value={`${Math.round(dashboard?.nutrition?.calories?.current || 0)}`}
                unit={`/${dashboard?.nutrition?.calories?.goal || 2000}`} />
              <ProgressRing size={90} strokeWidth={6} progress={dashboard?.hydration?.percentage || 0}
                colors={['#00d4ff', '#0099ff']} label={t('dash_water')} icon="water"
                value={`${((dashboard?.hydration?.current_ml || 0) / 1000).toFixed(1)}`}
                unit={`/${((dashboard?.hydration?.goal_ml || 2500) / 1000).toFixed(1)}L`} />
              <ProgressRing size={90} strokeWidth={6} progress={dashboard?.nutrition?.protein?.percentage || 0}
                colors={['#00ff88', '#4ecdc4']} label={t('dash_protein')} icon="barbell"
                value={`${Math.round(dashboard?.nutrition?.protein?.current || 0)}`}
                unit={`/${dashboard?.nutrition?.protein?.goal || 50}g`} />
            </View>
          </View>

          {/* ── Quick Actions ── */}
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickWaterBtn} onPress={() => quickAddWater(250)}
              accessibilityRole="button" accessibilityLabel={`${t('dash_water')}: +250ml`}>
              <View style={styles.quickBtnGlow}>
                <Ionicons name="water" size={22} color="#00d4ff" />
              </View>
              <Text style={styles.quickBtnLabel}>+250ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickWaterBtn} onPress={() => quickAddWater(500)}
              accessibilityRole="button" accessibilityLabel={`${t('dash_water')}: +500ml`}>
              <View style={styles.quickBtnGlow}>
                <Ionicons name="water" size={22} color="#0099ff" />
              </View>
              <Text style={styles.quickBtnLabel}>+500ml</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickMealBtn} onPress={() => setShowQuickMeal(true)}
              accessibilityRole="button" accessibilityLabel={t('dash_log_meal')}>
              <View style={[styles.quickBtnGlow, { backgroundColor: 'rgba(255, 107, 107, 0.15)' }]}>
                <Ionicons name="add-circle" size={22} color="#ff6b6b" />
              </View>
              <Text style={styles.quickBtnLabel}>{t('dash_log_meal')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickMealBtn} onPress={() => router.push('/scanner')}
              accessibilityRole="button" accessibilityLabel={t('dash_scan')}>
              <View style={[styles.quickBtnGlow, { backgroundColor: 'rgba(255, 217, 61, 0.15)' }]}>
                <Ionicons name="barcode" size={22} color="#ffd93d" />
              </View>
              <Text style={styles.quickBtnLabel}>{t('dash_scan')}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Nutrient Gap Alerts (Enhanced) ── */}
          <View style={styles.alertsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="pulse" size={16} color="#ffd93d" /> {t('dash_nutrient_gaps')}
              </Text>
            </View>
            <NutrientGapAlerts nutrients={dashboard?.nutrition?.nutrients || {}} />
          </View>

          {/* ── Elemental Composition (Enhanced) ── */}
          <View style={styles.elementsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="flask" size={16} color="#00d4ff" /> {t('dash_elemental')}
              </Text>
              <TouchableOpacity onPress={() => router.push('/progress')}
                accessibilityRole="link" accessibilityLabel={t('dash_see_charts')}>
                <Text style={styles.seeAll}>{t('dash_see_charts')}</Text>
              </TouchableOpacity>
            </View>
            <AnimatedElements
              elements={elements}
              colors={ELEMENT_COLORS}
              effects={ELEMENT_EFFECTS}
            />
          </View>

          {/* ── Streak & Gamification (Enhanced) ── */}
          <StreakSection data={{
            streakDays: dashboard?.routines?.streak_days || 0,
            mealsToday: dashboard?.nutrition?.meals_count || 0,
            routinesCompleted: dashboard?.routines?.completed || 0,
            routinesTotal: dashboard?.routines?.total || 0,
          }} />

          {/* ── Macros Breakdown ── */}
          <View style={styles.macrosCard}>
            <Text style={styles.sectionTitle}>{t('dash_macro_breakdown')}</Text>
            <View style={styles.macroRow}>
              {[
                { label: 'Carbs', val: dashboard?.nutrition?.carbs?.current || 0, color: '#ffd93d', icon: 'leaf' },
                { label: 'Fat', val: dashboard?.nutrition?.fat?.current || 0, color: '#ff9f43', icon: 'water' },
                { label: 'Fiber', val: 0, color: '#4ecdc4', icon: 'nutrition' },
              ].map((m) => (
                <View key={m.label} style={styles.macroItem}>
                  <View style={[styles.macroIconBg, { backgroundColor: m.color + '20' }]}>
                    <Ionicons name={m.icon as any} size={18} color={m.color} />
                  </View>
                  <Text style={styles.macroValue}>{Math.round(m.val)}g</Text>
                  <Text style={styles.macroLabel}>{m.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Recent Meals ── */}
          {(dashboard?.recent_meals || []).length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{t('dash_recent_meals')}</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/track')}>
                  <Text style={styles.seeAll}>{t('dash_view_all')}</Text>
                </TouchableOpacity>
              </View>
              {dashboard.recent_meals.slice(0, 3).map((meal: any, i: number) => (
                <View key={i} style={styles.mealCard}>
                  <View style={styles.mealIcon}>
                    <Ionicons name="restaurant" size={18} color="#4ecdc4" />
                  </View>
                  <View style={styles.mealInfo}>
                    <Text style={styles.mealName} numberOfLines={1}>{meal.food_name}</Text>
                    <Text style={styles.mealMeta}>{meal.portion_grams}g • {meal.cooking_method}</Text>
                  </View>
                  <Text style={styles.mealCal}>{Math.round(meal.nutrients?.energy_kcal || 0)} kcal</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── AI Insights ── */}
          {(dashboard?.insights || []).length > 0 && (
            <View style={styles.insightsSection}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="sparkles" size={16} color="#a29bfe" /> {t('dash_ai_insights')}
              </Text>
              {dashboard.insights.slice(0, 3).map((ins: any, i: number) => (
                <View key={i} style={styles.insightCard}>
                  <View style={[styles.insightDot, { backgroundColor: ins.priority === 'high' ? '#ff6b6b' : ins.priority === 'normal' ? '#ffd93d' : '#4ecdc4' }]} />
                  <View style={styles.insightContent}>
                    <Text style={styles.insightTitle}>{ins.title}</Text>
                    <Text style={styles.insightMsg}>{ins.message}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── Quick Nav Grid ── */}
          <View style={styles.navGrid}>
            {[
              { label: t('dash_molecular'), icon: 'flask', color: '#00ff88', route: '/molecular-engine' },
              { label: t('dash_sequence'), icon: 'git-branch', color: '#ffd93d', route: '/sequence-optimizer' },
              { label: t('dash_recipes'), icon: 'restaurant', color: '#4ecdc4', route: '/recipes' },
              { label: t('dash_ai_coach'), icon: 'sparkles', color: '#fd79a8', route: '/ai-home' },
            ].map((item) => (
              <TouchableOpacity key={item.label} style={styles.navItem} onPress={() => router.push(item.route as any)}
                accessibilityRole="button" accessibilityLabel={item.label}>
                <View style={[styles.navIcon, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <Text style={styles.navLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Share & Social ── */}
          <View style={styles.shareSection}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="share-social" size={16} color="#a29bfe" /> {t('dash_share_progress')}
            </Text>
            <View style={styles.shareRow}>
              <TouchableOpacity style={styles.shareCardBtn} onPress={handleShareDailyReport}
                accessibilityRole="button" accessibilityLabel={t('dash_daily_report')}>
                <View style={[styles.shareIconBg, { backgroundColor: 'rgba(0, 212, 255, 0.15)' }]}>
                  <Ionicons name="today" size={22} color="#00d4ff" />
                </View>
                <Text style={styles.shareCardLabel}>{t('dash_daily_report')}</Text>
                <Text style={styles.shareCardSub}>{t('dash_share_today_desc')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.shareCardBtn} onPress={handleShareWeeklyReport}
                accessibilityRole="button" accessibilityLabel={t('dash_weekly_report')}>
                <View style={[styles.shareIconBg, { backgroundColor: 'rgba(162, 155, 254, 0.15)' }]}>
                  <Ionicons name="calendar" size={22} color="#a29bfe" />
                </View>
                <Text style={styles.shareCardLabel}>{t('dash_weekly_report')}</Text>
                <Text style={styles.shareCardSub}>{t('dash_share_weekly_desc')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.shareBadgesBtn} onPress={() => router.push('/badges')}>
              <Ionicons name="trophy" size={20} color="#ffd93d" />
              <Text style={styles.shareBadgesText}>{t('dash_view_badges')}</Text>
              <Ionicons name="arrow-forward" size={16} color="#666" />
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>

      {/* ── Quick Meal Modal ── */}
      <Modal visible={showQuickMeal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedFood ? t('dash_customize_meal') : t('dash_quick_add_meal')}
              </Text>
              <TouchableOpacity onPress={() => {
                if (selectedFood) { setSelectedFood(null); }
                else { setShowQuickMeal(false); setSearchResults([]); setQuickSearch(''); }
              }}>
                <Ionicons name={selectedFood ? 'arrow-back' : 'close'} size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {!selectedFood ? (
              <>
                <View style={styles.searchRow}>
                  <TextInput style={styles.searchInput} value={quickSearch} onChangeText={setQuickSearch}
                    placeholder={t('dash_search_food')} placeholderTextColor="#666"
                    onSubmitEditing={quickSearchFoods} returnKeyType="search" autoFocus />
                  <TouchableOpacity style={styles.searchBtn} onPress={quickSearchFoods}>
                    <Ionicons name="search" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScroll}>
                  {searching && <Text style={styles.searchingText}>Searching...</Text>}
                  {searchResults.map((food) => (
                    <TouchableOpacity key={food.fdc_id} style={styles.foodResult} onPress={() => selectFood(food)}>
                      <Ionicons name="add-circle" size={22} color="#00d4ff" />
                      <View style={styles.foodResultInfo}>
                        <Text style={styles.foodResultName} numberOfLines={1}>{food.description}</Text>
                        <Text style={styles.foodResultMeta}>{food.data_type} • Tap to customize</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#444" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {/* Selected food name */}
                <View style={styles.selectedFoodCard}>
                  <Ionicons name="restaurant" size={20} color="#4ecdc4" />
                  <Text style={styles.selectedFoodName} numberOfLines={2}>{selectedFood.description}</Text>
                </View>

                {/* Portion Amount + Unit */}
                <Text style={styles.mealFormLabel}>{t('nutr_portion_label')}</Text>
                <View style={styles.portionRow}>
                  <TextInput
                    style={styles.portionInput}
                    value={portionAmount}
                    onChangeText={setPortionAmount}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor="#666"
                  />
                  <View style={styles.unitToggle}>
                    {(['g', 'ml'] as const).map((u) => (
                      <TouchableOpacity key={u}
                        style={[styles.unitBtn, portionUnit === u && styles.unitBtnActive]}
                        onPress={() => setPortionUnit(u)}>
                        <Text style={[styles.unitBtnText, portionUnit === u && styles.unitBtnTextActive]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Cooking Method */}
                <Text style={styles.mealFormLabel}>{t('nutr_cooking')}</Text>
                <View style={styles.cookingGrid}>
                  {[
                    { id: 'raw', label: t('nutr_raw'), icon: 'leaf' },
                    { id: 'boiling', label: t('nutr_boiled'), icon: 'water' },
                    { id: 'steaming', label: t('nutr_steamed'), icon: 'cloud' },
                    { id: 'frying', label: t('nutr_fried'), icon: 'flame' },
                    { id: 'baking', label: t('nutr_baked'), icon: 'pizza' },
                    { id: 'grilling', label: t('nutr_grilled'), icon: 'bonfire' },
                  ].map((m) => (
                    <TouchableOpacity key={m.id}
                      style={[styles.cookingOption, cookingMethod === m.id && styles.cookingOptionActive]}
                      onPress={() => setCookingMethod(m.id)}>
                      <Ionicons name={m.icon as any} size={18}
                        color={cookingMethod === m.id ? '#00d4ff' : '#888'} />
                      <Text style={[styles.cookingLabel, cookingMethod === m.id && styles.cookingLabelActive]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Meal Type (auto-detected) */}
                <Text style={styles.mealFormLabel}>{t('dash_meal_type')}: <Text style={{ color: '#00d4ff' }}>{getAutoMealType()}</Text></Text>

                {/* Confirm Button */}
                <TouchableOpacity
                  style={[styles.confirmLogBtn, logging && { opacity: 0.6 }]}
                  onPress={confirmLogMeal}
                  disabled={logging}
                >
                  {logging ? (
                    <Text style={styles.confirmLogText}>Analyzing & Logging...</Text>
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={22} color="#fff" />
                      <Text style={styles.confirmLogText}>Log {portionAmount}{portionUnit} ({cookingMethod})</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  scrollContent: { paddingBottom: 100 },
  // Offline banner
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,217,61,0.12)', paddingVertical: 8, marginHorizontal: 16, marginTop: 8, borderRadius: 10, gap: 8 },
  offlineBannerText: { color: '#ffd93d', fontSize: 13, fontWeight: '500' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  greeting: { fontSize: 14, color: '#666' },
  userName: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  profileBtn: { padding: 4, position: 'relative' },
  avatarSmall: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.3)' },
  avatarPro: { borderColor: '#ffd93d', borderWidth: 2 },
  avatarProBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#ffd93d',
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  // Trial/Pro Badge
  trialBadge: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 8,
    backgroundColor: 'rgba(255, 217, 61, 0.08)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255, 217, 61, 0.15)',
  },
  trialBadgeUrgent: { backgroundColor: 'rgba(255, 107, 107, 0.08)', borderColor: 'rgba(255, 107, 107, 0.2)' },
  trialBadgeText: { flex: 1, fontSize: 13, color: '#ffd93d', fontWeight: '600', marginLeft: 8 },
  trialBadgeBtn: { backgroundColor: '#ffd93d', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  trialBadgeBtnText: { fontSize: 12, fontWeight: '700', color: '#000' },
  proBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 8,
    backgroundColor: 'rgba(255, 217, 61, 0.12)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255, 217, 61, 0.3)', position: 'relative', overflow: 'hidden',
  },
  proBadgeGlow: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255, 217, 61, 0.08)', left: -10, top: -15,
  },
  proBadgeText: { fontSize: 14, color: '#ffd93d', fontWeight: '800', marginLeft: 8, marginRight: 8, letterSpacing: 0.5 },
  // Hero
  heroSection: { alignItems: 'center', paddingVertical: 16, position: 'relative' },
  heroGlow: { position: 'absolute', top: 20, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(0, 212, 255, 0.06)' },
  mainRings: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingHorizontal: 16, marginTop: 16 },
  ringValue: { fontWeight: 'bold', color: '#fff', marginTop: 2 },
  ringUnit: { color: '#666' },
  ringLabel: { color: '#888', fontSize: 11, marginTop: 6, fontWeight: '500' },
  // Score
  scoreContainer: { alignItems: 'center', position: 'relative' },
  scoreGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80 },
  scoreLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  // Quick Actions
  quickActions: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, justifyContent: 'space-between' },
  quickWaterBtn: { alignItems: 'center', flex: 1 },
  quickMealBtn: { alignItems: 'center', flex: 1 },
  quickBtnGlow: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0, 212, 255, 0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.2)' },
  quickBtnLabel: { color: '#888', fontSize: 11, marginTop: 6, fontWeight: '500' },
  // Alerts
  alertsSection: { paddingHorizontal: 20, marginTop: 24 },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12122a', borderRadius: 12, padding: 14, marginTop: 8, borderLeftWidth: 3 },
  alertContent: { marginLeft: 12, flex: 1 },
  alertTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  alertTip: { color: '#888', fontSize: 12, marginTop: 2 },
  // Elements
  elementsSection: { marginTop: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  seeAll: { color: '#00d4ff', fontSize: 13, fontWeight: '500' },
  elementsScroll: { paddingHorizontal: 16 },
  elementCard: { width: 80, height: 100, borderRadius: 14, backgroundColor: '#0d0d22', borderWidth: 1, marginRight: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  elementGlow: { position: 'absolute', top: -20, width: 60, height: 60, borderRadius: 30 },
  elementSymbol: { fontSize: 22, fontWeight: '900' },
  elementAmount: { fontSize: 11, color: '#aaa', marginTop: 4 },
  elementEffect: { fontSize: 8, color: '#555', marginTop: 2 },
  // Streak
  streakSection: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 24, justifyContent: 'space-between' },
  streakCard: { flex: 1, backgroundColor: '#0d0d22', borderRadius: 16, padding: 16, marginHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', overflow: 'hidden' },
  streakFireGlow: { position: 'absolute', top: -10, width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255, 107, 107, 0.1)' },
  streakCount: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  streakLabel: { fontSize: 11, color: '#666', marginTop: 4 },
  // Macros
  macrosCard: { marginHorizontal: 16, marginTop: 24, backgroundColor: '#0d0d22', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  macroRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  macroItem: { alignItems: 'center' },
  macroIconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  macroValue: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  macroLabel: { fontSize: 11, color: '#666', marginTop: 2 },
  // Recent
  recentSection: { paddingHorizontal: 20, marginTop: 24 },
  mealCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d22', borderRadius: 12, padding: 14, marginTop: 8 },
  mealIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(78, 205, 196, 0.1)', justifyContent: 'center', alignItems: 'center' },
  mealInfo: { flex: 1, marginLeft: 12 },
  mealName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  mealMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  mealCal: { color: '#ff6b6b', fontSize: 13, fontWeight: '600' },
  // Insights
  insightsSection: { paddingHorizontal: 20, marginTop: 24 },
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#0d0d22', borderRadius: 12, padding: 14, marginTop: 8 },
  insightDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  insightContent: { marginLeft: 12, flex: 1 },
  insightTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  insightMsg: { color: '#888', fontSize: 12, marginTop: 2 },
  // Nav Grid
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 24 },
  navItem: { width: '25%', alignItems: 'center', marginBottom: 16 },
  navIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  navLabel: { color: '#888', fontSize: 11, marginTop: 6, fontWeight: '500' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#12122a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  searchRow: { flexDirection: 'row', padding: 16, paddingBottom: 0 },
  searchInput: { flex: 1, backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, marginRight: 8 },
  searchBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center' },
  modalHint: { color: '#555', fontSize: 12, paddingHorizontal: 16, marginTop: 8 },
  modalScroll: { padding: 16, maxHeight: 400 },
  searchingText: { color: '#888', textAlign: 'center', padding: 20 },
  foodResult: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, marginBottom: 8 },
  foodResultInfo: { flex: 1, marginLeft: 12 },
  foodResultName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  foodResultMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  // Meal customization form
  selectedFoodCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(78, 205, 196, 0.1)',
    borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(78, 205, 196, 0.2)',
  },
  selectedFoodName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 10 },
  mealFormLabel: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  portionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  portionInput: {
    flex: 1, backgroundColor: '#1a1a3e', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 18, fontWeight: '700', marginRight: 10,
  },
  unitToggle: { flexDirection: 'row', backgroundColor: '#1a1a3e', borderRadius: 12, overflow: 'hidden' },
  unitBtn: { paddingHorizontal: 20, paddingVertical: 14 },
  unitBtnActive: { backgroundColor: '#00d4ff' },
  unitBtnText: { color: '#888', fontSize: 16, fontWeight: '700' },
  unitBtnTextActive: { color: '#fff' },
  cookingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cookingOption: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, backgroundColor: '#1a1a3e', borderWidth: 1, borderColor: 'transparent',
  },
  cookingOptionActive: { borderColor: '#00d4ff', backgroundColor: 'rgba(0, 212, 255, 0.1)' },
  cookingLabel: { color: '#888', fontSize: 13, fontWeight: '500', marginLeft: 6 },
  cookingLabelActive: { color: '#00d4ff' },
  confirmLogBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#00d4ff', borderRadius: 14, paddingVertical: 16, marginTop: 16, marginBottom: 8,
  },
  confirmLogText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  // Share Section
  shareSection: { paddingHorizontal: 20, marginBottom: 24 },
  shareRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  shareCardBtn: {
    flex: 1, backgroundColor: '#0d0d22', borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  shareIconBg: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  shareCardLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  shareCardSub: { color: '#666', fontSize: 11, marginTop: 4, textAlign: 'center' },
  shareBadgesBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 217, 61, 0.06)',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255, 217, 61, 0.12)',
  },
  shareBadgesText: { flex: 1, color: '#ffd93d', fontSize: 14, fontWeight: '600', marginLeft: 10 },
});
