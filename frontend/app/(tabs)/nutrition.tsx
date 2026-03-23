import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, TextInput, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Meal {
  id: string;
  food_name: string;
  portion_grams: number;
  meal_type: string;
  cooking_method: string;
  nutrients: Record<string, number>;
  timestamp: string;
}

interface FoodItem {
  fdc_id: number;
  description: string;
  brand_owner?: string;
  data_type?: string;
}

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sunny', color: '#ffd93d' },
  { id: 'lunch', label: 'Lunch', icon: 'restaurant', color: '#4ecdc4' },
  { id: 'dinner', label: 'Dinner', icon: 'moon', color: '#a29bfe' },
  { id: 'snack', label: 'Snack', icon: 'cafe', color: '#ff6b6b' },
];

export default function NutritionScreen() {
  const router = useRouter();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');

  const fetchMeals = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/meals/today`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setMeals(data.meals || []);
        
        // Calculate totals
        const newTotals: Record<string, number> = {};
        (data.meals || []).forEach((meal: Meal) => {
          Object.entries(meal.nutrients || {}).forEach(([key, value]) => {
            newTotals[key] = (newTotals[key] || 0) + (value as number);
          });
        });
        setTotals(newTotals);
      }
    } catch (error) {
      console.error('Error fetching meals:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchMeals(); }, []));

  const searchFoods = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/foods/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, page_size: 15 })
      });
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.foods || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleFoodSelect = (food: FoodItem) => {
    setShowSearchModal(false);
    router.push({
      pathname: '/food-details',
      params: { fdc_id: food.fdc_id, food_name: food.description, meal_type: selectedMealType }
    });
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return num < 1 ? num.toFixed(2) : num.toFixed(0);
  };

  const getMealTypeInfo = (type: string) => MEAL_TYPES.find(t => t.id === type) || MEAL_TYPES[0];

  const getMealsByType = (type: string) => meals.filter(m => m.meal_type === type);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMeals(); }} tintColor="#00d4ff" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Nutrition</Text>
            <Text style={styles.subtitle}>Track your daily intake</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowSearchModal(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Today's Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Today's Summary</Text>
          <View style={styles.macrosRow}>
            <View style={styles.macroItem}>
              <View style={[styles.macroIcon, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]}>
                <Ionicons name="flame" size={20} color="#ff6b6b" />
              </View>
              <Text style={styles.macroValue}>{formatNumber(totals.energy_kcal)}</Text>
              <Text style={styles.macroLabel}>kcal</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroIcon, { backgroundColor: 'rgba(0, 212, 255, 0.1)' }]}>
                <Ionicons name="barbell" size={20} color="#00d4ff" />
              </View>
              <Text style={styles.macroValue}>{formatNumber(totals.protein_g)}g</Text>
              <Text style={styles.macroLabel}>Protein</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroIcon, { backgroundColor: 'rgba(78, 205, 196, 0.1)' }]}>
                <Ionicons name="leaf" size={20} color="#4ecdc4" />
              </View>
              <Text style={styles.macroValue}>{formatNumber(totals.carbohydrate_g)}g</Text>
              <Text style={styles.macroLabel}>Carbs</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroIcon, { backgroundColor: 'rgba(255, 217, 61, 0.1)' }]}>
                <Ionicons name="water" size={20} color="#ffd93d" />
              </View>
              <Text style={styles.macroValue}>{formatNumber(totals.fat_g)}g</Text>
              <Text style={styles.macroLabel}>Fat</Text>
            </View>
          </View>
        </View>

        {/* Micronutrients */}
        <View style={styles.microCard}>
          <Text style={styles.cardTitle}>Micronutrients</Text>
          <View style={styles.microGrid}>
            {[
              { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg', rec: 90 },
              { key: 'vitamin_a_mcg', label: 'Vitamin A', unit: 'mcg', rec: 900 },
              { key: 'iron_mg', label: 'Iron', unit: 'mg', rec: 18 },
              { key: 'calcium_mg', label: 'Calcium', unit: 'mg', rec: 1000 },
              { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg', rec: 400 },
              { key: 'zinc_mg', label: 'Zinc', unit: 'mg', rec: 11 },
            ].map((micro) => {
              const value = totals[micro.key] || 0;
              const pct = Math.min((value / micro.rec) * 100, 100);
              return (
                <View key={micro.key} style={styles.microItem}>
                  <View style={styles.microHeader}>
                    <Text style={styles.microLabel}>{micro.label}</Text>
                    <Text style={styles.microValue}>{formatNumber(value)}{micro.unit}</Text>
                  </View>
                  <View style={styles.microBar}>
                    <View style={[styles.microFill, { width: `${pct}%`, backgroundColor: pct < 50 ? '#ff6b6b' : pct < 80 ? '#ffd93d' : '#4ecdc4' }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Meals by Type */}
        {MEAL_TYPES.map((mealType) => {
          const typeMeals = getMealsByType(mealType.id);
          return (
            <View key={mealType.id} style={styles.mealSection}>
              <View style={styles.mealSectionHeader}>
                <View style={[styles.mealTypeIcon, { backgroundColor: mealType.color + '20' }]}>
                  <Ionicons name={mealType.icon as any} size={18} color={mealType.color} />
                </View>
                <Text style={styles.mealTypeLabel}>{mealType.label}</Text>
                <TouchableOpacity
                  style={styles.addMealBtn}
                  onPress={() => { setSelectedMealType(mealType.id); setShowSearchModal(true); }}
                >
                  <Ionicons name="add-circle" size={24} color={mealType.color} />
                </TouchableOpacity>
              </View>
              {typeMeals.length > 0 ? (
                typeMeals.map((meal) => (
                  <View key={meal.id} style={styles.mealItem}>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealName} numberOfLines={1}>{meal.food_name}</Text>
                      <Text style={styles.mealMeta}>{meal.portion_grams}g • {meal.cooking_method}</Text>
                    </View>
                    <Text style={styles.mealCalories}>{formatNumber(meal.nutrients?.energy_kcal)} kcal</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noMeals}>No {mealType.label.toLowerCase()} logged</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Search Modal */}
      <Modal visible={showSearchModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Food</Text>
              <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Meal Type Selection */}
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.mealTypeOption, selectedMealType === type.id && { backgroundColor: type.color + '30', borderColor: type.color }]}
                  onPress={() => setSelectedMealType(type.id)}
                >
                  <Ionicons name={type.icon as any} size={16} color={selectedMealType === type.id ? type.color : '#666'} />
                  <Text style={[styles.mealTypeText, selectedMealType === type.id && { color: type.color }]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <View style={styles.searchInput}>
                <Ionicons name="search" size={20} color="#666" />
                <TextInput
                  style={styles.searchField}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search foods..."
                  placeholderTextColor="#666"
                  onSubmitEditing={searchFoods}
                  returnKeyType="search"
                />
              </View>
              <TouchableOpacity style={styles.searchBtn} onPress={searchFoods}>
                <Text style={styles.searchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>

            {/* Results */}
            <ScrollView style={styles.resultsScroll}>
              {searching ? (
                <Text style={styles.searchingText}>Searching...</Text>
              ) : searchResults.length > 0 ? (
                searchResults.map((food) => (
                  <TouchableOpacity key={food.fdc_id} style={styles.foodResult} onPress={() => handleFoodSelect(food)}>
                    <View style={styles.foodResultIcon}>
                      <Ionicons name="nutrition" size={20} color="#00d4ff" />
                    </View>
                    <View style={styles.foodResultInfo}>
                      <Text style={styles.foodResultName} numberOfLines={2}>{food.description}</Text>
                      <Text style={styles.foodResultMeta}>{food.data_type || 'USDA'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptySearch}>
                  <Ionicons name="search-outline" size={40} color="#444" />
                  <Text style={styles.emptySearchText}>Search for foods to add</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center' },
  summaryCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 16 },
  macrosRow: { flexDirection: 'row', justifyContent: 'space-between' },
  macroItem: { alignItems: 'center' },
  macroIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  macroValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  macroLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  microCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 16 },
  microGrid: {},
  microItem: { marginBottom: 14 },
  microHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  microLabel: { fontSize: 13, color: '#aaa' },
  microValue: { fontSize: 13, color: '#fff', fontWeight: '500' },
  microBar: { height: 6, backgroundColor: '#2a2a4e', borderRadius: 3 },
  microFill: { height: 6, borderRadius: 3 },
  mealSection: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  mealSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  mealTypeIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  mealTypeLabel: { flex: 1, marginLeft: 12, fontSize: 15, fontWeight: '600', color: '#fff' },
  addMealBtn: {},
  mealItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2a2a4e' },
  mealInfo: { flex: 1 },
  mealName: { fontSize: 14, color: '#fff' },
  mealMeta: { fontSize: 11, color: '#888', marginTop: 2 },
  mealCalories: { fontSize: 13, color: '#4ecdc4', fontWeight: '500' },
  noMeals: { fontSize: 13, color: '#555', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a4e' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  mealTypeRow: { flexDirection: 'row', padding: 16, justifyContent: 'space-between' },
  mealTypeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 12, marginHorizontal: 4, borderWidth: 1, borderColor: '#2a2a4e' },
  mealTypeText: { fontSize: 11, color: '#888', marginLeft: 4 },
  searchRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  searchInput: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a4e', borderRadius: 12, paddingHorizontal: 12 },
  searchField: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12, marginLeft: 8 },
  searchBtn: { backgroundColor: '#00d4ff', paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', marginLeft: 8 },
  searchBtnText: { color: '#fff', fontWeight: '600' },
  resultsScroll: { maxHeight: 400, paddingHorizontal: 16 },
  searchingText: { color: '#888', textAlign: 'center', padding: 20 },
  foodResult: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#2a2a4e', borderRadius: 12, marginBottom: 8 },
  foodResultIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 212, 255, 0.1)', justifyContent: 'center', alignItems: 'center' },
  foodResultInfo: { flex: 1, marginLeft: 12 },
  foodResultName: { fontSize: 14, color: '#fff' },
  foodResultMeta: { fontSize: 11, color: '#00d4ff', marginTop: 2 },
  emptySearch: { alignItems: 'center', padding: 40 },
  emptySearchText: { color: '#666', marginTop: 12 },
});
