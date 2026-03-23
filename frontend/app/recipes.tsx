import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, Modal, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Recipe {
  id: string;
  name: string;
  description: string;
  ingredients: any[];
  servings: number;
  per_serving_nutrients: Record<string, number>;
  allergens: string[];
}

export default function RecipesScreen() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ name: '', description: '', servings: 1, ingredients: [] as any[], instructions: [] as string[] });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchRecipes = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const response = await fetch(`${BACKEND_URL}/api/recipes`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.ok) setRecipes((await response.json()).recipes || []);
    } catch (e) {}
    finally { setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchRecipes(); }, []));

  const searchFoods = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/foods/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, page_size: 10 })
      });
      if (response.ok) setSearchResults((await response.json()).foods || []);
    } catch (e) {}
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

  const removeIngredient = (index: number) => {
    setNewRecipe(prev => ({ ...prev, ingredients: prev.ingredients.filter((_, i) => i !== index) }));
  };

  const createRecipe = async () => {
    if (!newRecipe.name.trim()) { Alert.alert('Error', 'Please enter a recipe name'); return; }
    if (newRecipe.ingredients.length === 0) { Alert.alert('Error', 'Please add at least one ingredient'); return; }
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const response = await fetch(`${BACKEND_URL}/api/recipes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newRecipe)
      });
      if (response.ok) {
        Alert.alert('Success', 'Recipe created!');
        setShowCreateModal(false);
        setNewRecipe({ name: '', description: '', servings: 1, ingredients: [], instructions: [] });
        fetchRecipes();
      }
    } catch (e) { Alert.alert('Error', 'Failed to create recipe'); }
  };

  const deleteRecipe = async (recipeId: string) => {
    Alert.alert('Delete Recipe', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const token = await AsyncStorage.getItem('session_token');
        if (!token) return;
        await fetch(`${BACKEND_URL}/api/recipes/${recipeId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        setRecipes(prev => prev.filter(r => r.id !== recipeId));
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Recipe Builder</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add-circle" size={28} color="#00d4ff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecipes(); }} tintColor="#00d4ff" />}>
        {recipes.length > 0 ? (
          recipes.map((recipe) => (
            <TouchableOpacity key={recipe.id} style={styles.recipeCard}>
              <View style={styles.recipeHeader}>
                <View style={styles.recipeIcon}>
                  <Ionicons name="restaurant" size={24} color="#4ecdc4" />
                </View>
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeName}>{recipe.name}</Text>
                  <Text style={styles.recipeMeta}>{recipe.ingredients?.length || 0} ingredients • {recipe.servings} servings</Text>
                </View>
                <TouchableOpacity onPress={() => deleteRecipe(recipe.id)}>
                  <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                </TouchableOpacity>
              </View>
              <View style={styles.nutrientRow}>
                <View style={styles.nutrientItem}>
                  <Text style={styles.nutrientValue}>{Math.round(recipe.per_serving_nutrients?.energy_kcal || 0)}</Text>
                  <Text style={styles.nutrientLabel}>kcal</Text>
                </View>
                <View style={styles.nutrientItem}>
                  <Text style={styles.nutrientValue}>{Math.round(recipe.per_serving_nutrients?.protein_g || 0)}g</Text>
                  <Text style={styles.nutrientLabel}>protein</Text>
                </View>
                <View style={styles.nutrientItem}>
                  <Text style={styles.nutrientValue}>{Math.round(recipe.per_serving_nutrients?.carbohydrate_g || 0)}g</Text>
                  <Text style={styles.nutrientLabel}>carbs</Text>
                </View>
                <View style={styles.nutrientItem}>
                  <Text style={styles.nutrientValue}>{Math.round(recipe.per_serving_nutrients?.fat_g || 0)}g</Text>
                  <Text style={styles.nutrientLabel}>fat</Text>
                </View>
              </View>
              {recipe.allergens?.length > 0 && (
                <View style={styles.allergenRow}>
                  <Ionicons name="warning" size={14} color="#ff6b6b" />
                  <Text style={styles.allergenText}>{recipe.allergens.join(', ')}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="restaurant-outline" size={64} color="#444" />
            <Text style={styles.emptyText}>No recipes yet</Text>
            <Text style={styles.emptySubtext}>Create custom recipes with combined nutrition</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
              <Text style={styles.createBtnText}>Create Recipe</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Recipe</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.inputLabel}>Recipe Name</Text>
              <TextInput style={styles.input} value={newRecipe.name} onChangeText={(t) => setNewRecipe(prev => ({ ...prev, name: t }))} placeholder="e.g., Protein Power Bowl" placeholderTextColor="#666" />

              <Text style={styles.inputLabel}>Description</Text>
              <TextInput style={[styles.input, { height: 80 }]} value={newRecipe.description} onChangeText={(t) => setNewRecipe(prev => ({ ...prev, description: t }))} placeholder="Brief description..." placeholderTextColor="#666" multiline />

              <Text style={styles.inputLabel}>Servings</Text>
              <TextInput style={styles.input} value={String(newRecipe.servings)} onChangeText={(t) => setNewRecipe(prev => ({ ...prev, servings: parseInt(t) || 1 }))} keyboardType="numeric" placeholderTextColor="#666" />

              <Text style={styles.inputLabel}>Ingredients ({newRecipe.ingredients.length})</Text>
              <View style={styles.searchRow}>
                <TextInput style={[styles.input, { flex: 1, marginRight: 8 }]} value={searchQuery} onChangeText={setSearchQuery} placeholder="Search foods..." placeholderTextColor="#666" onSubmitEditing={searchFoods} />
                <TouchableOpacity style={styles.searchBtn} onPress={searchFoods}>
                  <Ionicons name="search" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {searchResults.map((food) => (
                <TouchableOpacity key={food.fdc_id} style={styles.searchResult} onPress={() => addIngredient(food)}>
                  <Ionicons name="add-circle" size={20} color="#4ecdc4" />
                  <Text style={styles.searchResultText} numberOfLines={1}>{food.description}</Text>
                </TouchableOpacity>
              ))}

              {newRecipe.ingredients.map((ing, index) => (
                <View key={index} style={styles.ingredientItem}>
                  <Text style={styles.ingredientName} numberOfLines={1}>{ing.food_name}</Text>
                  <TextInput style={styles.portionInput} value={String(ing.portion_grams)} onChangeText={(t) => {
                    const updated = [...newRecipe.ingredients];
                    updated[index].portion_grams = parseInt(t) || 0;
                    setNewRecipe(prev => ({ ...prev, ingredients: updated }));
                  }} keyboardType="numeric" />
                  <Text style={styles.portionLabel}>g</Text>
                  <TouchableOpacity onPress={() => removeIngredient(index)}>
                    <Ionicons name="close-circle" size={20} color="#ff6b6b" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.createRecipeBtn} onPress={createRecipe}>
              <Text style={styles.createRecipeBtnText}>Create Recipe</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  recipeCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  recipeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  recipeIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(78, 205, 196, 0.1)', justifyContent: 'center', alignItems: 'center' },
  recipeInfo: { flex: 1, marginLeft: 12 },
  recipeName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  recipeMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  nutrientRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#2a2a4e', borderRadius: 10, padding: 12 },
  nutrientItem: { alignItems: 'center' },
  nutrientValue: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  nutrientLabel: { fontSize: 10, color: '#888', marginTop: 2 },
  allergenRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  allergenText: { color: '#ff6b6b', fontSize: 12, marginLeft: 6 },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyText: { color: '#fff', fontSize: 18, marginTop: 16 },
  emptySubtext: { color: '#666', marginTop: 8, textAlign: 'center' },
  createBtn: { backgroundColor: '#00d4ff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 24 },
  createBtnText: { color: '#fff', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a4e' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalScroll: { padding: 20, maxHeight: 500 },
  inputLabel: { color: '#888', fontSize: 13, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#2a2a4e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchBtn: { backgroundColor: '#00d4ff', padding: 14, borderRadius: 10 },
  searchResult: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#2a2a4e', borderRadius: 8, marginTop: 8 },
  searchResultText: { color: '#fff', marginLeft: 10, flex: 1 },
  ingredientItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a4e', padding: 12, borderRadius: 8, marginTop: 8 },
  ingredientName: { flex: 1, color: '#fff', fontSize: 14 },
  portionInput: { backgroundColor: '#1a1a2e', borderRadius: 6, padding: 8, color: '#fff', width: 60, textAlign: 'center' },
  portionLabel: { color: '#888', marginLeft: 4, marginRight: 12 },
  createRecipeBtn: { backgroundColor: '#00d4ff', margin: 20, padding: 16, borderRadius: 12, alignItems: 'center' },
  createRecipeBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
