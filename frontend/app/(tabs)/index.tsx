import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, Animated, Alert, Share, Modal, Switch, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../_layout';
import { useLanguage } from '../../src/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedFetch, CacheKeys, CacheTTL, clearCacheForKey } from '../../src/cache';
import { useMatrix } from '../../src/MatrixContext';
import { useTheme } from '../../src/ThemeContext';
import { useCelebration } from '../../src/CelebrationContext';
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
import WidgetJaideInsight from '../../src/components/widgets/WidgetJaideInsight';
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
  const { theme } = useTheme();

  const { triggerCelebration } = useCelebration();

  // ─── Data State ────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [dashboard, setDashboard] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const celebrationCheckedRef = useRef<Set<string>>(new Set());

  // ─── Dashboard View Mode ────────────────
  const [viewMode, setViewMode] = useState<'primary' | 'detail'>('primary');
  const [bodyState, setBodyState] = useState<any>(null);

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

      // ── Fetch body state for primary dashboard ──
      try {
        const bsRes = await fetch(`${BACKEND_URL}/api/body-state`, { headers: authHeaders });
        if (bsRes.ok) setBodyState(await bsRes.json());
      } catch (_) {} // Silent failure

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

      // ── Background Badge Check (silent celebration trigger) ──
      try {
        const badgeRes = await fetch(`${BACKEND_URL}/api/badges`, { headers: authHeaders });
        if (badgeRes.ok) {
          const bData = await badgeRes.json();
          const newlyEarned = bData.newly_earned || [];
          if (newlyEarned.length > 0) {
            const firstNew = newlyEarned[0];
            if (!celebrationCheckedRef.current.has(firstNew)) {
              celebrationCheckedRef.current.add(firstNew);
              const badgeDef = (bData.badges || []).find((b: any) => b.id === firstNew);
              if (badgeDef) {
                // Check settings
                let celebrationsOn = true;
                try {
                  const sRes = await fetch(`${BACKEND_URL}/api/user/settings`, { headers: authHeaders });
                  if (sRes.ok) { const s = await sRes.json(); celebrationsOn = s.celebrations_enabled !== false; }
                } catch (_) {}
                if (celebrationsOn) {
                  setTimeout(() => triggerCelebration(badgeDef, bData.stats || {}), 1200);
                }
              }
            }
          }
        }
      } catch (_) {} // Silent — don't block dashboard

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
      if (res.ok) { const data = await res.json(); await Share.share({ message: data.text, title: t('share_daily_title') }); }
      else Alert.alert(t('alert_no_data_title'), t('alert_no_data_share'));
    } catch (e) { console.error(e); }
  };

  const handleShareWeekly = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/share/weekly-report`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); await Share.share({ message: data.text, title: t('share_weekly_title') }); }
      else Alert.alert(t('alert_no_data_title'), t('alert_no_data_weekly'));
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
      case 'jaide_insight': content = <WidgetJaideInsight />; break;
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
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ── Offline Banner ── */}
          {isOffline && (
            <View style={[s.offlineBanner, { backgroundColor: `${theme.warning}1e` }]}>
              <Ionicons name="cloud-offline" size={16} color={theme.warning} />
              <Text style={[s.offlineText, { color: theme.warning }]}>{t('dash_offline')}</Text>
            </View>
          )}

          {/* ── Header ── */}
          <View style={s.header}>
            <View>
              <Text style={[s.greeting, { color: theme.textMuted }]}>{getGreeting()},</Text>
              <Text style={[s.userName, { color: theme.text }]}>{user?.name?.split(' ')[0] || 'User'}</Text>
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity style={[s.customizeBtn, { backgroundColor: `${theme.text}0f` }]} onPress={openCustomize}
                accessibilityRole="button" accessibilityLabel="Customize dashboard">
                <Ionicons name="options" size={20} color={theme.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={s.profileBtn} onPress={() => router.push('/settings')}
                accessibilityRole="button" accessibilityLabel={t('set_title')}>
                <View style={[s.avatar, { backgroundColor: theme.accent, borderColor: `${theme.accent}4d` }, paymentStatus?.is_premium && s.avatarPro]}>
                  <Text style={s.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
                </View>
                {paymentStatus?.is_premium && (
                  <View style={[s.proBadgeSmall, { backgroundColor: theme.bgCard }]}><Ionicons name="diamond" size={10} color={theme.warning} /></View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Trial/Pro Badge ── */}
          {paymentStatus && !paymentStatus.is_premium && (
            <TouchableOpacity style={[s.trialBadge, { backgroundColor: `${theme.warning}14`, borderColor: `${theme.warning}26` }, paymentStatus.trial_days_remaining <= 3 && { backgroundColor: `${theme.danger}14`, borderColor: `${theme.danger}33` }]} onPress={() => router.push('/upgrade')}>
              <Ionicons name={paymentStatus.trial_days_remaining <= 3 ? 'warning' : 'time'} size={16}
                color={paymentStatus.trial_days_remaining <= 3 ? theme.danger : theme.warning} />
              <Text style={[s.trialText, { color: theme.warning }, paymentStatus.trial_days_remaining <= 3 && { color: theme.danger }]}>
                {paymentStatus.trial_days_remaining > 0 ? `${paymentStatus.trial_days_remaining} ${t('dash_trial_days')}` : t('dash_trial_expired')}
              </Text>
              <View style={[s.trialBtn, { backgroundColor: theme.warning }]}><Text style={s.trialBtnText}>{t('dash_subscribe')}</Text></View>
            </TouchableOpacity>
          )}
          {paymentStatus?.is_premium && (
            <View style={[s.proBadge, { backgroundColor: `${theme.warning}1e`, borderColor: `${theme.warning}4d` }]}>
              <View style={[s.proBadgeGlow, { backgroundColor: `${theme.warning}14` }]} />
              <Ionicons name="diamond" size={16} color={theme.warning} />
              <Text style={[s.proBadgeText, { color: theme.warning }]}>NutriOS Pro</Text>
              <Ionicons name="checkmark-circle" size={16} color={theme.success} />
            </View>
          )}

          {/* ── View Mode Toggle ── */}
          <View style={s.viewToggleRow}>
            <TouchableOpacity
              style={[s.viewToggleBtn, viewMode === 'primary' && s.viewToggleBtnActive]}
              onPress={() => setViewMode('primary')}
            >
              <Ionicons name="flash" size={16} color={viewMode === 'primary' ? '#00d4ff' : '#666'} />
              <Text style={[s.viewToggleText, viewMode === 'primary' && s.viewToggleTextActive]}>Essential</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.viewToggleBtn, viewMode === 'detail' && s.viewToggleBtnActive]}
              onPress={() => setViewMode('detail')}
            >
              <Ionicons name="grid" size={16} color={viewMode === 'detail' ? '#00d4ff' : '#666'} />
              <Text style={[s.viewToggleText, viewMode === 'detail' && s.viewToggleTextActive]}>Full Dashboard</Text>
            </TouchableOpacity>
          </View>

          {/* ── PRIMARY VIEW (Zero Overload) ── */}
          {viewMode === 'primary' && (
            <View style={s.primaryContainer}>
              {/* Body State Summary */}
              <View style={[s.primaryCard, { backgroundColor: theme.bgCard }]}>
                <View style={s.primaryCardHeader}>
                  <Image source={require('../../assets/jaide/jaide-cartoon.png')} style={s.primaryJaideAvatar} />
                  <View style={s.primaryCardHeaderText}>
                    <Text style={[s.primaryLabel, { color: '#00d4ff' }]}>TODAY'S STATE</Text>
                    <Text style={[s.primaryNote, { color: theme.text }]} numberOfLines={2}>
                      {bodyState?.metabolic_note || 'Log your first meal to activate body state'}
                    </Text>
                  </View>
                </View>

                {/* Body State Indicators (compact) */}
                {bodyState?.body_state && (
                  <View style={s.primaryStateRow}>
                    {Object.entries(bodyState.body_state).slice(0, 4).map(([key, state]: [string, any]) => {
                      const levelColors: Record<string, string> = { high: '#00ff88', optimal: '#00ff88', stable: '#00ff88', satisfied: '#00ff88', moderate: '#ffd93d', normal: '#ffd93d', adequate: '#ffd93d', mild: '#ffd93d', low: '#ff6b6b', unstable: '#ff6b6b', crash_risk: '#e74c3c', foggy: '#e74c3c', insufficient: '#ff6b6b', unknown: '#555' };
                      const icons: Record<string, string> = { energy: '⚡', glycemic_stability: '📈', concentration: '🧠', hunger: '🍽️', recovery: '💪' };
                      const color = levelColors[state?.level] || '#555';
                      return (
                        <View key={key} style={s.primaryStateItem}>
                          <Text style={s.primaryStateIcon}>{icons[key] || '📊'}</Text>
                          <Text style={[s.primaryStateLevel, { color }]}>{(state?.level || 'N/A').toUpperCase()}</Text>
                          <Text style={s.primaryStateLabel}>{key === 'glycemic_stability' ? 'Glyc.' : key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Top Decision */}
              {bodyState?.decisions?.[0] && (
                <TouchableOpacity style={[s.primaryDecisionCard, { backgroundColor: theme.bgCard }]} onPress={() => router.push('/body-state' as any)}>
                  <Text style={s.primaryDecisionIcon}>{bodyState.decisions[0].icon}</Text>
                  <View style={s.primaryDecisionContent}>
                    <Text style={[s.primaryDecisionAction, { color: theme.text }]}>{bodyState.decisions[0].action}</Text>
                    <Text style={s.primaryDecisionReason}>{bodyState.decisions[0].reason}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#00d4ff" />
                </TouchableOpacity>
              )}

              {/* Nutrient Gaps (compact) */}
              <WidgetErrorBoundary widgetName="Nutrient Gaps">
                <WidgetNutrientGaps nutrients={dashboard?.nutrition?.nutrients} />
              </WidgetErrorBoundary>

              {/* Quick Actions */}
              <WidgetErrorBoundary widgetName="Quick Actions">
                <WidgetQuickActions onAddWater={quickAddWater} onLogMeal={() => setShowQuickMeal(true)} onScan={() => router.push('/scanner')} />
              </WidgetErrorBoundary>

              {/* Expand Button */}
              <TouchableOpacity style={[s.expandBtn, { backgroundColor: theme.bgCard }]} onPress={() => setViewMode('detail')}>
                <Ionicons name="layers" size={18} color="#00d4ff" />
                <Text style={s.expandBtnText}>View Full Dashboard</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── DETAIL VIEW (Full Widget Grid) ── */}
          {viewMode === 'detail' && widgets.filter(w => w.enabled).map(renderWidget)}

        </Animated.View>
      </ScrollView>

      {/* ── Quick Meal Modal ── */}
      <QuickMealModal visible={showQuickMeal} onClose={() => setShowQuickMeal(false)} onMealLogged={fetchDashboard} />

      {/* ── Customize Dashboard Modal ── */}
      <Modal visible={showCustomize} animationType="slide" transparent>
        <View style={s.custOverlay}>
          <View style={[s.custContent, { backgroundColor: theme.bgCard }]}>
            <View style={[s.custHeader, { borderBottomColor: theme.borderLight }]}>
              <Text style={[s.custTitle, { color: theme.text }]}>{t('dash_customize') || 'Customize Dashboard'}</Text>
              <TouchableOpacity style={[s.custSaveBtn, { backgroundColor: theme.accent }]} onPress={saveAndClose}>
                <Ionicons name="checkmark" size={20} color={theme.bg} />
                <Text style={[s.custSaveTxt, { color: theme.bg }]}>{t('common_save')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={[s.custSubtitle, { color: theme.textMuted }]}>{t('dash_cust_subtitle')}</Text>
            <ScrollView style={s.custScroll} showsVerticalScrollIndicator={false}>
              {editWidgets.map((w, i) => (
                <View key={w.id} style={[s.custRow, { backgroundColor: theme.bgSecondary, borderColor: `${theme.accent}14` }, !w.enabled && s.custRowOff]}>
                  <View style={s.custRowLeft}>
                    <View style={[s.custIcon, { backgroundColor: w.enabled ? `${theme.accent}1e` : `${theme.text}0a` }]}>
                      <Ionicons name={w.icon as any} size={18} color={w.enabled ? theme.accent : theme.textDim} />
                    </View>
                    <Text style={[s.custLabel, { color: theme.text }, !w.enabled && { color: theme.textDim }]}>{t(`widget_${w.id}`) || w.label}</Text>
                  </View>
                  <View style={s.custRowRight}>
                    <TouchableOpacity onPress={() => moveWidget(i, -1)} disabled={i === 0} style={s.arrowBtn}>
                      <Ionicons name="chevron-up" size={18} color={i === 0 ? theme.borderLight : theme.textMuted} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveWidget(i, 1)} disabled={i === editWidgets.length - 1} style={s.arrowBtn}>
                      <Ionicons name="chevron-down" size={18} color={i === editWidgets.length - 1 ? theme.borderLight : theme.textMuted} />
                    </TouchableOpacity>
                    <Switch value={w.enabled} onValueChange={v => toggleWidget(w.id, v)}
                      trackColor={{ false: theme.borderLight, true: `${theme.accent}59` }} thumbColor={w.enabled ? theme.accent : theme.textDim} />
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={s.custFooter}>
              <TouchableOpacity style={s.resetBtn} onPress={resetDefaults}>
                <Ionicons name="refresh" size={16} color={theme.textMuted} />
                <Text style={[s.resetText, { color: theme.textMuted }]}>{t('dash_cust_reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.custCloseBtn} onPress={() => setShowCustomize(false)}>
                <Text style={[s.custCloseTxt, { color: theme.danger }]}>{t('common_cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 100 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginHorizontal: 16, marginTop: 8, borderRadius: 10, gap: 8 },
  offlineText: { fontSize: 13, fontWeight: '500' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  greeting: { fontSize: 14 },
  userName: { fontSize: 26, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  customizeBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  profileBtn: { padding: 4, position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  avatarPro: { borderColor: '#ffd93d', borderWidth: 2 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  proBadgeSmall: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#ffd93d' },
  // Trial/Pro
  trialBadge: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 8, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1 },
  trialText: { flex: 1, fontSize: 13, fontWeight: '600', marginLeft: 8 },
  trialBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  trialBtnText: { fontSize: 12, fontWeight: '700', color: '#000' },
  proBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, position: 'relative', overflow: 'hidden' },
  proBadgeGlow: { position: 'absolute', width: 60, height: 60, borderRadius: 30, left: -10, top: -15 },
  proBadgeText: { fontSize: 14, fontWeight: '800', marginLeft: 8, marginRight: 8, letterSpacing: 0.5 },
  // Customize Modal
  custOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  custContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 20 },
  custHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  custTitle: { fontSize: 18, fontWeight: 'bold' },
  custSubtitle: { fontSize: 12, paddingHorizontal: 20, marginTop: 8 },
  custSaveBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, gap: 6 },
  custSaveTxt: { fontWeight: '700', fontSize: 14 },
  custScroll: { paddingHorizontal: 16, marginTop: 12, maxHeight: 420 },
  custRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1 },
  custRowOff: { borderColor: 'transparent', opacity: 0.6 },
  custRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  custIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  custLabel: { fontSize: 14, fontWeight: '500', flex: 1 },
  custRowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrowBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  custFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 12 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  resetText: { fontSize: 13, fontWeight: '500' },
  custCloseBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  custCloseTxt: { fontSize: 14, fontWeight: '600' },
  // View Toggle
  viewToggleRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 12, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 4 },
  viewToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
  viewToggleBtnActive: { backgroundColor: 'rgba(0, 212, 255, 0.12)' },
  viewToggleText: { fontSize: 13, fontWeight: '600', color: '#666' },
  viewToggleTextActive: { color: '#00d4ff' },
  // Primary View
  primaryContainer: { paddingHorizontal: 16, gap: 12 },
  primaryCard: { borderRadius: 18, padding: 18, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.1)' },
  primaryCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  primaryJaideAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.3)' },
  primaryCardHeaderText: { flex: 1, marginLeft: 12 },
  primaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  primaryNote: { fontSize: 14, fontWeight: '500', marginTop: 3, lineHeight: 18 },
  primaryStateRow: { flexDirection: 'row', justifyContent: 'space-between' },
  primaryStateItem: { alignItems: 'center', flex: 1 },
  primaryStateIcon: { fontSize: 20, marginBottom: 4 },
  primaryStateLevel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  primaryStateLabel: { fontSize: 10, color: '#666', marginTop: 2 },
  primaryDecisionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, borderLeftWidth: 3, borderLeftColor: '#00d4ff' },
  primaryDecisionIcon: { fontSize: 22, marginRight: 12 },
  primaryDecisionContent: { flex: 1 },
  primaryDecisionAction: { fontSize: 14, fontWeight: '600', lineHeight: 18 },
  primaryDecisionReason: { fontSize: 11, color: '#888', marginTop: 2 },
  expandBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.15)', borderStyle: 'dashed' },
  expandBtnText: { fontSize: 13, color: '#00d4ff', fontWeight: '600' },
});
