import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Dimensions, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { useTheme } from './ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const screenWidth = Dimensions.get('window').width - 64;

export default function ProgressScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'nutrition' | 'water' | 'elements' | 'routines'>('nutrition');
  const [nutritionData, setNutritionData] = useState<any[]>([]);
  const [waterData, setWaterData] = useState<any[]>([]);
  const [routinesData, setRoutinesData] = useState<any[]>([]);
  const [elementsData, setElementsData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(7);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const headers = { 'Authorization': `Bearer ${token}` };

      const [nutRes, watRes, routRes, elemRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/progress/nutrition?days=${days}`, { headers }),
        fetch(`${BACKEND_URL}/api/progress/water?days=${days}`, { headers }),
        fetch(`${BACKEND_URL}/api/progress/routines?days=${days}`, { headers }),
        fetch(`${BACKEND_URL}/api/progress/elements?days=${days}`, { headers }).catch(() => null)
      ]);

      if (nutRes.ok) setNutritionData((await nutRes.json()).chart_data || []);
      if (watRes.ok) setWaterData((await watRes.json()).chart_data || []);
      if (routRes.ok) setRoutinesData((await routRes.json()).chart_data || []);
      if (elemRes && elemRes.ok) setElementsData((await elemRes.json()).chart_data || []);
      
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fadeAnim.setValue(0); fetchData(); }, [days]));

  const formatLabel = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
  };

  // Chart data preparation
  const caloriesBarData = nutritionData.map(d => ({
    value: d.calories || 0, label: formatLabel(d.date),
    frontColor: '#ff6b6b', gradientColor: '#ff9f43',
    topLabelComponent: () => <Text style={{ color: theme.textMuted, fontSize: 9, marginBottom: 4 }}>{Math.round(d.calories || 0)}</Text>
  }));
  
  const proteinLineData = nutritionData.map(d => ({ value: d.protein || 0, label: formatLabel(d.date), dataPointText: `${Math.round(d.protein || 0)}` }));
  const carbsLineData = nutritionData.map(d => ({ value: d.carbs || 0, label: formatLabel(d.date) }));
  const fatLineData = nutritionData.map(d => ({ value: d.fat || 0, label: formatLabel(d.date) }));

  const waterBarData = waterData.map(d => ({
    value: (d.amount_ml || 0) / 1000, label: formatLabel(d.date),
    frontColor: d.percentage >= 100 ? '#00ff88' : '#00d4ff',
    topLabelComponent: () => <Text style={{ color: theme.textMuted, fontSize: 9, marginBottom: 4 }}>{((d.amount_ml || 0) / 1000).toFixed(1)}L</Text>
  }));

  const routineLineData = routinesData.map(d => ({ value: d.percentage || 0, label: formatLabel(d.date) }));

  // Stats
  const avgCalories = nutritionData.length > 0 ? Math.round(nutritionData.reduce((a, b) => a + (b.calories || 0), 0) / nutritionData.length) : 0;
  const avgProtein = nutritionData.length > 0 ? Math.round(nutritionData.reduce((a, b) => a + (b.protein || 0), 0) / nutritionData.length) : 0;
  const avgWater = waterData.length > 0 ? (waterData.reduce((a, b) => a + (b.amount_ml || 0), 0) / waterData.length / 1000).toFixed(1) : '0';
  const waterGoalsMet = waterData.filter(d => (d.percentage || 0) >= 100).length;
  const avgRoutine = routinesData.length > 0 ? Math.round(routinesData.reduce((a, b) => a + (b.percentage || 0), 0) / routinesData.length) : 0;
  const perfectRoutineDays = routinesData.filter(d => (d.percentage || 0) === 100).length;

  const TABS = [
    { key: 'nutrition', label: 'Nutrition', icon: 'nutrition' },
    { key: 'water', label: 'Water', icon: 'water' },
    { key: 'elements', label: 'Elements', icon: 'flask' },
    { key: 'routines', label: 'Routines', icon: 'calendar' },
  ] as const;

  const chartProps = {
    yAxisTextStyle: { color: theme.textMuted, fontSize: 10 },
    xAxisLabelTextStyle: { color: theme.textMuted, fontSize: 10 },
    rulesColor: theme.borderLight,
    backgroundColor: 'transparent',
    isAnimated: true,
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>  
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.bgCard }]}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Period Selector */}
      <View style={styles.periodRow}>
        {[7, 14, 30].map((d) => (
          <TouchableOpacity key={d}
            style={[styles.periodBtn, { backgroundColor: theme.bgCard }, days === d && { backgroundColor: theme.accent }]}
            onPress={() => setDays(d)}>
            <Text style={[styles.periodText, { color: theme.textMuted }, days === d && { color: '#fff' }]}>
              {d}d
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab.key}
            style={[styles.tab, { backgroundColor: theme.bgCard }, activeTab === tab.key && { backgroundColor: theme.accentGlow, borderColor: theme.accent, borderWidth: 1 }]}
            onPress={() => setActiveTab(tab.key)}>
            <Ionicons name={tab.icon as any} size={16} color={activeTab === tab.key ? theme.accent : theme.textMuted} />
            <Text style={[styles.tabText, { color: theme.textMuted }, activeTab === tab.key && { color: theme.accent }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>

          {/* NUTRITION TAB */}
          {activeTab === 'nutrition' && (
            <>
              {/* Stats Cards */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                  <Ionicons name="flame" size={20} color="#ff6b6b" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{avgCalories}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>Avg kcal/day</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                  <Ionicons name="barbell" size={20} color="#00d4ff" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{avgProtein}g</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>Avg protein/day</Text>
                </View>
              </View>

              {/* Calories Chart */}
              <View style={[styles.chartCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <Text style={[styles.chartTitle, { color: theme.text }]}>
                  <Ionicons name="flame" size={14} color="#ff6b6b" /> Daily Calories
                </Text>
                {caloriesBarData.length > 0 ? (
                  <BarChart data={caloriesBarData} width={screenWidth} height={180} barWidth={days <= 7 ? 28 : days <= 14 ? 18 : 10}
                    spacing={days <= 7 ? 18 : days <= 14 ? 12 : 8} noOfSections={4} barBorderRadius={6}
                    {...chartProps} />
                ) : (
                  <View style={styles.emptyChart}>
                    <Ionicons name="analytics-outline" size={40} color={theme.textDim} />
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No data yet. Start logging meals!</Text>
                  </View>
                )}
              </View>

              {/* Macros Chart */}
              <View style={[styles.chartCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <Text style={[styles.chartTitle, { color: theme.text }]}>Macronutrients Trend</Text>
                <View style={styles.legendRow}>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#00d4ff' }]} /><Text style={[styles.legendText, { color: theme.textMuted }]}>Protein</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ffd93d' }]} /><Text style={[styles.legendText, { color: theme.textMuted }]}>Carbs</Text></View>
                  <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: '#ff9f43' }]} /><Text style={[styles.legendText, { color: theme.textMuted }]}>Fat</Text></View>
                </View>
                {proteinLineData.length > 0 ? (
                  <LineChart data={proteinLineData} data2={carbsLineData} data3={fatLineData}
                    width={screenWidth} height={180} spacing={days <= 7 ? 40 : days <= 14 ? 22 : 10}
                    color="#00d4ff" color2="#ffd93d" color3="#ff9f43"
                    thickness={2} thickness2={2} thickness3={2}
                    dataPointsColor="#00d4ff" dataPointsColor2="#ffd93d" dataPointsColor3="#ff9f43"
                    noOfSections={4} curved hideDataPoints={days > 14}
                    {...chartProps} />
                ) : (
                  <View style={styles.emptyChart}>
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No macro data yet</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* WATER TAB */}
          {activeTab === 'water' && (
            <>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                  <Ionicons name="water" size={20} color="#00d4ff" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{avgWater}L</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>Avg daily</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                  <Ionicons name="checkmark-circle" size={20} color="#00ff88" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{waterGoalsMet}/{waterData.length}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>Goals met</Text>
                </View>
              </View>

              <View style={[styles.chartCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <Text style={[styles.chartTitle, { color: theme.text }]}>
                  <Ionicons name="water" size={14} color="#00d4ff" /> Water Intake (L)
                </Text>
                {waterBarData.length > 0 ? (
                  <BarChart data={waterBarData} width={screenWidth} height={200} barWidth={days <= 7 ? 28 : days <= 14 ? 18 : 10}
                    spacing={days <= 7 ? 18 : days <= 14 ? 12 : 8} noOfSections={4} barBorderRadius={6}
                    {...chartProps} />
                ) : (
                  <View style={styles.emptyChart}>
                    <Ionicons name="water-outline" size={40} color={theme.textDim} />
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No water data yet</Text>
                  </View>
                )}
              </View>
            </>
          )}

          {/* ELEMENTS TAB */}
          {activeTab === 'elements' && (
            <>
              <View style={[styles.infoCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <Ionicons name="flask" size={20} color={theme.accent} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                  Track your daily elemental composition — the building blocks of nutrition at the atomic level.
                </Text>
              </View>

              {elementsData.length > 0 ? (
                ['C', 'H', 'O', 'N'].map((element) => {
                  const colors: Record<string, string> = { C: '#00d4ff', H: '#00ff88', O: '#ff6b6b', N: '#a29bfe' };
                  const names: Record<string, string> = { C: 'Carbon', H: 'Hydrogen', O: 'Oxygen', N: 'Nitrogen' };
                  const elementChartData = elementsData.map(d => ({
                    value: d[element] || 0, label: formatLabel(d.date),
                    frontColor: colors[element],
                  }));
                  return (
                    <View key={element} style={[styles.chartCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                      <View style={styles.elementChartHeader}>
                        <View style={[styles.elementBadge, { backgroundColor: colors[element] + '20' }]}>
                          <Text style={[styles.elementSymbol, { color: colors[element] }]}>{element}</Text>
                        </View>
                        <Text style={[styles.chartTitle, { color: theme.text, marginBottom: 0 }]}>{names[element]} Intake (g)</Text>
                      </View>
                      <BarChart data={elementChartData} width={screenWidth} height={140} barWidth={days <= 7 ? 24 : 14}
                        spacing={days <= 7 ? 18 : 10} noOfSections={3} barBorderRadius={4}
                        {...chartProps} />
                    </View>
                  );
                })
              ) : (
                <View style={[styles.emptyChart, { backgroundColor: theme.bgCard, borderRadius: 16, padding: 40 }]}>
                  <Ionicons name="flask-outline" size={48} color={theme.textDim} />
                  <Text style={[styles.emptyText, { color: theme.textMuted }]}>Log meals to see elemental breakdown</Text>
                </View>
              )}
            </>
          )}

          {/* ROUTINES TAB */}
          {activeTab === 'routines' && (
            <>
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                  <Ionicons name="stats-chart" size={20} color="#4ecdc4" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{avgRoutine}%</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>Avg completion</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                  <Ionicons name="star" size={20} color="#ffd93d" />
                  <Text style={[styles.statValue, { color: theme.text }]}>{perfectRoutineDays}</Text>
                  <Text style={[styles.statLabel, { color: theme.textMuted }]}>Perfect days</Text>
                </View>
              </View>

              <View style={[styles.chartCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <Text style={[styles.chartTitle, { color: theme.text }]}>
                  <Ionicons name="calendar" size={14} color="#4ecdc4" /> Routine Completion (%)
                </Text>
                {routineLineData.length > 0 ? (
                  <LineChart data={routineLineData} width={screenWidth} height={200} spacing={days <= 7 ? 40 : days <= 14 ? 22 : 10}
                    color="#4ecdc4" thickness={3} dataPointsColor="#4ecdc4"
                    noOfSections={4} maxValue={100} curved
                    areaChart startFillColor="rgba(78, 205, 196, 0.2)" endFillColor="rgba(78, 205, 196, 0)"
                    {...chartProps} />
                ) : (
                  <View style={styles.emptyChart}>
                    <Ionicons name="calendar-outline" size={40} color={theme.textDim} />
                    <Text style={[styles.emptyText, { color: theme.textMuted }]}>No routine data yet</Text>
                  </View>
                )}
              </View>
            </>
          )}

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  periodRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12 },
  periodBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, marginRight: 8 },
  periodText: { fontWeight: '600', fontSize: 14 },
  tabsScroll: { paddingHorizontal: 16, marginBottom: 16 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  tabText: { marginLeft: 6, fontWeight: '500', fontSize: 13 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  statsRow: { flexDirection: 'row', marginBottom: 16 },
  statCard: { flex: 1, borderRadius: 14, padding: 16, marginHorizontal: 4, alignItems: 'center', borderWidth: 1 },
  statValue: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  statLabel: { fontSize: 11, marginTop: 4, fontWeight: '500' },
  chartCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  chartTitle: { fontSize: 15, fontWeight: '600', marginBottom: 16 },
  legendRow: { flexDirection: 'row', marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12 },
  elementChartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  elementBadge: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  elementSymbol: { fontSize: 18, fontWeight: '900' },
  infoCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1 },
  infoText: { flex: 1, marginLeft: 12, fontSize: 13, lineHeight: 20 },
  emptyChart: { alignItems: 'center', padding: 30 },
  emptyText: { marginTop: 12, fontSize: 14, textAlign: 'center' },
});
