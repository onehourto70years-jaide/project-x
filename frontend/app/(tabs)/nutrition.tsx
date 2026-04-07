import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, TextInput, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedFetch, CacheKeys, CacheTTL } from '../../src/cache';
import { useLanguage } from '../../src/LanguageContext';
import { useTheme } from '../../src/ThemeContext';

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

const COOKING_METHODS = ['raw', 'steaming', 'boiling', 'baking', 'frying'];

export default function NutritionScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');

  // Edit meal state
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [editPortion, setEditPortion] = useState('');
  const [editMealType, setEditMealType] = useState('');
  const [editCookingMethod, setEditCookingMethod] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchMeals = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const result = await cachedFetch(CacheKeys.mealsToday, async () => {
        const response = await fetch(`${BACKEND_URL}/api/meals/today`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('meals fetch failed');
        return response.json();
      }, CacheTTL.SHORT);

      const data = result.data;
      setMeals(data.meals || []);
      
      // Calculate totals
      const newTotals: Record<string, number> = {};
      (data.meals || []).forEach((meal: Meal) => {
        Object.entries(meal.nutrients || {}).forEach(([key, value]) => {
          newTotals[key] = (newTotals[key] || 0) + (value as number);
        });
      });
      setTotals(newTotals);
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

  const openEditModal = (meal: Meal) => {
    setEditMeal(meal);
    setEditPortion(String(meal.portion_grams));
    setEditMealType(meal.meal_type);
    setEditCookingMethod(meal.cooking_method || 'raw');
  };

  const handleSaveEdit = async () => {
    if (!editMeal) return;
    setSavingEdit(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const updates: Record<string, any> = {};
      const newPortion = parseInt(editPortion) || editMeal.portion_grams;
      if (newPortion !== editMeal.portion_grams) updates.portion_grams = newPortion;
      if (editMealType !== editMeal.meal_type) updates.meal_type = editMealType;
      if (editCookingMethod !== (editMeal.cooking_method || 'raw')) updates.cooking_method = editCookingMethod;

      if (Object.keys(updates).length === 0) {
        setEditMeal(null);
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/meals/${editMeal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setEditMeal(null);
        // Force refresh
        setRefreshing(true);
        const freshRes = await fetch(`${BACKEND_URL}/api/meals/today`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (freshRes.ok) {
          const data = await freshRes.json();
          setMeals(data.meals || []);
          const newTotals: Record<string, number> = {};
          (data.meals || []).forEach((m: Meal) => {
            Object.entries(m.nutrients || {}).forEach(([key, value]) => {
              newTotals[key] = (newTotals[key] || 0) + (value as number);
            });
          });
          setTotals(newTotals);
        }
        setRefreshing(false);
      } else {
        Alert.alert('Error', 'Failed to update meal');
      }
    } catch (error) {
      console.error('Edit error:', error);
      Alert.alert('Error', 'Failed to update meal');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteMeal = async () => {
    if (!editMeal) return;
    Alert.alert(
      t('common_delete') || 'Delete',
      `${t('common_confirm_delete') || 'Delete'} "${editMeal.food_name}"?`,
      [
        { text: t('common_cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common_delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('session_token');
              if (!token) return;
              await fetch(`${BACKEND_URL}/api/meals/${editMeal.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              setEditMeal(null);
              setRefreshing(true);
              fetchMeals();
            } catch (error) {
              console.error('Delete error:', error);
            }
          },
        },
      ]
    );
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return num < 1 ? num.toFixed(2) : num.toFixed(0);
  };

  const getMealTypeInfo = (type: string) => MEAL_TYPES.find(mt => mt.id === type) || MEAL_TYPES[0];

  const getMealsByType = (type: string) => meals.filter(m => m.meal_type === type);

  // Calculate preview nutrients for edit modal
  const getEditPreviewCalories = () => {
    if (!editMeal) return 0;
    const newPortion = parseInt(editPortion) || editMeal.portion_grams;
    const ratio = newPortion / (editMeal.portion_grams || 100);
    return Math.round((editMeal.nutrients?.energy_kcal || 0) * ratio);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMeals(); }} tintColor="#00d4ff" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('nutr_title')}</Text>
            <Text style={styles.subtitle}>{t('nutr_subtitle')}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowSearchModal(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Today's Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>{t('nutr_today_summary')}</Text>
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
              <Text style={styles.macroLabel}>{t('dash_protein')}</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroIcon, { backgroundColor: 'rgba(78, 205, 196, 0.1)' }]}>
                <Ionicons name="leaf" size={20} color="#4ecdc4" />
              </View>
              <Text style={styles.macroValue}>{formatNumber(totals.carbohydrate_g)}g</Text>
              <Text style={styles.macroLabel}>{t('dash_carbs')}</Text>
            </View>
            <View style={styles.macroItem}>
              <View style={[styles.macroIcon, { backgroundColor: 'rgba(255, 217, 61, 0.1)' }]}>
                <Ionicons name="water" size={20} color="#ffd93d" />
              </View>
              <Text style={styles.macroValue}>{formatNumber(totals.fat_g)}g</Text>
              <Text style={styles.macroLabel}>{t('dash_fat')}</Text>
            </View>
          </View>
        </View>

        {/* Micronutrients */}
        <View style={styles.microCard}>
          <Text style={styles.cardTitle}>{t('nutr_micronutrients')}</Text>
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
            <View key={mealType.id} style={[styles.mealSection, { backgroundColor: theme.bgCard }]}>
              <View style={styles.mealSectionHeader}>
                <View style={[styles.mealTypeIcon, { backgroundColor: mealType.color + '20' }]}>
                  <Ionicons name={mealType.icon as any} size={18} color={mealType.color} />
                </View>
                <Text style={[styles.mealTypeLabel, { color: theme.text }]}>{mealType.label}</Text>
                <TouchableOpacity
                  style={styles.addMealBtn}
                  onPress={() => { setSelectedMealType(mealType.id); setShowSearchModal(true); }}
                >
                  <Ionicons name="add-circle" size={24} color={mealType.color} />
                </TouchableOpacity>
              </View>
              {typeMeals.length > 0 ? (
                typeMeals.map((meal) => (
                  <TouchableOpacity
                    key={meal.id}
                    style={[styles.mealItem, { borderTopColor: theme.border }]}
                    onPress={() => openEditModal(meal)}
                    activeOpacity={0.6}
                  >
                    <View style={styles.mealInfo}>
                      <Text style={[styles.mealName, { color: theme.text }]} numberOfLines={1}>{meal.food_name}</Text>
                      <Text style={styles.mealMeta}>{meal.portion_grams}g • {meal.cooking_method}</Text>
                    </View>
                    <Text style={styles.mealCalories}>{formatNumber(meal.nutrients?.energy_kcal)} kcal</Text>
                    <Ionicons name="create-outline" size={16} color={theme.textDim} style={{ marginLeft: 8 }} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noMeals}>No {mealType.label.toLowerCase()} logged</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Edit Meal Modal */}
      <Modal visible={!!editMeal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={[styles.editModalContent, { backgroundColor: theme.bgCard }]}>
              {/* Header */}
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>{t('common_edit') || 'Edit Meal'}</Text>
                  <Text style={[styles.editFoodName, { color: theme.textMuted }]} numberOfLines={1}>{editMeal?.food_name}</Text>
                </View>
                <TouchableOpacity onPress={() => setEditMeal(null)} style={styles.closeEditBtn}>
                  <Ionicons name="close" size={22} color={theme.textDim} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.editScrollContent} showsVerticalScrollIndicator={false}>
                {/* Portion Size */}
                <View style={styles.editSection}>
                  <Text style={[styles.editLabel, { color: theme.textMuted }]}>{t('fd_portion') || 'Portion Size'} (g)</Text>
                  <View style={styles.portionEditRow}>
                    <TouchableOpacity
                      style={[styles.portionAdjustBtn, { backgroundColor: theme.border }]}
                      onPress={() => {
                        const val = Math.max(10, (parseInt(editPortion) || 100) - 25);
                        setEditPortion(String(val));
                      }}
                    >
                      <Ionicons name="remove" size={20} color={theme.text} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.portionEditInput, { color: theme.text, borderColor: theme.border }]}
                      value={editPortion}
                      onChangeText={(text) => setEditPortion(text.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      selectTextOnFocus
                    />
                    <TouchableOpacity
                      style={[styles.portionAdjustBtn, { backgroundColor: theme.border }]}
                      onPress={() => {
                        const val = (parseInt(editPortion) || 100) + 25;
                        setEditPortion(String(val));
                      }}
                    >
                      <Ionicons name="add" size={20} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                  {/* Quick portion buttons */}
                  <View style={styles.quickPortionRow}>
                    {[50, 100, 150, 200, 250, 300].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[styles.quickPortionBtn, parseInt(editPortion) === g && { backgroundColor: '#00d4ff', borderColor: '#00d4ff' }, { borderColor: theme.border }]}
                        onPress={() => setEditPortion(String(g))}
                      >
                        <Text style={[styles.quickPortionText, parseInt(editPortion) === g && { color: '#fff' }, { color: theme.textMuted }]}>{g}g</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {/* Calorie preview */}
                  <View style={[styles.caloriePreview, { backgroundColor: 'rgba(0,212,255,0.08)' }]}>
                    <Ionicons name="flame" size={16} color="#ff6b6b" />
                    <Text style={{ color: theme.textMuted, fontSize: 13, marginLeft: 6 }}>
                      ~{getEditPreviewCalories()} kcal
                    </Text>
                  </View>
                </View>

                {/* Meal Type */}
                <View style={styles.editSection}>
                  <Text style={[styles.editLabel, { color: theme.textMuted }]}>{t('fd_meal_type') || 'Meal Type'}</Text>
                  <View style={styles.editMealTypeRow}>
                    {MEAL_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.id}
                        style={[styles.editMealTypeBtn, editMealType === type.id && { backgroundColor: type.color + '25', borderColor: type.color }, { borderColor: theme.border }]}
                        onPress={() => setEditMealType(type.id)}
                      >
                        <Ionicons name={type.icon as any} size={18} color={editMealType === type.id ? type.color : theme.textDim} />
                        <Text style={[styles.editMealTypeText, editMealType === type.id && { color: type.color }, { color: theme.textDim }]}>{type.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Cooking Method */}
                <View style={styles.editSection}>
                  <Text style={[styles.editLabel, { color: theme.textMuted }]}>{t('fd_cooking') || 'Cooking Method'}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.editCookingRow}>
                      {COOKING_METHODS.map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[styles.editCookingBtn, editCookingMethod === method && styles.editCookingBtnActive, { borderColor: theme.border }]}
                          onPress={() => setEditCookingMethod(method)}
                        >
                          <Ionicons
                            name={method === 'raw' ? 'leaf' : method === 'steaming' ? 'water' : method === 'boiling' ? 'water-outline' : method === 'baking' ? 'flame' : 'restaurant'}
                            size={16}
                            color={editCookingMethod === method ? '#fff' : theme.textDim}
                          />
                          <Text style={[styles.editCookingText, editCookingMethod === method && { color: '#fff' }, { color: theme.textDim }]}>
                            {method.charAt(0).toUpperCase() + method.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={[styles.editActions, { borderTopColor: theme.border }]}>
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteMeal}>
                  <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                  <Text style={styles.deleteBtnText}>{t('common_delete') || 'Delete'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveEditBtn, savingEdit && { opacity: 0.6 }]}
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={styles.saveEditBtnText}>{t('common_save') || 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Search Modal */}
      <Modal visible={showSearchModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('nutr_add_food')}</Text>
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
                  placeholder={t('nutr_search_food')}
                  placeholderTextColor="#666"
                  onSubmitEditing={searchFoods}
                  returnKeyType="search"
                />
              </View>
              <TouchableOpacity style={styles.searchBtn} onPress={searchFoods}>
                <Text style={styles.searchBtnText}>{t('nutr_search_btn')}</Text>
              </TouchableOpacity>
            </View>

            {/* Results */}
            <ScrollView style={styles.resultsScroll}>
              {searching ? (
                <Text style={styles.searchingText}>{t('nutr_searching')}</Text>
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

  // Edit Modal
  editModalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 20 },
  editFoodName: { fontSize: 13, marginTop: 2 },
  closeEditBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  editScrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  editSection: { marginBottom: 20 },
  editLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  portionEditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  portionAdjustBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  portionEditInput: { width: 90, height: 48, borderRadius: 12, borderWidth: 1.5, textAlign: 'center', fontSize: 22, fontWeight: '700' },
  quickPortionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  quickPortionBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  quickPortionText: { fontSize: 12, fontWeight: '500' },
  caloriePreview: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  editMealTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editMealTypeBtn: { flex: 1, minWidth: '45%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
  editMealTypeText: { fontSize: 12, fontWeight: '500', marginLeft: 6 },
  editCookingRow: { flexDirection: 'row', gap: 8 },
  editCookingBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  editCookingBtnActive: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  editCookingText: { fontSize: 12, fontWeight: '500', marginLeft: 6 },
  editActions: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, gap: 12 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)', backgroundColor: 'rgba(255,107,107,0.08)' },
  deleteBtnText: { color: '#ff6b6b', fontWeight: '600', fontSize: 13, marginLeft: 6 },
  saveEditBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#00d4ff' },
  saveEditBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, marginLeft: 6 },
});
