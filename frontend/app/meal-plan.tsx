import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, TextInput, Alert, RefreshControl, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../src/LanguageContext';
import { hapticLight, hapticMedium } from '../src/haptics';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const MEAL_TYPE_DEFS = [
  { id: 'breakfast', labelKey: 'mp_breakfast', icon: 'sunny', color: '#ffd93d' },
  { id: 'lunch', labelKey: 'mp_lunch', icon: 'restaurant', color: '#4ecdc4' },
  { id: 'dinner', labelKey: 'mp_dinner', icon: 'moon', color: '#a29bfe' },
  { id: 'snack', labelKey: 'mp_snack', icon: 'cafe', color: '#ff6b6b' },
];

interface MealPlan {
  id: string;
  date: string;
  meal_type: string;
  recipe_id?: string;
  food_name?: string;
  notes?: string;
}

export default function MealPlanScreen() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [mealPlans, setMealPlans] = useState<Record<string, MealPlan[]>>({});
  const [recipes, setRecipes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [notes, setNotes] = useState('');

  const LOCALE_MAP: Record<string, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR' };

  const getWeekDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const startDate = weekDates[0];
      const endDate = weekDates[6];
      const [plansRes, recipesRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/meal-plans?start_date=${startDate}&end_date=${endDate}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/recipes`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (plansRes.ok) setMealPlans((await plansRes.json()).meal_plans || {});
      if (recipesRes.ok) setRecipes((await recipesRes.json()).recipes || []);
    } catch (e) {}
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const addMealPlan = async () => {
    if (!selectedRecipeId && !notes.trim()) {
      Alert.alert(t('common_error'), t('mp_error_empty'));
      return;
    }
    hapticMedium();
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const recipe = recipes.find(r => r.id === selectedRecipeId);
      const response = await fetch(`${BACKEND_URL}/api/meal-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ date: selectedDate, meal_type: selectedMealType, recipe_id: selectedRecipeId || null, food_name: recipe?.name || notes, notes })
      });
      if (response.ok) {
        setShowAddModal(false);
        setSelectedRecipeId('');
        setNotes('');
        fetchData();
      }
    } catch (e) { Alert.alert(t('set_error'), t('mp_error_add')); }
  };

  const deletePlan = async (planId: string) => {
    hapticLight();
    const token = await AsyncStorage.getItem('session_token');
    if (!token) return;
    await fetch(`${BACKEND_URL}/api/meal-plans/${planId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    fetchData();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return t('mp_today');
    return date.toLocaleDateString(LOCALE_MAP[locale] || 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getMealTypeInfo = (type: string) => MEAL_TYPE_DEFS.find(m => m.id === type) || MEAL_TYPE_DEFS[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}
          accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('plan_title')}</Text>
        <TouchableOpacity onPress={() => { hapticLight(); setShowAddModal(true); }}>
          <Ionicons name="add-circle" size={28} color="#00d4ff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#00d4ff" />}>
        {weekDates.map((date) => (
          <View key={date} style={styles.dayCard}>
            <Text style={styles.dayTitle}>{formatDate(date)}</Text>
            
            {MEAL_TYPE_DEFS.map((mealType) => {
              const plans = (mealPlans[date] || []).filter(p => p.meal_type === mealType.id);
              return (
                <View key={mealType.id} style={styles.mealSlot}>
                  <View style={[styles.mealTypeIcon, { backgroundColor: mealType.color + '20' }]}>
                    <Ionicons name={mealType.icon as any} size={16} color={mealType.color} />
                  </View>
                  <View style={styles.mealContent}>
                    <Text style={styles.mealTypeLabel}>{t(mealType.labelKey)}</Text>
                    {plans.length > 0 ? (
                      plans.map((plan) => (
                        <View key={plan.id} style={styles.plannedMeal}>
                          <Text style={styles.plannedMealText}>{plan.food_name || plan.notes}</Text>
                          <TouchableOpacity onPress={() => deletePlan(plan.id)}>
                            <Ionicons name="close-circle" size={18} color="#666" />
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <TouchableOpacity style={styles.addMealBtn} onPress={() => { hapticLight(); setSelectedDate(date); setSelectedMealType(mealType.id); setShowAddModal(true); }}>
                        <Ionicons name="add" size={16} color="#666" />
                        <Text style={styles.addMealText}>{t('mp_add_meal')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Add Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('mp_plan_meal')}</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.inputLabel}>{t('mp_date')}: {formatDate(selectedDate)}</Text>
              
                <Text style={styles.inputLabel}>{t('mp_meal_type')}</Text>
                <View style={styles.mealTypeRow}>
                  {MEAL_TYPE_DEFS.map((type) => (
                    <TouchableOpacity key={type.id} style={[styles.mealTypeOption, selectedMealType === type.id && { backgroundColor: type.color + '30', borderColor: type.color }]} onPress={() => { hapticLight(); setSelectedMealType(type.id); }}>
                      <Ionicons name={type.icon as any} size={18} color={selectedMealType === type.id ? type.color : '#666'} />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>{t('mp_select_recipe')}</Text>
                {recipes.length > 0 ? (
                  recipes.map((recipe) => (
                    <TouchableOpacity key={recipe.id} style={[styles.recipeOption, selectedRecipeId === recipe.id && styles.recipeOptionActive]} onPress={() => { hapticLight(); setSelectedRecipeId(recipe.id); }}>
                      <Ionicons name={selectedRecipeId === recipe.id ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={selectedRecipeId === recipe.id ? '#00d4ff' : '#666'} />
                      <Text style={styles.recipeOptionText}>{recipe.name}</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noRecipes}>{t('mp_no_recipes')}</Text>
                )}

                <Text style={styles.inputLabel}>{t('mp_or_notes')}</Text>
                <TextInput style={styles.input} value={notes} onChangeText={setNotes} placeholder={t('mp_notes_placeholder')} placeholderTextColor="#666" />
              </ScrollView>

              <TouchableOpacity style={styles.addBtn} onPress={addMealPlan}>
                <Text style={styles.addBtnText}>{t('mp_add_to_plan')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  dayCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  dayTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  mealSlot: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2a2a4e' },
  mealTypeIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  mealContent: { flex: 1, marginLeft: 12 },
  mealTypeLabel: { fontSize: 13, color: '#888', marginBottom: 4 },
  plannedMeal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#2a2a4e', padding: 10, borderRadius: 8, marginTop: 4 },
  plannedMealText: { color: '#fff', fontSize: 14, flex: 1 },
  addMealBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  addMealText: { color: '#666', fontSize: 13, marginLeft: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a4e' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalScroll: { padding: 20 },
  inputLabel: { color: '#888', fontSize: 13, marginBottom: 10, marginTop: 16 },
  input: { backgroundColor: '#2a2a4e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15 },
  mealTypeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mealTypeOption: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#2a2a4e', marginHorizontal: 4, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  recipeOption: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#2a2a4e', borderRadius: 10, marginTop: 8 },
  recipeOptionActive: { backgroundColor: 'rgba(0, 212, 255, 0.1)' },
  recipeOptionText: { color: '#fff', marginLeft: 10, flex: 1 },
  noRecipes: { color: '#666', fontStyle: 'italic', padding: 10 },
  addBtn: { backgroundColor: '#00d4ff', margin: 20, padding: 16, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
