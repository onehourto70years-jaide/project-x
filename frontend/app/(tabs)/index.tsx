import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface DailyLog {
  date: string;
  total_nutrients: Record<string, number>;
  total_elements: Record<string, number>;
  foods: Array<{ food_name: string; portion_grams: number; timestamp: string }>;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDailyLog = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/tracking/daily`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDailyLog(data);
      }
    } catch (error) {
      console.error('Error fetching daily log:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDailyLog();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDailyLog();
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return num < 1 ? num.toFixed(3) : num.toFixed(1);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
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
          <View style={styles.dateContainer}>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
          </View>
        </View>

        {/* Today's Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Today's Nutrition</Text>
          
          {/* Macros */}
          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{formatNumber(dailyLog?.total_nutrients?.energy_kcal)}</Text>
              <Text style={styles.macroLabel}>kcal</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{formatNumber(dailyLog?.total_nutrients?.protein_g)}</Text>
              <Text style={styles.macroLabel}>Protein (g)</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{formatNumber(dailyLog?.total_nutrients?.carbohydrate_g)}</Text>
              <Text style={styles.macroLabel}>Carbs (g)</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{formatNumber(dailyLog?.total_nutrients?.fat_g)}</Text>
              <Text style={styles.macroLabel}>Fat (g)</Text>
            </View>
          </View>
        </View>

        {/* Elemental Composition */}
        <View style={styles.elementsCard}>
          <Text style={styles.sectionTitle}>Elemental Composition (grams)</Text>
          <View style={styles.elementsGrid}>
            {['C', 'H', 'O', 'N', 'S'].map((element) => (
              <View key={element} style={styles.elementItem}>
                <View style={[styles.elementBadge, { backgroundColor: getElementColor(element) }]}>
                  <Text style={styles.elementSymbol}>{element}</Text>
                </View>
                <Text style={styles.elementValue}>{formatNumber(dailyLog?.total_elements?.[element])}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Minerals */}
        <View style={styles.mineralsCard}>
          <Text style={styles.sectionTitle}>Key Minerals (mg)</Text>
          <View style={styles.mineralsGrid}>
            {[
              { key: 'iron_mg', label: 'Iron', color: '#ff6b6b' },
              { key: 'magnesium_mg', label: 'Mg', color: '#4ecdc4' },
              { key: 'potassium_mg', label: 'K', color: '#ffd93d' },
              { key: 'zinc_mg', label: 'Zinc', color: '#a29bfe' },
              { key: 'calcium_mg', label: 'Ca', color: '#74b9ff' },
            ].map((mineral) => (
              <View key={mineral.key} style={styles.mineralItem}>
                <View style={[styles.mineralIcon, { backgroundColor: mineral.color + '20' }]}>
                  <Ionicons name="ellipse" size={16} color={mineral.color} />
                </View>
                <View>
                  <Text style={styles.mineralValue}>{formatNumber(dailyLog?.total_nutrients?.[mineral.key])}</Text>
                  <Text style={styles.mineralLabel}>{mineral.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Vitamins */}
        <View style={styles.vitaminsCard}>
          <Text style={styles.sectionTitle}>Vitamins</Text>
          <View style={styles.vitaminsGrid}>
            {[
              { key: 'vitamin_a_mcg', label: 'A', unit: 'mcg' },
              { key: 'vitamin_c_mg', label: 'C', unit: 'mg' },
              { key: 'vitamin_d_mcg', label: 'D', unit: 'mcg' },
              { key: 'vitamin_b6_mg', label: 'B6', unit: 'mg' },
              { key: 'vitamin_b12_mcg', label: 'B12', unit: 'mcg' },
              { key: 'folate_mcg', label: 'Folate', unit: 'mcg' },
            ].map((vitamin) => (
              <View key={vitamin.key} style={styles.vitaminItem}>
                <Text style={styles.vitaminLabel}>{vitamin.label}</Text>
                <Text style={styles.vitaminValue}>
                  {formatNumber(dailyLog?.total_nutrients?.[vitamin.key])} {vitamin.unit}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Recent Foods */}
        <View style={styles.recentFoodsCard}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionTitle}>Today's Foods</Text>
            <Text style={styles.foodCount}>{dailyLog?.foods?.length || 0} items</Text>
          </View>
          {dailyLog?.foods && dailyLog.foods.length > 0 ? (
            dailyLog.foods.slice(0, 5).map((food, index) => (
              <View key={index} style={styles.foodItem}>
                <Ionicons name="restaurant" size={20} color="#00d4ff" />
                <View style={styles.foodInfo}>
                  <Text style={styles.foodName}>{food.food_name}</Text>
                  <Text style={styles.foodPortion}>{food.portion_grams}g</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={40} color="#444" />
              <Text style={styles.emptyText}>No foods logged today</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => router.push('/(tabs)/search')}>
                <Text style={styles.addButtonText}>Add Food</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getElementColor = (element: string) => {
  const colors: Record<string, string> = {
    'C': '#444', 'H': '#00d4ff', 'O': '#ff6b6b', 'N': '#4ecdc4', 'S': '#ffd93d'
  };
  return colors[element] || '#666';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  greeting: {
    fontSize: 14,
    color: '#888',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateContainer: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dateText: {
    color: '#00d4ff',
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  macroLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  elementsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  elementsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  elementItem: {
    alignItems: 'center',
  },
  elementBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  elementSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  elementValue: {
    fontSize: 14,
    color: '#fff',
  },
  mineralsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  mineralsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mineralItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 12,
  },
  mineralIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  mineralValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  mineralLabel: {
    fontSize: 11,
    color: '#888',
  },
  vitaminsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  vitaminsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  vitaminItem: {
    width: '33%',
    alignItems: 'center',
    marginBottom: 16,
  },
  vitaminLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00d4ff',
    marginBottom: 4,
  },
  vitaminValue: {
    fontSize: 12,
    color: '#fff',
  },
  recentFoodsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  foodCount: {
    fontSize: 12,
    color: '#888',
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  foodInfo: {
    marginLeft: 12,
    flex: 1,
  },
  foodName: {
    fontSize: 14,
    color: '#fff',
  },
  foodPortion: {
    fontSize: 12,
    color: '#888',
  },
  emptyState: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: '#666',
    marginTop: 12,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#00d4ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
