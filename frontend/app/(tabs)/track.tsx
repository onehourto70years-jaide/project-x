import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../src/LanguageContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Meal {
  id: string;
  food_name: string;
  portion_grams: number;
  meal_type: string;
  cooking_method: string;
  timestamp: string;
  nutrients: Record<string, number>;
  elements: Record<string, number>;
  allergens?: string[];
}

export default function TrackScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [totalElements, setTotalElements] = useState<Record<string, number>>({});
  const [period, setPeriod] = useState<'today' | 'week'>('today');

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      let url = '';
      if (period === 'today') {
        url = `${BACKEND_URL}/api/meals/today`;
      } else {
        url = `${BACKEND_URL}/api/meals/history?days=7`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const mealsList = data.meals || [];
        setMeals(mealsList);

        // Calculate totals
        const newTotals: Record<string, number> = {};
        const newElements: Record<string, number> = {};
        mealsList.forEach((meal: Meal) => {
          Object.entries(meal.nutrients || {}).forEach(([key, value]) => {
            newTotals[key] = (newTotals[key] || 0) + (value as number);
          });
          Object.entries(meal.elements || {}).forEach(([key, value]) => {
            newElements[key] = (newElements[key] || 0) + (value as number);
          });
        });
        setTotals(newTotals);
        setTotalElements(newElements);
      }
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [period])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return num < 1 ? num.toFixed(3) : num.toFixed(1);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition Tracking</Text>
        <Text style={styles.subtitle}>Monitor your molecular intake</Text>
      </View>

      {/* Period Tabs */}
      <View style={styles.periodTabs}>
        {(['today', 'week'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodTab, period === p && styles.periodTabActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
              {p === 'today' ? 'Today' : 'This Week'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00d4ff" />}
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>
            {period === 'today' ? "Today's" : 'This Week\'s'} Summary
          </Text>
          
          {/* Energy & Macros */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="flame" size={20} color="#ff6b6b" />
              <Text style={styles.summaryValue}>{formatNumber(totals.energy_kcal)}</Text>
              <Text style={styles.summaryLabel}>kcal</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="barbell" size={20} color="#00d4ff" />
              <Text style={styles.summaryValue}>{formatNumber(totals.protein_g)}</Text>
              <Text style={styles.summaryLabel}>Protein (g)</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="leaf" size={20} color="#4ecdc4" />
              <Text style={styles.summaryValue}>{formatNumber(totals.carbohydrate_g)}</Text>
              <Text style={styles.summaryLabel}>Carbs (g)</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="water" size={20} color="#ffd93d" />
              <Text style={styles.summaryValue}>{formatNumber(totals.fat_g)}</Text>
              <Text style={styles.summaryLabel}>Fat (g)</Text>
            </View>
          </View>

          {/* Elements Summary */}
          <View style={styles.elementsSummary}>
            <Text style={styles.elementsTitle}>Elemental Intake</Text>
            <View style={styles.elementsRow}>
              {['C', 'H', 'O', 'N'].map((el) => (
                <View key={el} style={styles.elementMini}>
                  <Text style={styles.elementSymbol}>{el}</Text>
                  <Text style={styles.elementAmount}>{formatNumber(totalElements[el])}g</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.mealsCount}>{meals.length} meals logged</Text>
        </View>

        {/* Quick Add Button */}
        <TouchableOpacity style={styles.quickAddButton} onPress={() => router.push('/(tabs)/nutrition')}>
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.quickAddText}>Add Food Entry</Text>
        </TouchableOpacity>

        {/* Recent Entries */}
        <View style={styles.entriesSection}>
          <Text style={styles.sectionTitle}>Recent Entries</Text>
          {meals.length > 0 ? (
            meals.slice().reverse().slice(0, 20).map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={styles.entryHeader}>
                  <View style={styles.entryIcon}>
                    <Ionicons name="restaurant" size={20} color="#00d4ff" />
                  </View>
                  <View style={styles.entryInfo}>
                    <Text style={styles.entryName}>{entry.food_name}</Text>
                    <Text style={styles.entryMeta}>
                      {entry.portion_grams}g • {entry.cooking_method}
                    </Text>
                  </View>
                  <Text style={styles.entryTime}>{formatDate(entry.timestamp)}</Text>
                </View>
                
                {/* Entry Nutrients */}
                <View style={styles.entryNutrients}>
                  <View style={styles.nutrientBadge}>
                    <Text style={styles.nutrientText}>{formatNumber(entry.nutrients?.energy_kcal)} kcal</Text>
                  </View>
                  <View style={styles.nutrientBadge}>
                    <Text style={styles.nutrientText}>{formatNumber(entry.nutrients?.protein_g)}g protein</Text>
                  </View>
                  {entry.allergens && entry.allergens.length > 0 && (
                    <View style={[styles.nutrientBadge, styles.allergenBadge]}>
                      <Ionicons name="warning" size={12} color="#ff6b6b" />
                      <Text style={styles.allergenText}>{entry.allergens.length} allergens</Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>No entries yet</Text>
              <Text style={styles.emptySubtext}>Start tracking your nutrition</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: { padding: 16, paddingTop: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  periodTabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  periodTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, backgroundColor: '#1a1a2e', marginHorizontal: 4 },
  periodTabActive: { backgroundColor: '#00d4ff' },
  periodTabText: { color: '#888', fontWeight: '500' },
  periodTabTextActive: { color: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  summaryCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  summaryLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  elementsSummary: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#2a2a4e' },
  elementsTitle: { fontSize: 14, color: '#888', marginBottom: 12 },
  elementsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  elementMini: { alignItems: 'center' },
  elementSymbol: { fontSize: 16, fontWeight: 'bold', color: '#00d4ff' },
  elementAmount: { fontSize: 12, color: '#fff', marginTop: 4 },
  mealsCount: { textAlign: 'center', color: '#888', marginTop: 16, fontSize: 12 },
  quickAddButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00d4ff', padding: 16, borderRadius: 12, marginBottom: 16 },
  quickAddText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  entriesSection: { marginTop: 8 },
  entryCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  entryHeader: { flexDirection: 'row', alignItems: 'center' },
  entryIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 212, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  entryInfo: { flex: 1, marginLeft: 12 },
  entryName: { fontSize: 15, fontWeight: '500', color: '#fff' },
  entryMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  entryTime: { fontSize: 11, color: '#666' },
  entryNutrients: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  nutrientBadge: { backgroundColor: 'rgba(0, 212, 255, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8, marginBottom: 4 },
  nutrientText: { color: '#00d4ff', fontSize: 11 },
  allergenBadge: { backgroundColor: 'rgba(255, 107, 107, 0.1)', flexDirection: 'row', alignItems: 'center' },
  allergenText: { color: '#ff6b6b', fontSize: 11, marginLeft: 4 },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#fff', fontSize: 16, marginTop: 16 },
  emptySubtext: { color: '#666', marginTop: 8 },
});
