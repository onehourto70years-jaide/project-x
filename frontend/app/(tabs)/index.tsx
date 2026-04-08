import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, Animated, Alert, Share, Modal, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../_layout';
import { useLanguage } from '../../src/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedFetch, CacheKeys, CacheTTL, clearCacheForKey } from '../../src/cache';
import { useMatrix } from '../../src/MatrixContext';
import { WidgetItem, DEFAULT_WIDGETS, loadWidgetLayout, saveWidgetLayout } from '../../src/widgetConfig';

// ─── Widgets ──────────────────────────────
import WidgetHealthScore from '../../src/components/widgets/WidgetHealthScore';
import WidgetQuickActions from '../../src/components/widgets/WidgetQuickActions';
import WidgetNutrientGaps from '../../src/components/widgets/WidgetNutrientGaps';
import WidgetElements from '../../src/components/widgets/WidgetElements';
import WidgetStreak from '../../src/components/widgets/WidgetStreak';
import WidgetMacros from '../../src/components/widgets/WidgetMacros';
import WidgetRecentMeals from '../../src/components/widgets/WidgetRecentMeals';
import WidgetAIInsights from '../../src/components/widgets/WidgetAIInsights';
import WidgetQuickNav from '../../src/components/widgets/WidgetQuickNav';
import WidgetShareSocial from '../../src/components/widgets/WidgetShareSocial';
import QuickMealModal from '../../src/components/QuickMealModal';
import WidgetErrorBoundary from '../../src/components/WidgetErrorBoundary';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { matrixEnabled, setPriorityElements, setAdaptiveColor, adaptiveColor } = useMatrix();

  // ─── Data State ────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ─── Widget layout ─────────────────────
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [showCustomize, setShowCustomize] = useState(false);
  const [editWidgets, setEditWidgets] = useState<WidgetItem[]>([]);

  // ─── Quick Meal Modal ──────────────────
  const [showQuickMeal, setShowQuickMeal] = useState(false);

  // ─── Load widget layout ────────────────
  useEffect(() => { loadWidgetLayout().then(setWidgets); }, []);

  const onPullRefresh = async () => {
    setRefreshing(true);
    await Promise.all([clearCacheForKey(CacheKeys.dashboard), clearCacheForKey('payment_status')]);
    fetchDashboard();
  };

  // ─── Fetch Dashboard ───────────────────
  const fetchDashboard = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const authHeaders = { 'Authorization': `Bearer ${token}` };

      const dashResult = await cachedFetch(CacheKeys.dashboard, async () => {
        const res = await fetch(`${BACKEND_URL}/api/dashboard`, { headers: authHeaders });
        if (!res.ok) throw new Error('dashboard fetch failed');
        return res.json();
      }, CacheTTL.SHORT);

      setDashboard(dashResult.data);
      setIsOffline(dashResult.fromCache);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

      // ── Matrix Element Intelligence ──
      if (matrixEnabled && dashResult.data?.elements) {
        const elData = dashResult.data.elements;
        const dailyTargets: Record<string, number> = { C: 300, H: 40, O: 200, N: 16, S: 1, Ca: 1, Fe: 0.018, Mg: 0.4, K: 4.7, Zn: 0.011 };
        const weights: Record<string, number> = {};
        Object.entries(dailyTargets).forEach(([el, target]) => {
          const current = elData[el] || 0;
          const pct = target > 0 ? current / target : 0;
          weights[el] = pct < 0.3 ? 1.0 : pct < 0.6 ? 0.5 : 0;
        });
        setPriorityElements(weights);
        if (adaptiveColor === 'auto') {
          const waterPct = (dashResult.data.water?.current || 0) / (dashResult.data.water?.goal || 2500);
          if (waterPct > 0.8) setAdaptiveColor('auto');
        }
      }

      const payResult = await cachedFetch('payment_status', async () => {
        const res = await fetch(`${BACKEND_URL}/api/payments/status`, { headers: authHeaders });
        if (!res.ok) throw new Error('payment status fetch failed');
        return res.json();
      }, CacheTTL.MEDIUM);
      setPaymentStatus(payResult.data);
    } catch (e) { console.error('Dashboard fetch error:', e); }
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchDashboard(); }, []));

  // ─── Actions ───────────────────────────
  const quickAddWater = async (ml: number) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      await fetch(`${BACKEND_URL}/api/water`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount_ml: ml })
      });
      await Promise.all([clearCacheForKey(CacheKeys.dashboard), clearCacheForKey(CacheKeys.waterToday)]);
      fetchDashboard();
    } catch (e) { console.error(e); }
  };

  const handleShareDaily = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/share/daily-summary`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); await Share.share({ message: data.text, title: 'My NutriOS Daily Report' }); }
      else Alert.alert('No Data', 'Start tracking meals to share your progress!');
    } catch (e) { console.error(e); }
  };

  const handleShareWeekly = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/share/weekly-report`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); await Share.share({ message: data.text, title: 'My NutriOS Weekly Report' }); }
      else Alert.alert('No Data', 'Start tracking to generate a weekly report!');
    } catch (e) { console.error(e); }
  };

  // ─── Greeting ──────────────────────────
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dash_greeting_morning');
    if (h < 17) return t('dash_greeting_afternoon');
    return t('dash_greeting_evening');
  };

  // ─── Customize Handlers ────────────────
  const openCustomize = () => { setEditWidgets(widgets.map(w => ({ ...w }))); setShowCustomize(true); };
  const toggleWidget = (id: string, val: boolean) => setEditWidgets(prev => prev.map(w => w.id === id ? { ...w, enabled: val } : w));
  const moveWidget = (idx: number, dir: number) => {
    const next = [...editWidgets];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setEditWidgets(next);
  };
  const saveAndClose = async () => { setWidgets(editWidgets); await saveWidgetLayout(editWidgets); setShowCustomize(false); };
  const resetDefaults = () => setEditWidgets(DEFAULT_WIDGETS.map(w => ({ ...w })));

  // ─── Widget Renderer (each wrapped in error boundary) ──
  const WIDGET_LABELS: Record<string, string> = {
    health_score: 'Health Score', quick_actions: 'Quick Actions', nutrient_gaps: 'Nutrient Gaps',
    elements: 'Elements', streak: 'Streak', macros: 'Macros', recent_meals: 'Recent Meals',
    ai_insights: 'AI Insights', quick_nav: 'Quick Nav', share_social: 'Share',
  };

  const renderWidget = (w: WidgetItem) => {
    let content: React.ReactNode = null;
    switch (w.id) {
      case 'health_score': content = <WidgetHealthScore dashboard={dashboard} />; break;
      case 'quick_actions': content = <WidgetQuickActions onAddWater={quickAddWater} onLogMeal={() => setShowQuickMeal(true)} onScan={() => router.push('/scanner')} />; break;
      case 'nutrient_gaps': content = <WidgetNutrientGaps nutrients={dashboard?.nutrition?.nutrients} />; break;
      case 'elements': content = <WidgetElements elements={dashboard?.elements} onViewCharts={() => router.push('/progress')} />; break;
      case 'streak': content = <WidgetStreak dashboard={dashboard} />; break;
      case 'macros': content = <WidgetMacros dashboard={dashboard} />; break;
      case 'recent_meals': content = <WidgetRecentMeals meals={dashboard?.recent_meals || []} onViewAll={() => router.push('/(tabs)/nutrition')} onRefresh={fetchDashboard} />; break;
      case 'ai_insights': content = <WidgetAIInsights insights={dashboard?.insights || []} />; break;
      case 'quick_nav': content = <WidgetQuickNav />; break;
      case 'share_social': content = <WidgetShareSocial onShareDaily={handleShareDaily} onShareWeekly={handleShareWeekly} onViewBadges={() => router.push('/badges')} />; break;
      default: return null;
    }
    return (
      <WidgetErrorBoundary key={w.id} widgetName={WIDGET_LABELS[w.id] || w.id}>
        {content}
      </WidgetErrorBoundary>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor="#00d4ff" />}
        showsVerticalScrollIndicator={false}>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ── Offline Banner ── */}
          {isOffline && (
            <View style={s.offlineBanner}>
              <Ionicons name="cloud-offline" size={16} color="#ffd93d" />
              <Text style={s.offlineText}>{t('dash_offline')}</Text>
            </View>
          )}

          {/* ── Header ── */}
          <View style={s.header}>
            <View>
              <Text style={s.greeting}>{getGreeting()},</Text>
              <Text style={s.userName}>{user?.name?.split(' ')[0] || 'User'}</Text>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity style={s.customizeBtn} onPress={openCustomize}
                accessibilityRole="button" accessibilityLabel="Customize dashboard">
                <Ionicons name="options" size={20} color="#888" />
              </TouchableOpacity>
              <TouchableOpacity style={s.profileBtn} onPress={() => router.push('/settings')}
                accessibilityRole="button" accessibilityLabel={t('set_title')}>
                <View style={[s.avatar, paymentStatus?.is_premium && s.avatarPro]}>
                  <Text style={s.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
                </View>
                {paymentStatus?.is_premium && (
                  <View style={s.proBadgeSmall}><Ionicons name="diamond" size={10} color="#ffd93d" /></View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Trial/Pro Badge ── */}
          {paymentStatus && !paymentStatus.is_premium && (
            <TouchableOpacity style={[s.trialBadge, paymentStatus.trial_days_remaining <= 3 && s.trialUrgent]} onPress={() => router.push('/upgrade')}>
              <Ionicons name={paymentStatus.trial_days_remaining <= 3 ? 'warning' : 'time'} size={16}
                color={paymentStatus.trial_days_remaining <= 3 ? '#ff6b6b' : '#ffd93d'} />
              <Text style={[s.trialText, paymentStatus.trial_days_remaining <= 3 && { color: '#ff6b6b' }]}>
                {paymentStatus.trial_days_remaining > 0 ? `${paymentStatus.trial_days_remaining} ${t('dash_trial_days')}` : t('dash_trial_expired')}
              </Text>
              <View style={s.trialBtn}><Text style={s.trialBtnText}>{t('dash_subscribe')}</Text></View>
            </TouchableOpacity>
          )}
          {paymentStatus?.is_premium && (
            <View style={s.proBadge}>
              <View style={s.proBadgeGlow} />
              <Ionicons name="diamond" size={16} color="#ffd93d" />
              <Text style={s.proBadgeText}>NutriOS Pro</Text>
              <Ionicons name="checkmark-circle" size={16} color="#00ff88" />
            </View>
          )}

          {/* ── Dynamic Widget Grid ── */}
          {widgets.filter(w => w.enabled).map(renderWidget)}

        </Animated.View>
      </ScrollView>

      {/* ── Quick Meal Modal ── */}
      <QuickMealModal visible={showQuickMeal} onClose={() => setShowQuickMeal(false)} onMealLogged={fetchDashboard} />

      {/* ── Customize Dashboard Modal ── */}
      <Modal visible={showCustomize} animationType="slide" transparent>
        <View style={s.custOverlay}>
          <View style={s.custContent}>
            <View style={s.custHeader}>
              <Text style={s.custTitle}>{t('dash_customize') || 'Customize Dashboard'}</Text>
              <TouchableOpacity style={s.custSaveBtn} onPress={saveAndClose}>
                <Ionicons name="checkmark" size={20} color="#080818" />
                <Text style={s.custSaveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.custSubtitle}>Toggle widgets on/off and reorder with arrows</Text>
            <ScrollView style={s.custScroll} showsVerticalScrollIndicator={false}>
              {editWidgets.map((w, i) => (
                <View key={w.id} style={[s.custRow, !w.enabled && s.custRowOff]}>
                  <View style={s.custRowLeft}>
                    <View style={[s.custIcon, { backgroundColor: w.enabled ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)' }]}>
                      <Ionicons name={w.icon as any} size={18} color={w.enabled ? '#00d4ff' : '#555'} />
                    </View>
                    <Text style={[s.custLabel, !w.enabled && { color: '#555' }]}>{w.label}</Text>
                  </View>
                  <View style={s.custRowRight}>
                    <TouchableOpacity onPress={() => moveWidget(i, -1)} disabled={i === 0} style={s.arrowBtn}>
                      <Ionicons name="chevron-up" size={18} color={i === 0 ? '#222' : '#888'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveWidget(i, 1)} disabled={i === editWidgets.length - 1} style={s.arrowBtn}>
                      <Ionicons name="chevron-down" size={18} color={i === editWidgets.length - 1 ? '#222' : '#888'} />
                    </TouchableOpacity>
                    <Switch value={w.enabled} onValueChange={v => toggleWidget(w.id, v)}
                      trackColor={{ false: '#222', true: 'rgba(0,212,255,0.35)' }} thumbColor={w.enabled ? '#00d4ff' : '#555'} />
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={s.custFooter}>
              <TouchableOpacity style={s.resetBtn} onPress={resetDefaults}>
                <Ionicons name="refresh" size={16} color="#888" />
                <Text style={s.resetText}>Reset to Default</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.custCloseBtn} onPress={() => setShowCustomize(false)}>
                <Text style={s.custCloseTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  scroll: { paddingBottom: 100 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,217,61,0.12)', paddingVertical: 8, marginHorizontal: 16, marginTop: 8, borderRadius: 10, gap: 8 },
  offlineText: { color: '#ffd93d', fontSize: 13, fontWeight: '500' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  greeting: { fontSize: 14, color: '#666' },
  userName: { fontSize: 26, fontWeight: 'bold', color: '#fff' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customizeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  profileBtn: { padding: 4, position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(0,212,255,0.3)' },
  avatarPro: { borderColor: '#ffd93d', borderWidth: 2 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  proBadgeSmall: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#ffd93d' },
  // Trial/Pro
  trialBadge: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 8, backgroundColor: 'rgba(255,217,61,0.08)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,217,61,0.15)' },
  trialUrgent: { backgroundColor: 'rgba(255,107,107,0.08)', borderColor: 'rgba(255,107,107,0.2)' },
  trialText: { flex: 1, fontSize: 13, color: '#ffd93d', fontWeight: '600', marginLeft: 8 },
  trialBtn: { backgroundColor: '#ffd93d', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  trialBtnText: { fontSize: 12, fontWeight: '700', color: '#000' },
  proBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 8, backgroundColor: 'rgba(255,217,61,0.12)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,217,61,0.3)', position: 'relative', overflow: 'hidden' },
  proBadgeGlow: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,217,61,0.08)', left: -10, top: -15 },
  proBadgeText: { fontSize: 14, color: '#ffd93d', fontWeight: '800', marginLeft: 8, marginRight: 8, letterSpacing: 0.5 },
  // Customize Modal
  custOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  custContent: { backgroundColor: '#12122a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 20 },
  custHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  custTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  custSubtitle: { color: '#666', fontSize: 12, paddingHorizontal: 20, marginTop: 8 },
  custSaveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00d4ff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, gap: 6 },
  custSaveTxt: { color: '#080818', fontWeight: '700', fontSize: 14 },
  custScroll: { paddingHorizontal: 16, marginTop: 12, maxHeight: 420 },
  custRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0d0d22', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,212,255,0.08)' },
  custRowOff: { borderColor: 'transparent', opacity: 0.6 },
  custRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  custIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  custLabel: { color: '#fff', fontSize: 14, fontWeight: '500', flex: 1 },
  custRowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrowBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  custFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 12 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  resetText: { color: '#888', fontSize: 13, fontWeight: '500' },
  custCloseBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  custCloseTxt: { color: '#ff6b6b', fontSize: 14, fontWeight: '600' },
});
