import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../src/LanguageContext';
import { SkeletonFoodDetail } from '../src/components/Skeleton';

const MEAL_TYPES = [
  { id: 'breakfast', icon: 'sunny', color: '#ffd93d' },
  { id: 'lunch', icon: 'restaurant', color: '#4ecdc4' },
  { id: 'dinner', icon: 'moon', color: '#a29bfe' },
  { id: 'snack', icon: 'cafe', color: '#ff6b6b' },
];

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface FoodAnalysis {
  fdc_id: number;
  food_name: string;
  portion_grams: number;
  cooking_method: string;
  nutrients: {
    raw: Record<string, number>;
    cooked: Record<string, number>;
    retention_applied: boolean;
  };
  elements: {
    mass_grams: Record<string, number>;
    millimoles: Record<string, number>;
    confidence: string;
  };
  allergens: string[];
  biological_effects: Record<string, string[]>;
  cooking_recommendations: {
    recommended_method: string;
    method_rankings: Array<{ method: string; avg_retention: number }>;
    safety_requirements?: {
      fahrenheit: number;
      celsius: number;
      description: string;
    };
    tips: string[];
  };
  data_source: string;
  confidence: string;
}

const COOKING_METHODS = ['raw', 'steaming', 'boiling', 'baking', 'frying'];

export default function FoodDetailsScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [portionGrams, setPortionGrams] = useState(100);
  const [cookingMethod, setCookingMethod] = useState('raw');
  const [mealType, setMealType] = useState((params.meal_type as string) || 'snack');
  const [saving, setSaving] = useState(false);

  const fetchAnalysis = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/foods/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fdc_id: Number(params.fdc_id),
          portion_grams: portionGrams,
          cooking_method: cookingMethod
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [params.fdc_id, portionGrams, cookingMethod]);

  const handleAddToLog = async () => {
    if (!analysis) return;
    
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        Alert.alert(t('alert_error'), t('alert_error'));
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/meals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fdc_id: analysis.fdc_id,
          food_name: analysis.food_name,
          portion_grams: analysis.portion_grams,
          meal_type: mealType,
          cooking_method: analysis.cooking_method,
          nutrients: analysis.nutrients.cooked,
          elements: analysis.elements.mass_grams,
          allergens: analysis.allergens
        })
      });

      if (response.ok) {
        Alert.alert(t('common_save'), t('common_save'));
        router.back();
      } else {
        Alert.alert(t('alert_error'), t('alert_failed_meal_update'));
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      Alert.alert(t('alert_error'), t('alert_failed_meal_update'));
    } finally {
      setSaving(false);
    }
  };

  const formatNumber = (num: number | undefined) => {
    if (num === undefined || num === null) return '0';
    return num < 1 ? num.toFixed(3) : num.toFixed(1);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <SkeletonFoodDetail />
      </SafeAreaView>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={48} color="#ff6b6b" />
        <Text style={styles.errorText}>Failed to load food data</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.foodName}>{analysis.food_name}</Text>
          <View style={styles.sourceBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#4ecdc4" />
            <Text style={styles.sourceText}>{analysis.data_source}</Text>
          </View>
        </View>

        {/* Portion Selector */}
        <View style={styles.selectorCard}>
          <Text style={styles.selectorLabel}>Portion Size (grams)</Text>
          <View style={styles.portionButtons}>
            {[50, 100, 150, 200, 250].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.portionBtn, portionGrams === g && styles.portionBtnActive]}
                onPress={() => setPortionGrams(g)}
              >
                <Text style={[styles.portionBtnText, portionGrams === g && styles.portionBtnTextActive]}>{g}g</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cooking Method */}
        <View style={styles.selectorCard}>
          <Text style={styles.selectorLabel}>Cooking Method</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.cookingButtons}>
              {COOKING_METHODS.map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[styles.cookingBtn, cookingMethod === method && styles.cookingBtnActive]}
                  onPress={() => setCookingMethod(method)}
                >
                  <Ionicons
                    name={method === 'raw' ? 'leaf' : method === 'steaming' ? 'water' : method === 'boiling' ? 'water-outline' : method === 'baking' ? 'flame' : 'restaurant'}
                    size={20}
                    color={cookingMethod === method ? '#fff' : '#888'}
                  />
                  <Text style={[styles.cookingBtnText, cookingMethod === method && styles.cookingBtnTextActive]}>
                    {t(`nutr_${method}`) || method.charAt(0).toUpperCase() + method.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Allergen Alert */}
        {analysis.allergens.length > 0 && (
          <View style={styles.allergenCard}>
            <View style={styles.allergenHeader}>
              <Ionicons name="warning" size={20} color="#ff6b6b" />
              <Text style={styles.allergenTitle}>Allergen Alert</Text>
            </View>
            <View style={styles.allergenTags}>
              {analysis.allergens.map((allergen, i) => (
                <View key={i} style={styles.allergenTag}>
                  <Text style={styles.allergenText}>{allergen}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Macronutrients */}
        <View style={styles.nutrientsCard}>
          <Text style={styles.cardTitle}>Macronutrients</Text>
          <View style={styles.macrosGrid}>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{formatNumber(analysis.nutrients.cooked.energy_kcal)}</Text>
              <Text style={styles.macroLabel}>kcal</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{formatNumber(analysis.nutrients.cooked.protein_g)}</Text>
              <Text style={styles.macroLabel}>Protein (g)</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{formatNumber(analysis.nutrients.cooked.carbohydrate_g)}</Text>
              <Text style={styles.macroLabel}>Carbs (g)</Text>
            </View>
            <View style={styles.macroItem}>
              <Text style={styles.macroValue}>{formatNumber(analysis.nutrients.cooked.fat_g)}</Text>
              <Text style={styles.macroLabel}>Fat (g)</Text>
            </View>
          </View>
          {analysis.nutrients.retention_applied && (
            <Text style={styles.retentionNote}>* Nutrients adjusted for {cookingMethod} cooking retention</Text>
          )}
        </View>

        {/* Elemental Composition */}
        <View style={styles.elementsCard}>
          <Text style={styles.cardTitle}>{t('fd_elements')}</Text>
          <Text style={styles.confidenceBadge}>Confidence: {analysis.elements.confidence}</Text>
          
          <View style={styles.elementsGrid}>
            {Object.entries(analysis.elements.mass_grams)
              .filter(([_, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([element, mass]) => (
                <View key={element} style={styles.elementItem}>
                  <View style={[styles.elementBadge, { backgroundColor: getElementColor(element) }]}>
                    <Text style={styles.elementSymbol}>{element}</Text>
                  </View>
                  <Text style={styles.elementMass}>{formatNumber(mass)}g</Text>
                  <Text style={styles.elementMoles}>{formatNumber(analysis.elements.millimoles[element])} mmol</Text>
                </View>
              ))}
          </View>
        </View>

        {/* Biological Effects */}
        {Object.keys(analysis.biological_effects).length > 0 && (
          <View style={styles.effectsCard}>
            <Text style={styles.cardTitle}>Biological Effects</Text>
            {Object.entries(analysis.biological_effects).slice(0, 5).map(([element, effects]) => (
              <View key={element} style={styles.effectItem}>
                <View style={[styles.effectBadge, { backgroundColor: getElementColor(element) }]}>
                  <Text style={styles.effectSymbol}>{element}</Text>
                </View>
                <View style={styles.effectsList}>
                  {effects.map((effect, i) => (
                    <Text key={i} style={styles.effectText}>• {effect}</Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Vitamins & Minerals */}
        <View style={styles.vitaminsCard}>
          <Text style={styles.cardTitle}>{t('fd_vitamins')}</Text>
          <View style={styles.vitaminsGrid}>
            {[
              { key: 'vitamin_a_mcg', label: 'Vitamin A', unit: 'mcg' },
              { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg' },
              { key: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'mcg' },
              { key: 'iron_mg', label: 'Iron', unit: 'mg' },
              { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg' },
              { key: 'potassium_mg', label: 'Potassium', unit: 'mg' },
              { key: 'zinc_mg', label: 'Zinc', unit: 'mg' },
              { key: 'calcium_mg', label: 'Calcium', unit: 'mg' },
            ].map((item) => (
              <View key={item.key} style={styles.vitaminItem}>
                <Text style={styles.vitaminLabel}>{item.label}</Text>
                <Text style={styles.vitaminValue}>
                  {formatNumber(analysis.nutrients.cooked[item.key])} {item.unit}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Cooking Recommendations */}
        <View style={styles.cookingCard}>
          <Text style={styles.cardTitle}>Cooking Recommendations</Text>
          
          {analysis.cooking_recommendations.safety_requirements && (
            <View style={styles.safetyAlert}>
              <Ionicons name="thermometer" size={20} color="#ff6b6b" />
              <View style={styles.safetyInfo}>
                <Text style={styles.safetyTitle}>Safe Minimum Temperature</Text>
                <Text style={styles.safetyTemp}>
                  {analysis.cooking_recommendations.safety_requirements.fahrenheit}°F / 
                  {analysis.cooking_recommendations.safety_requirements.celsius}°C
                </Text>
                <Text style={styles.safetyDesc}>
                  {analysis.cooking_recommendations.safety_requirements.description}
                </Text>
              </View>
            </View>
          )}

          <Text style={styles.recMethodTitle}>Best Methods for Nutrient Retention</Text>
          {analysis.cooking_recommendations.method_rankings.map((method, i) => (
            <View key={method.method} style={styles.methodRank}>
              <Text style={styles.rankNumber}>#{i + 1}</Text>
              <Text style={styles.rankMethod}>{method.method}</Text>
              <View style={styles.retentionBar}>
                <View style={[styles.retentionFill, { width: `${method.avg_retention}%` }]} />
              </View>
              <Text style={styles.retentionPct}>{method.avg_retention}%</Text>
            </View>
          ))}

          {analysis.cooking_recommendations?.tips && analysis.cooking_recommendations.tips.length > 0 && (
            <View style={styles.tipsSection}>
              <Text style={styles.tipsTitle}>Tips</Text>
              {analysis.cooking_recommendations.tips.map((tip: string, i: number) => (
                <Text key={i} style={styles.tipText}>• {tip}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Add to Log Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddToLog}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Add to My Log</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const getElementColor = (element: string) => {
  const colors: Record<string, string> = {
    'C': '#444', 'H': '#00d4ff', 'O': '#ff6b6b', 'N': '#4ecdc4', 'S': '#ffd93d',
    'Fe': '#ff6b6b', 'Ca': '#74b9ff', 'K': '#ffd93d', 'Mg': '#4ecdc4', 'Zn': '#a29bfe',
    'P': '#fd79a8', 'Na': '#fdcb6e', 'Cu': '#e17055', 'Mn': '#00b894', 'Se': '#6c5ce7'
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
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f0f23',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
  },
  errorText: {
    color: '#ff6b6b',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    marginBottom: 20,
  },
  foodName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceText: {
    color: '#4ecdc4',
    fontSize: 12,
    marginLeft: 6,
  },
  selectorCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  selectorLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
  },
  portionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  portionBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a4e',
  },
  portionBtnActive: {
    backgroundColor: '#00d4ff',
  },
  portionBtnText: {
    color: '#888',
    fontWeight: '500',
  },
  portionBtnTextActive: {
    color: '#fff',
  },
  cookingButtons: {
    flexDirection: 'row',
  },
  cookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a4e',
    marginRight: 8,
  },
  cookingBtnActive: {
    backgroundColor: '#00d4ff',
  },
  cookingBtnText: {
    color: '#888',
    marginLeft: 6,
    fontWeight: '500',
  },
  cookingBtnTextActive: {
    color: '#fff',
  },
  allergenCard: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  allergenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  allergenTitle: {
    color: '#ff6b6b',
    fontWeight: '600',
    marginLeft: 8,
  },
  allergenTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  allergenTag: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
  },
  allergenText: {
    color: '#ff6b6b',
    fontSize: 12,
  },
  nutrientsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  macrosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  macroLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  retentionNote: {
    fontSize: 11,
    color: '#ffd93d',
    marginTop: 12,
    fontStyle: 'italic',
  },
  elementsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  confidenceBadge: {
    color: '#4ecdc4',
    fontSize: 11,
    marginTop: -8,
    marginBottom: 16,
  },
  elementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  elementItem: {
    width: '18%',
    alignItems: 'center',
    marginBottom: 16,
  },
  elementBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  elementSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  elementMass: {
    fontSize: 11,
    color: '#fff',
  },
  elementMoles: {
    fontSize: 9,
    color: '#888',
  },
  effectsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  effectItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  effectBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  effectSymbol: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  effectsList: {
    flex: 1,
  },
  effectText: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 18,
  },
  vitaminsCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  vitaminsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  vitaminItem: {
    width: '50%',
    marginBottom: 12,
  },
  vitaminLabel: {
    fontSize: 12,
    color: '#888',
  },
  vitaminValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 2,
  },
  cookingCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  safetyAlert: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  safetyInfo: {
    marginLeft: 12,
    flex: 1,
  },
  safetyTitle: {
    color: '#ff6b6b',
    fontWeight: '600',
    fontSize: 13,
  },
  safetyTemp: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  safetyDesc: {
    color: '#888',
    fontSize: 11,
    marginTop: 4,
  },
  recMethodTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 12,
  },
  methodRank: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rankNumber: {
    color: '#00d4ff',
    fontWeight: 'bold',
    width: 24,
  },
  rankMethod: {
    color: '#fff',
    width: 70,
    fontSize: 13,
  },
  retentionBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#2a2a4e',
    borderRadius: 3,
    marginHorizontal: 8,
  },
  retentionFill: {
    height: 6,
    backgroundColor: '#4ecdc4',
    borderRadius: 3,
  },
  retentionPct: {
    color: '#4ecdc4',
    fontSize: 12,
    width: 40,
    textAlign: 'right',
  },
  tipsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4e',
  },
  tipsTitle: {
    color: '#ffd93d',
    fontWeight: '600',
    marginBottom: 8,
  },
  tipText: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00d4ff',
    padding: 16,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
