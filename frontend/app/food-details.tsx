import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../src/LanguageContext';
import { SkeletonFoodDetail } from '../src/components/Skeleton';
import { hapticSuccess, hapticLight } from '../src/haptics';
import { MacroCard, ElementalSection, CookingSection, NutrientGrid, GlycemicCard } from '../src/components/food-details';

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
  phytochemicals?: Record<string, number>;
  cofactors?: Record<string, number>;
  glycemic_index?: number;
  glycemic_load?: number;
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
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Check if this food is already a favorite
  const checkFavorite = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/favorites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const favIds = (data.favorites || []).map((f: any) => f.fdc_id);
        setIsFavorite(favIds.includes(Number(params.fdc_id)));
      }
    } catch (_) {}
  };

  const toggleFavorite = async () => {
    if (!analysis) return;
    setFavoriteLoading(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      if (isFavorite) {
        // Remove from favorites
        await fetch(`${BACKEND_URL}/api/favorites/${analysis.fdc_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setIsFavorite(false);
        hapticLight();
      } else {
        // Add to favorites
        const res = await fetch(`${BACKEND_URL}/api/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            fdc_id: analysis.fdc_id,
            food_name: analysis.food_name,
            default_portion_grams: portionGrams,
            default_cooking_method: cookingMethod,
          })
        });
        if (res.ok) {
          setIsFavorite(true);
          hapticSuccess();
        }
      }
    } catch (e) {
      console.error('Favorite toggle error:', e);
    } finally {
      setFavoriteLoading(false);
    }
  };

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
    checkFavorite();
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
          <View style={{ flex: 1 }}>
            <Text style={styles.foodName}>{analysis.food_name}</Text>
            <View style={styles.sourceBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#4ecdc4" />
              <Text style={styles.sourceText}>{analysis.data_source}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.favBtn, isFavorite && styles.favBtnActive]}
            onPress={toggleFavorite}
            disabled={favoriteLoading}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? '#ff6b6b' : '#888'}
            />
          </TouchableOpacity>
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
        <MacroCard
          nutrients={analysis.nutrients.cooked}
          retentionApplied={analysis.nutrients.retention_applied}
          cookingMethod={cookingMethod}
          formatNumber={formatNumber}
        />

        {/* Elemental Composition & Biological Effects */}
        <ElementalSection
          elements={analysis.elements}
          biologicalEffects={analysis.biological_effects}
          formatNumber={formatNumber}
          elementsTitle={t('fd_elements')}
        />

        {/* Vitamins & Minerals */}
        <View style={styles.vitaminsCard}>
          <Text style={styles.cardTitle}>{t('fd_vitamins')}</Text>
          <View style={styles.vitaminsGrid}>
            {[
              { key: 'vitamin_a_mcg', label: 'Vitamin A', unit: 'µg' },
              { key: 'vitamin_b1_mg', label: 'Vitamin B1', unit: 'mg' },
              { key: 'vitamin_b2_mg', label: 'Vitamin B2', unit: 'mg' },
              { key: 'vitamin_b3_mg', label: 'Vitamin B3', unit: 'mg' },
              { key: 'vitamin_b5_mg', label: 'Vitamin B5', unit: 'mg' },
              { key: 'vitamin_b6_mg', label: 'Vitamin B6', unit: 'mg' },
              { key: 'folate_mcg', label: 'Folate (B9)', unit: 'µg' },
              { key: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'µg' },
              { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg' },
              { key: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'µg' },
              { key: 'vitamin_e_mg', label: 'Vitamin E', unit: 'mg' },
              { key: 'vitamin_k_mcg', label: 'Vitamin K', unit: 'µg' },
              { key: 'calcium_mg', label: 'Calcium', unit: 'mg' },
              { key: 'iron_mg', label: 'Iron', unit: 'mg' },
              { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg' },
              { key: 'phosphorus_mg', label: 'Phosphorus', unit: 'mg' },
              { key: 'potassium_mg', label: 'Potassium', unit: 'mg' },
              { key: 'sodium_mg', label: 'Sodium', unit: 'mg' },
              { key: 'zinc_mg', label: 'Zinc', unit: 'mg' },
              { key: 'copper_mg', label: 'Copper', unit: 'mg' },
              { key: 'manganese_mg', label: 'Manganese', unit: 'mg' },
              { key: 'selenium_mcg', label: 'Selenium', unit: 'µg' },
              { key: 'choline_mg', label: 'Choline', unit: 'mg' },
              { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg' },
              { key: 'saturated_fat_g', label: 'Saturated Fat', unit: 'g' },
              { key: 'monounsaturated_fat_g', label: 'Monounsat. Fat', unit: 'g' },
              { key: 'polyunsaturated_fat_g', label: 'Polyunsat. Fat', unit: 'g' },
              { key: 'trans_fat_g', label: 'Trans Fat', unit: 'g' },
            ].filter(item => analysis.nutrients.cooked[item.key] != null && analysis.nutrients.cooked[item.key] > 0)
            .map((item) => (
              <View key={item.key} style={styles.vitaminItem}>
                <Text style={styles.vitaminLabel}>{item.label}</Text>
                <Text style={styles.vitaminValue}>
                  {formatNumber(analysis.nutrients.cooked[item.key])} {item.unit}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Amino Acids */}
        {(() => {
          const aminoAcids = [
            { key: 'histidine_mg', label: 'Histidine' },
            { key: 'isoleucine_mg', label: 'Isoleucine' },
            { key: 'leucine_mg', label: 'Leucine' },
            { key: 'lysine_mg', label: 'Lysine' },
            { key: 'methionine_mg', label: 'Methionine' },
            { key: 'phenylalanine_mg', label: 'Phenylalanine' },
            { key: 'threonine_mg', label: 'Threonine' },
            { key: 'tryptophan_mg', label: 'Tryptophan' },
            { key: 'valine_mg', label: 'Valine' },
            { key: 'arginine_mg', label: 'Arginine*' },
            { key: 'cystine_mg', label: 'Cystine*' },
            { key: 'tyrosine_mg', label: 'Tyrosine*' },
            { key: 'glycine_mg', label: 'Glycine*' },
            { key: 'proline_mg', label: 'Proline*' },
          ].filter(i => (analysis.nutrients.cooked[i.key] || 0) > 0);
          if (aminoAcids.length === 0) return null;
          return (
            <View style={styles.vitaminsCard}>
              <Text style={styles.cardTitle}>🧬 Amino Acids</Text>
              <Text style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>*semi-essential</Text>
              <View style={styles.vitaminsGrid}>
                {aminoAcids.map(item => (
                  <View key={item.key} style={styles.vitaminItem}>
                    <Text style={styles.vitaminLabel}>{item.label}</Text>
                    <Text style={styles.vitaminValue}>{formatNumber(analysis.nutrients.cooked[item.key])} mg</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Omega Fatty Acids */}
        {(() => {
          const omegas = [
            { key: 'omega3_ala_g', label: 'Omega-3 ALA' },
            { key: 'omega3_epa_g', label: 'Omega-3 EPA' },
            { key: 'omega3_dha_g', label: 'Omega-3 DHA' },
            { key: 'omega3_total_g', label: '∑ Omega-3 Total' },
            { key: 'omega6_la_g', label: 'Omega-6 LA' },
            { key: 'omega6_aa_g', label: 'Omega-6 AA' },
            { key: 'omega6_total_g', label: '∑ Omega-6 Total' },
          ].filter(i => (analysis.nutrients.cooked[i.key] || 0) > 0);
          if (omegas.length === 0) return null;
          return (
            <View style={styles.vitaminsCard}>
              <Text style={styles.cardTitle}>🐟 Essential Fatty Acids</Text>
              <View style={styles.vitaminsGrid}>
                {omegas.map(item => (
                  <View key={item.key} style={styles.vitaminItem}>
                    <Text style={styles.vitaminLabel}>{item.label}</Text>
                    <Text style={styles.vitaminValue}>{formatNumber(analysis.nutrients.cooked[item.key])} g</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Carotenoids */}
        {(() => {
          const carotenoids = [
            { key: 'beta_carotene_mcg', label: 'Beta-Carotene' },
            { key: 'alpha_carotene_mcg', label: 'Alpha-Carotene' },
            { key: 'lycopene_mcg', label: 'Lycopene' },
            { key: 'lutein_zeaxanthin_mcg', label: 'Lutein + Zeaxanthin' },
            { key: 'beta_cryptoxanthin_mcg', label: 'Beta-Cryptoxanthin' },
          ].filter(i => (analysis.nutrients.cooked[i.key] || 0) > 0);
          if (carotenoids.length === 0) return null;
          return (
            <View style={styles.vitaminsCard}>
              <Text style={styles.cardTitle}>🌿 Carotenoids</Text>
              <View style={styles.vitaminsGrid}>
                {carotenoids.map(item => (
                  <View key={item.key} style={styles.vitaminItem}>
                    <Text style={styles.vitaminLabel}>{item.label}</Text>
                    <Text style={styles.vitaminValue}>{formatNumber(analysis.nutrients.cooked[item.key])} µg</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })()}

        {/* Phytochemicals & Cofactors (AI-estimated) */}
        {analysis.phytochemicals && Object.keys(analysis.phytochemicals).some(k => (analysis.phytochemicals as any)[k] > 0) && (
          <View style={styles.vitaminsCard}>
            <Text style={styles.cardTitle}>🔬 Phytochemicals & Bioactives</Text>
            <Text style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>AI-estimated from scientific literature</Text>
            <View style={styles.vitaminsGrid}>
              {Object.entries(analysis.phytochemicals || {})
                .filter(([_, v]) => v > 0)
                .map(([key, value]) => (
                  <View key={key} style={styles.vitaminItem}>
                    <Text style={styles.vitaminLabel}>
                      {key.replace(/_mg$/, '').replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Text>
                    <Text style={styles.vitaminValue}>{formatNumber(value)} mg</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Cellular Cofactors (AI-estimated) */}
        {analysis.cofactors && Object.keys(analysis.cofactors).some(k => (analysis.cofactors as any)[k] > 0) && (
          <View style={styles.vitaminsCard}>
            <Text style={styles.cardTitle}>⚡ Cellular Cofactors</Text>
            <Text style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>AI-estimated from scientific literature</Text>
            <View style={styles.vitaminsGrid}>
              {Object.entries(analysis.cofactors || {})
                .filter(([_, v]) => v > 0)
                .map(([key, value]) => (
                  <View key={key} style={styles.vitaminItem}>
                    <Text style={styles.vitaminLabel}>
                      {key.replace(/_mg$/, '').replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Text>
                    <Text style={styles.vitaminValue}>{formatNumber(value)} mg</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Glycemic Index */}
        <GlycemicCard
          glycemicIndex={analysis.glycemic_index || 0}
          glycemicLoad={analysis.glycemic_load || 0}
        />

        {/* Cooking Recommendations */}
        <CookingSection recommendations={analysis.cooking_recommendations} />

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
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  favBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 12, marginTop: 2,
  },
  favBtnActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
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
