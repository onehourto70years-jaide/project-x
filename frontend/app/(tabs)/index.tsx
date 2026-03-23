import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface DashboardData {
  date: string;
  user: { name: string; weight_kg: number; activity_level: string };
  nutrition: {
    calories: { current: number; goal: number; percentage: number };
    protein: { current: number; goal: number; percentage: number };
    carbs: { current: number };
    fat: { current: number };
    deficiencies: string[];
    meals_count: number;
  };
  hydration: { current_ml: number; goal_ml: number; percentage: number; logs_count: number };
  routines: { completed: number; total: number; percentage: number; streak_days: number; today_routines: any[] };
  elements: Record<string, number>;
  recent_meals: any[];
  insights: any[];
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDashboard(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return num < 1 ? num.toFixed(2) : num.toFixed(0);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const ProgressRing = ({ percentage, color, size = 80, strokeWidth = 8 }: { percentage: number; color: string; size?: number; strokeWidth?: number }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    return (
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: size/2, borderWidth: strokeWidth, borderColor: color + '30' }} />
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: size/2, borderWidth: strokeWidth, borderColor: color, borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: `${(percentage / 100) * 360 - 90}deg` }] }} />
        <Text style={{ fontSize: size * 0.2, fontWeight: 'bold', color: '#fff' }}>{Math.round(percentage)}%</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00d4ff" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={18} color="#ff6b6b" />
            <Text style={styles.streakText}>{dashboard?.routines?.streak_days || 0} days</Text>
          </View>
        </View>

        {/* Quick Stats Row */}
        <View style={styles.quickStats}>
          <TouchableOpacity style={styles.quickStatCard} onPress={() => router.push('/(tabs)/nutrition')}>
            <View style={[styles.quickStatIcon, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}>
              <Ionicons name="flame" size={20} color="#ff6b6b" />
            </View>
            <Text style={styles.quickStatValue}>{formatNumber(dashboard?.nutrition?.calories?.current)}</Text>
            <Text style={styles.quickStatLabel}>kcal</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickStatCard} onPress={() => router.push('/(tabs)/water')}>
            <View style={[styles.quickStatIcon, { backgroundColor: 'rgba(0, 212, 255, 0.1)' }]}>
              <Ionicons name="water" size={20} color="#00d4ff" />
            </View>
            <Text style={styles.quickStatValue}>{formatNumber((dashboard?.hydration?.current_ml || 0) / 1000)}L</Text>
            <Text style={styles.quickStatLabel}>water</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickStatCard} onPress={() => router.push('/(tabs)/routines')}>
            <View style={[styles.quickStatIcon, { backgroundColor: 'rgba(78, 205, 196, 0.1)' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#4ecdc4" />
            </View>
            <Text style={styles.quickStatValue}>{dashboard?.routines?.completed || 0}/{dashboard?.routines?.total || 0}</Text>
            <Text style={styles.quickStatLabel}>tasks</Text>
          </TouchableOpacity>
        </View>

        {/* Main Progress Cards */}
        <View style={styles.progressSection}>
          {/* Nutrition Progress */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Nutrition</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/nutrition')}>
                <Ionicons name="arrow-forward" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.progressContent}>
              <View style={styles.macroProgress}>
                <View style={styles.macroItem}>
                  <View style={styles.macroBar}>
                    <View style={[styles.macroFill, { width: `${Math.min(dashboard?.nutrition?.calories?.percentage || 0, 100)}%`, backgroundColor: '#ff6b6b' }]} />
                  </View>
                  <Text style={styles.macroLabel}>Calories</Text>
                  <Text style={styles.macroValue}>{formatNumber(dashboard?.nutrition?.calories?.current)}/{dashboard?.nutrition?.calories?.goal}</Text>
                </View>
                <View style={styles.macroItem}>
                  <View style={styles.macroBar}>
                    <View style={[styles.macroFill, { width: `${Math.min(dashboard?.nutrition?.protein?.percentage || 0, 100)}%`, backgroundColor: '#00d4ff' }]} />
                  </View>
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={styles.macroValue}>{formatNumber(dashboard?.nutrition?.protein?.current)}g/{dashboard?.nutrition?.protein?.goal}g</Text>
                </View>
              </View>
            </View>
            {dashboard?.nutrition?.deficiencies && dashboard.nutrition.deficiencies.length > 0 && (
              <View style={styles.deficiencyAlert}>
                <Ionicons name="warning" size={14} color="#ffd93d" />
                <Text style={styles.deficiencyText}>Low: {dashboard.nutrition.deficiencies.slice(0, 2).join(', ')}</Text>
              </View>
            )}
          </View>

          {/* Hydration Progress */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>Hydration</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/water')}>
                <Ionicons name="arrow-forward" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.hydrationContent}>
              <View style={styles.waterGauge}>
                <View style={[styles.waterFill, { height: `${Math.min(dashboard?.hydration?.percentage || 0, 100)}%` }]} />
                <Text style={styles.waterPercent}>{Math.round(dashboard?.hydration?.percentage || 0)}%</Text>
              </View>
              <View style={styles.waterInfo}>
                <Text style={styles.waterAmount}>{((dashboard?.hydration?.current_ml || 0) / 1000).toFixed(1)}L</Text>
                <Text style={styles.waterGoal}>of {((dashboard?.hydration?.goal_ml || 2500) / 1000).toFixed(1)}L goal</Text>
                <TouchableOpacity style={styles.quickAddWater} onPress={() => router.push('/(tabs)/water')}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.quickAddText}>Add Water</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* AI Insights */}
        {dashboard?.insights && dashboard.insights.length > 0 && (
          <View style={styles.insightsCard}>
            <View style={styles.insightsHeader}>
              <Ionicons name="sparkles" size={18} color="#ffd93d" />
              <Text style={styles.insightsTitle}>AI Insights</Text>
            </View>
            {dashboard.insights.slice(0, 3).map((insight: any, index: number) => (
              <View key={index} style={styles.insightItem}>
                <View style={[styles.insightDot, { backgroundColor: insight.priority === 'high' ? '#ff6b6b' : '#4ecdc4' }]} />
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightMessage}>{insight.message}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.viewAllInsights} onPress={() => router.push('/(tabs)/ai')}>
              <Text style={styles.viewAllText}>View All Insights</Text>
              <Ionicons name="arrow-forward" size={16} color="#00d4ff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Today's Routines */}
        <View style={styles.routinesCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Today's Routines</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/routines')}>
              <Ionicons name="arrow-forward" size={20} color="#666" />
            </TouchableOpacity>
          </View>
          {dashboard?.routines?.today_routines && dashboard.routines.today_routines.length > 0 ? (
            dashboard.routines.today_routines.slice(0, 3).map((routine: any, index: number) => (
              <View key={index} style={styles.routineItem}>
                <View style={[styles.routineIcon, { backgroundColor: routine.type === 'morning' ? 'rgba(255, 217, 61, 0.1)' : routine.type === 'workout' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(78, 205, 196, 0.1)' }]}>
                  <Ionicons name={routine.type === 'morning' ? 'sunny' : routine.type === 'workout' ? 'barbell' : 'moon'} size={18} color={routine.type === 'morning' ? '#ffd93d' : routine.type === 'workout' ? '#ff6b6b' : '#4ecdc4'} />
                </View>
                <View style={styles.routineInfo}>
                  <Text style={styles.routineName}>{routine.name}</Text>
                  <Text style={styles.routineTime}>{routine.time_start} - {routine.time_end}</Text>
                </View>
                <Text style={styles.routineProgress}>{routine.tasks?.filter((t: any) => t.completed).length || 0}/{routine.tasks?.length || 0}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyRoutines}>
              <Text style={styles.emptyText}>No routines for today</Text>
              <TouchableOpacity style={styles.addRoutineBtn} onPress={() => router.push('/(tabs)/routines')}>
                <Text style={styles.addRoutineText}>Create Routine</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Elemental Summary */}
        <View style={styles.elementsCard}>
          <Text style={styles.progressTitle}>Elemental Intake Today</Text>
          <View style={styles.elementsGrid}>
            {['C', 'H', 'O', 'N', 'Fe', 'Ca', 'Mg', 'Zn'].map((el) => (
              <View key={el} style={styles.elementItem}>
                <View style={[styles.elementBadge, { backgroundColor: getElementColor(el) }]}>
                  <Text style={styles.elementSymbol}>{el}</Text>
                </View>
                <Text style={styles.elementValue}>{formatNumber(dashboard?.elements?.[el] || 0)}g</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getElementColor = (el: string) => {
  const colors: Record<string, string> = { 'C': '#444', 'H': '#00d4ff', 'O': '#ff6b6b', 'N': '#4ecdc4', 'S': '#ffd93d', 'Fe': '#ff6b6b', 'Ca': '#74b9ff', 'Mg': '#4ecdc4', 'Zn': '#a29bfe', 'K': '#ffd93d' };
  return colors[el] || '#666';
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  greeting: { fontSize: 14, color: '#888' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 107, 107, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  streakText: { color: '#ff6b6b', fontSize: 12, fontWeight: '600', marginLeft: 4 },
  quickStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  quickStatCard: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginHorizontal: 4, alignItems: 'center' },
  quickStatIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickStatValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  quickStatLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  progressSection: { flexDirection: 'row', marginBottom: 16 },
  progressCard: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginHorizontal: 4 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  progressTitle: { fontSize: 14, fontWeight: '600', color: '#fff' },
  progressContent: { flex: 1 },
  macroProgress: {},
  macroItem: { marginBottom: 12 },
  macroBar: { height: 6, backgroundColor: '#2a2a4e', borderRadius: 3, marginBottom: 4 },
  macroFill: { height: 6, borderRadius: 3 },
  macroLabel: { fontSize: 11, color: '#888' },
  macroValue: { fontSize: 11, color: '#fff' },
  deficiencyAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 217, 61, 0.1)', padding: 8, borderRadius: 8, marginTop: 8 },
  deficiencyText: { color: '#ffd93d', fontSize: 11, marginLeft: 6, flex: 1 },
  hydrationContent: { flexDirection: 'row', alignItems: 'center' },
  waterGauge: { width: 50, height: 80, backgroundColor: '#2a2a4e', borderRadius: 25, overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center' },
  waterFill: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#00d4ff' },
  waterPercent: { position: 'absolute', color: '#fff', fontSize: 12, fontWeight: 'bold' },
  waterInfo: { flex: 1, marginLeft: 12 },
  waterAmount: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  waterGoal: { fontSize: 11, color: '#888' },
  quickAddWater: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00d4ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 8, alignSelf: 'flex-start' },
  quickAddText: { color: '#fff', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  insightsCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  insightsTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginLeft: 8 },
  insightItem: { flexDirection: 'row', marginBottom: 12 },
  insightDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, marginRight: 10 },
  insightContent: { flex: 1 },
  insightTitle: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 2 },
  insightMessage: { fontSize: 12, color: '#888', lineHeight: 16 },
  viewAllInsights: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a2a4e' },
  viewAllText: { color: '#00d4ff', fontSize: 13, marginRight: 4 },
  routinesCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 16 },
  routineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a4e' },
  routineIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  routineInfo: { flex: 1, marginLeft: 12 },
  routineName: { fontSize: 14, fontWeight: '500', color: '#fff' },
  routineTime: { fontSize: 11, color: '#888' },
  routineProgress: { fontSize: 13, color: '#4ecdc4', fontWeight: '600' },
  emptyRoutines: { alignItems: 'center', padding: 20 },
  emptyText: { color: '#666', marginBottom: 12 },
  addRoutineBtn: { backgroundColor: '#00d4ff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addRoutineText: { color: '#fff', fontWeight: '600' },
  elementsCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16 },
  elementsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 12 },
  elementItem: { width: '22%', alignItems: 'center', marginBottom: 12 },
  elementBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  elementSymbol: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  elementValue: { fontSize: 10, color: '#888' },
});
