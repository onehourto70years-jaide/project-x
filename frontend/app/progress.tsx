import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, Dimensions, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BarChart, LineChart } from 'react-native-gifted-charts';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const screenWidth = Dimensions.get('window').width - 64;

export default function ProgressScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'nutrition' | 'water' | 'routines'>('nutrition');
  const [nutritionData, setNutritionData] = useState<any[]>([]);
  const [waterData, setWaterData] = useState<any[]>([]);
  const [routinesData, setRoutinesData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(7);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const [nutRes, watRes, routRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/progress/nutrition?days=${days}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/progress/water?days=${days}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/progress/routines?days=${days}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (nutRes.ok) {
        const data = await nutRes.json();
        setNutritionData(data.chart_data || []);
      }
      if (watRes.ok) {
        const data = await watRes.json();
        setWaterData(data.chart_data || []);
      }
      if (routRes.ok) {
        const data = await routRes.json();
        setRoutinesData(data.chart_data || []);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [days]));

  const formatLabel = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
  };

  const caloriesBarData = nutritionData.map(d => ({ value: d.calories || 0, label: formatLabel(d.date), frontColor: '#ff6b6b' }));
  const proteinBarData = nutritionData.map(d => ({ value: d.protein || 0, label: formatLabel(d.date), frontColor: '#00d4ff' }));
  const waterBarData = waterData.map(d => ({ value: (d.amount_ml || 0) / 1000, label: formatLabel(d.date), frontColor: '#00d4ff' }));
  const routineLineData = routinesData.map(d => ({ value: d.percentage || 0, label: formatLabel(d.date) }));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#00d4ff" />}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Progress Charts</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Period Selector */}
        <View style={styles.periodRow}>
          {[7, 14, 30].map((d) => (
            <TouchableOpacity key={d} style={[styles.periodBtn, days === d && styles.periodBtnActive]} onPress={() => setDays(d)}>
              <Text style={[styles.periodText, days === d && styles.periodTextActive]}>{d} days</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['nutrition', 'water', 'routines'] as const).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Ionicons name={tab === 'nutrition' ? 'nutrition' : tab === 'water' ? 'water' : 'calendar'} size={18} color={activeTab === tab ? '#00d4ff' : '#666'} />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Charts */}
        {activeTab === 'nutrition' && (
          <View>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Calories (kcal)</Text>
              {caloriesBarData.length > 0 ? (
                <BarChart data={caloriesBarData} width={screenWidth} height={180} barWidth={22} spacing={14} noOfSections={4} barBorderRadius={4} frontColor="#ff6b6b" yAxisTextStyle={{ color: '#888' }} xAxisLabelTextStyle={{ color: '#888' }} />
              ) : (
                <Text style={styles.noData}>No data available</Text>
              )}
            </View>
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>Protein (g)</Text>
              {proteinBarData.length > 0 ? (
                <BarChart data={proteinBarData} width={screenWidth} height={180} barWidth={22} spacing={14} noOfSections={4} barBorderRadius={4} frontColor="#00d4ff" yAxisTextStyle={{ color: '#888' }} xAxisLabelTextStyle={{ color: '#888' }} />
              ) : (
                <Text style={styles.noData}>No data available</Text>
              )}
            </View>
          </View>
        )}

        {activeTab === 'water' && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Water Intake (L)</Text>
            {waterBarData.length > 0 ? (
              <BarChart data={waterBarData} width={screenWidth} height={220} barWidth={28} spacing={18} noOfSections={4} barBorderRadius={4} frontColor="#00d4ff" yAxisTextStyle={{ color: '#888' }} xAxisLabelTextStyle={{ color: '#888' }} />
            ) : (
              <Text style={styles.noData}>No data available</Text>
            )}
          </View>
        )}

        {activeTab === 'routines' && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Routine Completion (%)</Text>
            {routineLineData.length > 0 ? (
              <LineChart data={routineLineData} width={screenWidth} height={220} spacing={40} color="#4ecdc4" thickness={3} dataPointsColor="#4ecdc4" yAxisTextStyle={{ color: '#888' }} xAxisLabelTextStyle={{ color: '#888' }} noOfSections={4} maxValue={100} />
            ) : (
              <Text style={styles.noData}>No data available</Text>
            )}
          </View>
        )}

        {/* Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Summary</Text>
          {activeTab === 'nutrition' && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{nutritionData.length > 0 ? Math.round(nutritionData.reduce((a, b) => a + (b.calories || 0), 0) / nutritionData.length) : 0}</Text>
                <Text style={styles.summaryLabel}>Avg Calories</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{nutritionData.length > 0 ? Math.round(nutritionData.reduce((a, b) => a + (b.protein || 0), 0) / nutritionData.length) : 0}g</Text>
                <Text style={styles.summaryLabel}>Avg Protein</Text>
              </View>
            </View>
          )}
          {activeTab === 'water' && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{waterData.length > 0 ? (waterData.reduce((a, b) => a + (b.amount_ml || 0), 0) / waterData.length / 1000).toFixed(1) : 0}L</Text>
                <Text style={styles.summaryLabel}>Avg Daily</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{waterData.filter(d => d.percentage >= 100).length}</Text>
                <Text style={styles.summaryLabel}>Goals Met</Text>
              </View>
            </View>
          )}
          {activeTab === 'routines' && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{routinesData.length > 0 ? Math.round(routinesData.reduce((a, b) => a + (b.percentage || 0), 0) / routinesData.length) : 0}%</Text>
                <Text style={styles.summaryLabel}>Avg Completion</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{routinesData.filter(d => d.percentage === 100).length}</Text>
                <Text style={styles.summaryLabel}>Perfect Days</Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  periodRow: { flexDirection: 'row', marginBottom: 16 },
  periodBtn: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#1a1a2e', marginHorizontal: 4, alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#00d4ff' },
  periodText: { color: '#888', fontWeight: '500' },
  periodTextActive: { color: '#fff' },
  tabs: { flexDirection: 'row', marginBottom: 20 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: '#1a1a2e', marginHorizontal: 4 },
  tabActive: { backgroundColor: 'rgba(0, 212, 255, 0.15)' },
  tabText: { color: '#666', marginLeft: 6, fontWeight: '500' },
  tabTextActive: { color: '#00d4ff' },
  chartCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 16 },
  noData: { color: '#666', textAlign: 'center', padding: 40 },
  summaryCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20 },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 24, fontWeight: 'bold', color: '#00d4ff' },
  summaryLabel: { fontSize: 12, color: '#888', marginTop: 4 },
});
