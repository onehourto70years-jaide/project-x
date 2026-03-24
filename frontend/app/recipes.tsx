import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const COOKING_METHODS = ['raw', 'baking', 'boiling', 'frying', 'grilling', 'steaming', 'roasting', 'microwaving'];

interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: any[];
  servings: number;
  instructions: string[];
  per_serving_nutrients: Record<string, number>;
  per_serving_elements: Record<string, number>;
  total_nutrients: Record<string, number>;
  total_elements: Record<string, number>;
  allergens: string[];
}

interface Ingredient {
  fdc_id: number;
  food_name: string;
  portion_grams: number;
  cooking_method: string;
}

export default function RecipesScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [newRecipe, setNewRecipe] = useState({
    name: '', description: '', servings: 2, ingredients: [] as Ingredient[], instructions: [] as string[]
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [newInstruction, setNewInstruction] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchRecipes = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/recipes`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setRecipes((await res.json()).recipes || []);
    } catch (e) { }
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchRecipes(); }, []));

  const searchFoods = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/foods/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, page_size: 8 })
      });
      if (res.ok) setSearchResults((await res.json()).foods || []);
    } catch (e) { }
    finally { setSearching(false); }
  };

  const addIngredient = (food: any) => {
    setNewRecipe(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { fdc_id: food.fdc_id, food_name: food.description, portion_grams: 100, cooking_method: 'raw' }]
    }));
    setSearchResults([]);
    setSearchQuery('');
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const updated = [...newRecipe.ingredients];
    (updated[index] as any)[field] = value;
    setNewRecipe(prev => ({ ...prev, ingredients: updated }));
  };

  const removeIngredient = (index: number) => {
    setNewRecipe(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) }));
  };

  const addInstruction = () => {
    if (!newInstruction.trim()) return;
    setNewRecipe(prev => ({ ...prev, instructions: [...prev.instructions, newInstruction.trim()] }));
    setNewInstruction('');
  };

  const removeInstruction = (index: number) => {
    setNewRecipe(prev => ({ ...prev, instructions: prev.instructions.filter((_, i) => i !== index) }));
  };

  const createRecipe = async () => {
    if (!newRecipe.name.trim()) { Alert.alert('Error', 'Please enter a recipe name'); return; }
    if (newRecipe.ingredients.length === 0) { Alert.alert('Error', 'Add at least one ingredient'); return; }
    setCreating(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/recipes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newRecipe)
      });
      if (res.ok) {
        Alert.alert('Recipe Created!', 'Your recipe with full elemental analysis is ready.');
        setShowCreateModal(false);
        resetForm();
        fetchRecipes();
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Failed to create recipe');
      }
    } catch (e) { Alert.alert('Error', 'Network error while creating recipe'); }
    finally { setCreating(false); }
  };

  const deleteRecipe = async (recipeId: string) => {
    Alert.alert('Delete Recipe', 'This cannot be undone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const token = await AsyncStorage.getItem('session_token');
        if (!token) return;
        await fetch(`${BACKEND_URL}/api/recipes/${recipeId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        setRecipes(prev => prev.filter(r => r.id !== recipeId));
        setShowDetailModal(false);
      }}
    ]);
  };

  const logRecipeAsMeal = async (recipe: Recipe) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const hour = new Date().getHours();
      const mealType = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 20 ? 'dinner' : 'snack';
      await fetch(`${BACKEND_URL}/api/meals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          food_name: recipe.name, portion_grams: 100, meal_type: mealType,
          cooking_method: 'recipe', nutrients: recipe.per_serving_nutrients || {},
          elements: recipe.per_serving_elements || {}, allergens: recipe.allergens || []
        })
      });
      Alert.alert('Logged!', `1 serving of ${recipe.name} added to ${mealType}`);
    } catch (e) { Alert.alert('Error', 'Failed to log meal'); }
  };

  const resetForm = () => {
    setNewRecipe({ name: '', description: '', servings: 2, ingredients: [], instructions: [] });
    setSearchQuery(''); setSearchResults([]); setNewInstruction('');
  };

  const formatNum = (n: number | undefined) => {
    if (!n) return '0';
    return n < 1 ? n.toFixed(2) : Math.round(n).toString();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>  
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.bgCard }]}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Recipe Builder</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)} style={[styles.addBtn, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecipes(); }} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}>
        {recipes.length > 0 ? (
          recipes.map((recipe) => (
            <TouchableOpacity key={recipe.id} style={[styles.recipeCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
              onPress={() => { setSelectedRecipe(recipe); setShowDetailModal(true); }}>
              <View style={styles.recipeHeader}>
                <View style={[styles.recipeIcon, { backgroundColor: theme.accentGlow }]}>
                  <Ionicons name="restaurant" size={24} color={theme.accent} />
                </View>
                <View style={styles.recipeInfo}>
                  <Text style={[styles.recipeName, { color: theme.text }]}>{recipe.name}</Text>
                  <Text style={[styles.recipeMeta, { color: theme.textMuted }]}>
                    {recipe.ingredients?.length || 0} ingredients • {recipe.servings} servings
                  </Text>
                </View>
              </View>

              {/* Per Serving Nutrients */}
              <View style={[styles.nutrientRow, { backgroundColor: theme.bgInput }]}>
                {[
                  { label: 'kcal', val: recipe.per_serving_nutrients?.energy_kcal, color: '#ff6b6b' },
                  { label: 'protein', val: recipe.per_serving_nutrients?.protein_g, color: '#00d4ff', unit: 'g' },
                  { label: 'carbs', val: recipe.per_serving_nutrients?.carbohydrate_g, color: '#ffd93d', unit: 'g' },
                  { label: 'fat', val: recipe.per_serving_nutrients?.fat_g, color: '#ff9f43', unit: 'g' },
                ].map((n) => (
                  <View key={n.label} style={styles.nutrientItem}>
                    <Text style={[styles.nutrientValue, { color: n.color }]}>{formatNum(n.val)}{n.unit || ''}</Text>
                    <Text style={[styles.nutrientLabel, { color: theme.textMuted }]}>{n.label}</Text>
                  </View>
                ))}
              </View>

              {/* Elements per serving */}
              {recipe.per_serving_elements && (
                <View style={styles.elementsRow}>
                  {['C', 'H', 'O', 'N'].map((el) => (
                    <View key={el} style={styles.elementMini}>
                      <Text style={[styles.elementMiniSymbol, { color: { C: '#00d4ff', H: '#00ff88', O: '#ff6b6b', N: '#a29bfe' }[el] }]}>{el}</Text>
                      <Text style={[styles.elementMiniVal, { color: theme.textMuted }]}>{formatNum(recipe.per_serving_elements?.[el])}g</Text>
                    </View>
                  ))}
                </View>
              )}

              {recipe.allergens?.length > 0 && (
                <View style={styles.allergenRow}>
                  <Ionicons name="warning" size={14} color={theme.danger} />
                  <Text style={[styles.allergenText, { color: theme.danger }]}>{recipe.allergens.join(', ')}</Text>
                </View>
              )}

              <View style={styles.recipeActions}>
                <TouchableOpacity style={[styles.logBtn, { backgroundColor: theme.accentGlow }]}
                  onPress={() => logRecipeAsMeal(recipe)}>
                  <Ionicons name="add-circle" size={16} color={theme.accent} />
                  <Text style={[styles.logBtnText, { color: theme.accent }]}>Log Serving</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={64} color={theme.textDim} />
            <Text style={[styles.emptyText, { color: theme.text }]}>No recipes yet</Text>
            <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>
              Create custom recipes with combined molecular nutrition analysis
            </Text>
            <TouchableOpacity style={[styles.createEmptyBtn, { backgroundColor: theme.accent }]}
              onPress={() => setShowCreateModal(true)}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.createEmptyText}>Create Your First Recipe</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* CREATE RECIPE MODAL */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.bgSecondary }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.borderLight }]}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Create Recipe</Text>
                <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Recipe Name *</Text>
                <TextInput style={[styles.input, { backgroundColor: theme.bgInput, color: theme.text }]}
                  value={newRecipe.name} onChangeText={(t) => setNewRecipe(prev => ({ ...prev, name: t }))}
                  placeholder="e.g., Protein Power Bowl" placeholderTextColor={theme.textDim} />

                <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Description</Text>
                <TextInput style={[styles.input, styles.textArea, { backgroundColor: theme.bgInput, color: theme.text }]}
                  value={newRecipe.description} onChangeText={(t) => setNewRecipe(prev => ({ ...prev, description: t }))}
                  placeholder="Brief description..." placeholderTextColor={theme.textDim} multiline />

                <View style={styles.servingsRow}>
                  <Text style={[styles.inputLabel, { color: theme.textMuted, marginTop: 0 }]}>Servings</Text>
                  <View style={styles.servingsControl}>
                    <TouchableOpacity style={[styles.servingBtn, { backgroundColor: theme.bgInput }]}
                      onPress={() => setNewRecipe(prev => ({ ...prev, servings: Math.max(1, prev.servings - 1) }))}>
                      <Ionicons name="remove" size={18} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.servingsNum, { color: theme.text }]}>{newRecipe.servings}</Text>
                    <TouchableOpacity style={[styles.servingBtn, { backgroundColor: theme.bgInput }]}
                      onPress={() => setNewRecipe(prev => ({ ...prev, servings: prev.servings + 1 }))}>
                      <Ionicons name="add" size={18} color={theme.text} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* INGREDIENTS */}
                <Text style={[styles.inputLabel, { color: theme.textMuted }]}>
                  Ingredients ({newRecipe.ingredients.length})
                </Text>
                <View style={styles.searchRow}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }, { backgroundColor: theme.bgInput, color: theme.text }]}
                    value={searchQuery} onChangeText={setSearchQuery} placeholder="Search foods..."
                    placeholderTextColor={theme.textDim} onSubmitEditing={searchFoods} returnKeyType="search" />
                  <TouchableOpacity style={[styles.searchBtn, { backgroundColor: theme.accent }]} onPress={searchFoods}>
                    <Ionicons name="search" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                {searching && <Text style={[styles.searchingText, { color: theme.textMuted }]}>Searching...</Text>}

                {searchResults.map((food) => (
                  <TouchableOpacity key={food.fdc_id} style={[styles.searchResult, { backgroundColor: theme.bgInput }]}
                    onPress={() => addIngredient(food)}>
                    <Ionicons name="add-circle" size={20} color={theme.teal} />
                    <Text style={[styles.searchResultText, { color: theme.text }]} numberOfLines={1}>{food.description}</Text>
                  </TouchableOpacity>
                ))}

                {newRecipe.ingredients.map((ing, index) => (
                  <View key={index} style={[styles.ingredientCard, { backgroundColor: theme.bgInput, borderColor: theme.border }]}>
                    <View style={styles.ingredientTop}>
                      <Text style={[styles.ingredientName, { color: theme.text }]} numberOfLines={1}>{ing.food_name}</Text>
                      <TouchableOpacity onPress={() => removeIngredient(index)}>
                        <Ionicons name="close-circle" size={20} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.ingredientControls}>
                      <View style={styles.portionControl}>
                        <Text style={[styles.controlLabel, { color: theme.textMuted }]}>Portion</Text>
                        <View style={styles.portionInputGroup}>
                          <TextInput style={[styles.portionInput, { backgroundColor: theme.bgCard, color: theme.text }]}
                            value={String(ing.portion_grams)}
                            onChangeText={(t) => updateIngredient(index, 'portion_grams', parseInt(t) || 0)}
                            keyboardType="numeric" />
                          <Text style={[styles.portionUnit, { color: theme.textDim }]}>g</Text>
                        </View>
                      </View>
                      <View style={styles.cookControl}>
                        <Text style={[styles.controlLabel, { color: theme.textMuted }]}>Cooking</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {COOKING_METHODS.map((method) => (
                            <TouchableOpacity key={method}
                              style={[styles.cookChip, { backgroundColor: theme.bgCard },
                                ing.cooking_method === method && { backgroundColor: theme.accent }]}
                              onPress={() => updateIngredient(index, 'cooking_method', method)}>
                              <Text style={[styles.cookChipText, { color: theme.textMuted },
                                ing.cooking_method === method && { color: '#fff' }]}>
                                {method}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    </View>
                  </View>
                ))}

                {/* INSTRUCTIONS */}
                <Text style={[styles.inputLabel, { color: theme.textMuted }]}>
                  Instructions ({newRecipe.instructions.length})
                </Text>
                <View style={styles.searchRow}>
                  <TextInput style={[styles.input, { flex: 1, marginRight: 8 }, { backgroundColor: theme.bgInput, color: theme.text }]}
                    value={newInstruction} onChangeText={setNewInstruction}
                    placeholder="Add a step..." placeholderTextColor={theme.textDim}
                    onSubmitEditing={addInstruction} returnKeyType="done" />
                  <TouchableOpacity style={[styles.searchBtn, { backgroundColor: theme.teal }]} onPress={addInstruction}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>

                {newRecipe.instructions.map((inst, index) => (
                  <View key={index} style={[styles.instructionItem, { backgroundColor: theme.bgInput }]}>
                    <View style={[styles.stepBadge, { backgroundColor: theme.accentGlow }]}>
                      <Text style={[styles.stepNum, { color: theme.accent }]}>{index + 1}</Text>
                    </View>
                    <Text style={[styles.instructionText, { color: theme.textSecondary }]} numberOfLines={2}>{inst}</Text>
                    <TouchableOpacity onPress={() => removeInstruction(index)}>
                      <Ionicons name="close" size={16} color={theme.textDim} />
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={{ height: 20 }} />
              </ScrollView>

              <TouchableOpacity style={[styles.createRecipeBtn, { backgroundColor: theme.accent }]}
                onPress={createRecipe} disabled={creating}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.createRecipeBtnText}>
                  {creating ? 'Analyzing & Creating...' : 'Create Recipe'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* RECIPE DETAIL MODAL */}
      <Modal visible={showDetailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.bgSecondary }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.borderLight }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{selectedRecipe?.name}</Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedRecipe && (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {selectedRecipe.description ? (
                  <Text style={[styles.detailDesc, { color: theme.textSecondary }]}>{selectedRecipe.description}</Text>
                ) : null}

                <Text style={[styles.detailSection, { color: theme.text }]}>Per Serving Nutrition</Text>
                <View style={[styles.nutrientRow, { backgroundColor: theme.bgInput }]}>
                  {[
                    { label: 'Calories', val: selectedRecipe.per_serving_nutrients?.energy_kcal, color: '#ff6b6b' },
                    { label: 'Protein', val: selectedRecipe.per_serving_nutrients?.protein_g, color: '#00d4ff', unit: 'g' },
                    { label: 'Carbs', val: selectedRecipe.per_serving_nutrients?.carbohydrate_g, color: '#ffd93d', unit: 'g' },
                    { label: 'Fat', val: selectedRecipe.per_serving_nutrients?.fat_g, color: '#ff9f43', unit: 'g' },
                  ].map((n) => (
                    <View key={n.label} style={styles.nutrientItem}>
                      <Text style={[styles.nutrientValue, { color: n.color }]}>{formatNum(n.val)}{n.unit || ''}</Text>
                      <Text style={[styles.nutrientLabel, { color: theme.textMuted }]}>{n.label}</Text>
                    </View>
                  ))}
                </View>

                <Text style={[styles.detailSection, { color: theme.text }]}>Elemental Composition (per serving)</Text>
                <View style={styles.elementsDetailRow}>
                  {['C', 'H', 'O', 'N', 'S'].map((el) => {
                    const colors: Record<string, string> = { C: '#00d4ff', H: '#00ff88', O: '#ff6b6b', N: '#a29bfe', S: '#ffd93d' };
                    return (
                      <View key={el} style={[styles.elementDetailCard, { backgroundColor: theme.bgInput, borderColor: colors[el] + '30' }]}>
                        <Text style={[styles.elementDetailSymbol, { color: colors[el] }]}>{el}</Text>
                        <Text style={[styles.elementDetailVal, { color: theme.text }]}>
                          {formatNum(selectedRecipe.per_serving_elements?.[el])}g
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <Text style={[styles.detailSection, { color: theme.text }]}>
                  Ingredients ({selectedRecipe.ingredients?.length})
                </Text>
                {selectedRecipe.ingredients?.map((ing: any, i: number) => (
                  <View key={i} style={[styles.detailIngredient, { backgroundColor: theme.bgInput }]}>
                    <Text style={[styles.detailIngName, { color: theme.text }]}>{ing.food_name}</Text>
                    <Text style={[styles.detailIngMeta, { color: theme.textMuted }]}>{ing.portion_grams}g • {ing.cooking_method}</Text>
                  </View>
                ))}

                {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 && (
                  <>
                    <Text style={[styles.detailSection, { color: theme.text }]}>Instructions</Text>
                    {selectedRecipe.instructions.map((step: string, i: number) => (
                      <View key={i} style={styles.detailStep}>
                        <View style={[styles.stepBadge, { backgroundColor: theme.accentGlow }]}>
                          <Text style={[styles.stepNum, { color: theme.accent }]}>{i + 1}</Text>
                        </View>
                        <Text style={[styles.detailStepText, { color: theme.textSecondary }]}>{step}</Text>
                      </View>
                    ))}
                  </>
                )}

                <View style={styles.detailActions}>
                  <TouchableOpacity style={[styles.detailBtn, { backgroundColor: theme.accent }]}
                    onPress={() => { logRecipeAsMeal(selectedRecipe); setShowDetailModal(false); }}>
                    <Ionicons name="add-circle" size={18} color="#fff" />
                    <Text style={styles.detailBtnText}>Log 1 Serving</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.detailBtn, { backgroundColor: 'rgba(255, 107, 107, 0.15)' }]}
                    onPress={() => deleteRecipe(selectedRecipe.id)}>
                    <Ionicons name="trash" size={18} color={theme.danger} />
                    <Text style={[styles.detailBtnText, { color: theme.danger }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  recipeCard: { borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1 },
  recipeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  recipeIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  recipeInfo: { flex: 1, marginLeft: 12 },
  recipeName: { fontSize: 17, fontWeight: '600' },
  recipeMeta: { fontSize: 12, marginTop: 3 },
  nutrientRow: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 12, padding: 14 },
  nutrientItem: { alignItems: 'center' },
  nutrientValue: { fontSize: 16, fontWeight: '700' },
  nutrientLabel: { fontSize: 10, marginTop: 3 },
  elementsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  elementMini: { alignItems: 'center', marginHorizontal: 12 },
  elementMiniSymbol: { fontSize: 14, fontWeight: '800' },
  elementMiniVal: { fontSize: 10, marginTop: 2 },
  allergenRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  allergenText: { fontSize: 12, marginLeft: 6, flex: 1 },
  recipeActions: { marginTop: 12, flexDirection: 'row' },
  logBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  logBtnText: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
  emptyState: { alignItems: 'center', padding: 50 },
  emptyText: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  createEmptyBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14, marginTop: 24 },
  createEmptyText: { color: '#fff', fontWeight: '600', fontSize: 15, marginLeft: 8 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalScroll: { paddingHorizontal: 20, maxHeight: 600 },
  inputLabel: { fontSize: 13, marginBottom: 8, marginTop: 16, fontWeight: '600' },
  input: { borderRadius: 12, padding: 14, fontSize: 15 },
  textArea: { height: 80, textAlignVertical: 'top' },
  servingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  servingsControl: { flexDirection: 'row', alignItems: 'center' },
  servingBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  servingsNum: { fontSize: 20, fontWeight: '700', marginHorizontal: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchBtn: { padding: 14, borderRadius: 12 },
  searchingText: { padding: 10, textAlign: 'center' },
  searchResult: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginTop: 8 },
  searchResultText: { marginLeft: 10, flex: 1, fontSize: 14 },
  ingredientCard: { borderRadius: 12, padding: 14, marginTop: 10, borderWidth: 1 },
  ingredientTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ingredientName: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  ingredientControls: { marginTop: 10 },
  portionControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlLabel: { fontSize: 12, fontWeight: '500' },
  portionInputGroup: { flexDirection: 'row', alignItems: 'center' },
  portionInput: { borderRadius: 8, padding: 8, width: 60, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  portionUnit: { marginLeft: 4, fontSize: 13 },
  cookControl: { marginTop: 10 },
  cookChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 6, marginTop: 6 },
  cookChipText: { fontSize: 12, fontWeight: '500' },
  instructionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, marginTop: 8 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  stepNum: { fontSize: 13, fontWeight: '700' },
  instructionText: { flex: 1, fontSize: 14 },
  createRecipeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 20, padding: 16, borderRadius: 14 },
  createRecipeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  // Detail Modal
  detailDesc: { fontSize: 14, lineHeight: 20, marginTop: 12 },
  detailSection: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  elementsDetailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  elementDetailCard: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 12, marginHorizontal: 3, borderWidth: 1 },
  elementDetailSymbol: { fontSize: 18, fontWeight: '900' },
  elementDetailVal: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  detailIngredient: { padding: 12, borderRadius: 10, marginBottom: 8 },
  detailIngName: { fontSize: 14, fontWeight: '500' },
  detailIngMeta: { fontSize: 12, marginTop: 3 },
  detailStep: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  detailStepText: { flex: 1, fontSize: 14, lineHeight: 20 },
  detailActions: { flexDirection: 'row', marginTop: 20, marginBottom: 30 },
  detailBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginHorizontal: 4 },
  detailBtnText: { color: '#fff', fontWeight: '600', marginLeft: 6 },
});
