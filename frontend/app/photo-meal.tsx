import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView,
  ActivityIndicator, Alert, Image, Platform, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, ThemeColors } from '../src/ThemeContext';
import { useLanguage } from '../src/LanguageContext';
import { hapticLight, hapticSuccess, hapticWarning } from '../src/haptics';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AnalysisFood = {
  food_name: string;
  portion_grams: number;
  confidence: number;
  nutrients: {
    energy_kcal: number;
    protein_g: number;
    carbohydrate_g: number;
    fat_g: number;
    fiber_g: number;
  };
  cooking_method: string;
  selected: boolean;
};

type AnalysisResult = {
  analysis_id: string | null;
  foods: AnalysisFood[];
  meal_description: string;
  total_calories: number;
  health_score: number;
  suggestions: string;
};

type ScreenState = 'choose' | 'camera' | 'preview' | 'analyzing' | 'results';

export default function PhotoMealScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, locale } = useLanguage();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const cameraRef = useRef<any>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [screenState, setScreenState] = useState<ScreenState>('choose');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [mealType, setMealType] = useState<string>('lunch');
  const [logging, setLogging] = useState(false);

  const MEAL_TYPES = [
    { id: 'breakfast', label: t('photo_breakfast'), icon: 'sunny' },
    { id: 'lunch', label: t('photo_lunch'), icon: 'restaurant' },
    { id: 'dinner', label: t('photo_dinner'), icon: 'moon' },
    { id: 'snack', label: t('photo_snack'), icon: 'cafe' },
  ];

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    hapticLight();
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        exif: false,
      });
      setImageUri(photo.uri);
      setImageBase64(photo.base64);
      setScreenState('preview');
    } catch (e) {
      Alert.alert(t('common_error'), t('photo_capture_failed'));
    }
  };

  const pickFromGallery = async () => {
    hapticLight();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      setScreenState('preview');
    }
  };

  const openCamera = async () => {
    hapticLight();
    if (Platform.OS === 'web') {
      // On web, use image picker instead
      pickFromGallery();
      return;
    }
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        Alert.alert(t('photo_permission_title'), t('photo_permission_desc'));
        return;
      }
    }
    setScreenState('camera');
  };

  const analyzePhoto = async () => {
    if (!imageBase64) {
      Alert.alert(t('common_error'), t('photo_no_image'));
      return;
    }
    hapticLight();
    setScreenState('analyzing');
    setAnalyzing(true);

    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        Alert.alert(t('common_error'), 'Not authenticated');
        setScreenState('preview');
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/ai/analyze-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          image_base64: imageBase64,
          mime_type: 'image/jpeg',
          meal_type: mealType,
          language: locale,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Analysis failed');
      }

      const data = await response.json();
      // Add selected=true to all foods by default
      const foodsWithSelection = (data.foods || []).map((f: any) => ({ ...f, selected: true }));
      setResult({ ...data, foods: foodsWithSelection });
      setScreenState('results');
      hapticSuccess();
    } catch (e: any) {
      hapticWarning();
      Alert.alert(t('common_error'), e.message || t('photo_analysis_failed'));
      setScreenState('preview');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleFoodSelection = (index: number) => {
    if (!result) return;
    hapticLight();
    const updated = [...result.foods];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    setResult({ ...result, foods: updated });
  };

  const logSelectedFoods = async () => {
    if (!result) return;
    const selectedFoods = result.foods.filter(f => f.selected);
    if (selectedFoods.length === 0) {
      Alert.alert(t('photo_no_selection'), t('photo_select_at_least_one'));
      return;
    }

    hapticLight();
    setLogging(true);

    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/ai/photo-log-meal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          foods: selectedFoods.map(f => ({
            food_name: f.food_name,
            portion_grams: f.portion_grams,
            nutrients: f.nutrients,
            cooking_method: f.cooking_method,
          })),
          meal_type: mealType,
          analysis_id: result.analysis_id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        hapticSuccess();
        Alert.alert(
          t('photo_logged_title'),
          `${data.logged_count} ${t('photo_foods_logged')}`,
          [{ text: t('common_ok'), onPress: () => router.back() }]
        );
      } else {
        throw new Error('Failed to log');
      }
    } catch (e) {
      hapticWarning();
      Alert.alert(t('common_error'), t('photo_log_failed'));
    } finally {
      setLogging(false);
    }
  };

  const resetFlow = () => {
    hapticLight();
    setImageUri(null);
    setImageBase64(null);
    setResult(null);
    setScreenState('choose');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return theme.success;
    if (confidence >= 0.6) return theme.warning;
    return theme.danger;
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 7) return theme.success;
    if (score >= 5) return theme.warning;
    return theme.danger;
  };

  // ═══════ CHOOSE SOURCE SCREEN ═══════
  if (screenState === 'choose') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('photo_title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.chooseContainer}>
          <View style={styles.heroSection}>
            <View style={styles.heroIcon}>
              <Ionicons name="camera" size={48} color={theme.accent} />
            </View>
            <Text style={styles.heroTitle}>{t('photo_hero_title')}</Text>
            <Text style={styles.heroSubtitle}>{t('photo_hero_subtitle')}</Text>
          </View>

          {/* Meal Type Selector */}
          <Text style={styles.sectionLabel}>{t('photo_meal_type')}</Text>
          <View style={styles.mealTypeRow}>
            {MEAL_TYPES.map(mt => (
              <TouchableOpacity
                key={mt.id}
                style={[styles.mealTypeBtn, mealType === mt.id && styles.mealTypeBtnActive]}
                onPress={() => { hapticLight(); setMealType(mt.id); }}
              >
                <Ionicons name={mt.icon as any} size={18} color={mealType === mt.id ? '#fff' : theme.textMuted} />
                <Text style={[styles.mealTypeBtnText, mealType === mt.id && styles.mealTypeBtnTextActive]}>
                  {mt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.primaryBtn} onPress={openCamera}>
              <Ionicons name="camera" size={24} color="#fff" />
              <Text style={styles.primaryBtnText}>{t('photo_take_photo')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromGallery}>
              <Ionicons name="images" size={24} color={theme.accent} />
              <Text style={styles.secondaryBtnText}>{t('photo_from_gallery')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tipCard}>
            <Ionicons name="bulb" size={18} color={theme.warning} />
            <Text style={styles.tipText}>{t('photo_tip')}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════ CAMERA SCREEN ═══════
  if (screenState === 'camera') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing="back"
          />
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraTopBar}>
              <TouchableOpacity onPress={() => setScreenState('choose')} style={styles.cameraCloseBtn}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.cameraGuide}>
              <View style={styles.guideFrame} />
              <Text style={styles.cameraGuideText}>{t('photo_camera_guide')}</Text>
            </View>
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
                <Ionicons name="images" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.captureBtn} onPress={takePhoto}>
                <View style={styles.captureBtnInner} />
              </TouchableOpacity>
              <View style={{ width: 50 }} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════ PREVIEW SCREEN ═══════
  if (screenState === 'preview') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetFlow} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('photo_preview')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.previewContainer}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
          )}
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.retakeBtn} onPress={resetFlow}>
              <Ionicons name="refresh" size={20} color={theme.text} />
              <Text style={styles.retakeBtnText}>{t('photo_retake')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.analyzeBtn} onPress={analyzePhoto}>
              <Ionicons name="sparkles" size={20} color="#fff" />
              <Text style={styles.analyzeBtnText}>{t('photo_analyze')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════ ANALYZING SCREEN ═══════
  if (screenState === 'analyzing') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.analyzingContainer}>
          <View style={styles.analyzingIcon}>
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
          <Text style={styles.analyzingTitle}>{t('photo_analyzing')}</Text>
          <Text style={styles.analyzingSubtitle}>{t('photo_analyzing_desc')}</Text>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.analyzingThumb} resizeMode="cover" />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ═══════ RESULTS SCREEN ═══════
  if (screenState === 'results' && result) {
    const selectedCount = result.foods.filter(f => f.selected).length;
    const selectedCalories = result.foods.filter(f => f.selected)
      .reduce((sum, f) => sum + (f.nutrients?.energy_kcal || 0), 0);

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetFlow} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('photo_results')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.resultsScroll} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Meal Description */}
          <View style={styles.descCard}>
            <Text style={styles.descText}>{result.meal_description}</Text>
            <View style={styles.descMeta}>
              <View style={styles.descMetaItem}>
                <Ionicons name="flame" size={16} color={theme.orange} />
                <Text style={styles.descMetaText}>{result.total_calories} kcal</Text>
              </View>
              <View style={styles.descMetaItem}>
                <Ionicons name="heart" size={16} color={getHealthScoreColor(result.health_score)} />
                <Text style={[styles.descMetaText, { color: getHealthScoreColor(result.health_score) }]}>
                  {result.health_score}/10
                </Text>
              </View>
            </View>
          </View>

          {/* Food Items */}
          <Text style={styles.sectionTitle}>{t('photo_identified_foods')} ({result.foods.length})</Text>
          {result.foods.map((food, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.foodCard, food.selected && styles.foodCardSelected]}
              onPress={() => toggleFoodSelection(index)}
            >
              <View style={styles.foodCardHeader}>
                <View style={styles.foodCheckbox}>
                  {food.selected ? (
                    <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={24} color={theme.textMuted} />
                  )}
                </View>
                <View style={styles.foodInfo}>
                  <Text style={styles.foodName}>{food.food_name}</Text>
                  <Text style={styles.foodPortion}>{food.portion_grams}g • {food.cooking_method}</Text>
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: `${getConfidenceColor(food.confidence)}20` }]}>
                  <Text style={[styles.confidenceText, { color: getConfidenceColor(food.confidence) }]}>
                    {Math.round(food.confidence * 100)}%
                  </Text>
                </View>
              </View>
              <View style={styles.foodNutrients}>
                <View style={styles.nutrientPill}>
                  <Text style={styles.nutrientPillLabel}>{t('photo_cal')}</Text>
                  <Text style={styles.nutrientPillValue}>{food.nutrients?.energy_kcal || 0}</Text>
                </View>
                <View style={styles.nutrientPill}>
                  <Text style={styles.nutrientPillLabel}>{t('photo_prot')}</Text>
                  <Text style={styles.nutrientPillValue}>{food.nutrients?.protein_g || 0}g</Text>
                </View>
                <View style={styles.nutrientPill}>
                  <Text style={styles.nutrientPillLabel}>{t('photo_carbs')}</Text>
                  <Text style={styles.nutrientPillValue}>{food.nutrients?.carbohydrate_g || 0}g</Text>
                </View>
                <View style={styles.nutrientPill}>
                  <Text style={styles.nutrientPillLabel}>{t('photo_fat')}</Text>
                  <Text style={styles.nutrientPillValue}>{food.nutrients?.fat_g || 0}g</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {/* Suggestions */}
          {result.suggestions ? (
            <View style={styles.suggestCard}>
              <Ionicons name="bulb" size={18} color={theme.warning} />
              <Text style={styles.suggestText}>{result.suggestions}</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomInfoText}>
              {selectedCount} {t('photo_selected')} • {Math.round(selectedCalories)} kcal
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.logBtn, selectedCount === 0 && styles.logBtnDisabled]}
            onPress={logSelectedFoods}
            disabled={logging || selectedCount === 0}
          >
            {logging ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.logBtnText}>{t('photo_log_meals')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const makeStyles = (theme: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },

  // Choose Screen
  chooseContainer: { flex: 1, padding: 20 },
  heroSection: { alignItems: 'center', marginTop: 20, marginBottom: 32 },
  heroIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: `${theme.accent}15`, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: theme.text, textAlign: 'center' },
  heroSubtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  mealTypeRow: { flexDirection: 'row', marginBottom: 28 },
  mealTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, backgroundColor: theme.bgInput, marginHorizontal: 3 },
  mealTypeBtnActive: { backgroundColor: theme.accent },
  mealTypeBtnText: { fontSize: 12, color: theme.textMuted, marginLeft: 4, fontWeight: '500' },
  mealTypeBtnTextActive: { color: '#fff' },
  actionButtons: { gap: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accent, paddingVertical: 18, borderRadius: 14, gap: 10 },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bgCard, paddingVertical: 18, borderRadius: 14, gap: 10, borderWidth: 1, borderColor: theme.accent + '40', marginTop: 12 },
  secondaryBtnText: { fontSize: 17, fontWeight: '600', color: theme.accent },
  tipCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: `${theme.warning}10`, padding: 14, borderRadius: 10, marginTop: 24, gap: 10 },
  tipText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 18 },

  // Camera
  cameraContainer: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  cameraTopBar: { flexDirection: 'row', justifyContent: 'flex-start', padding: 16, paddingTop: 50 },
  cameraCloseBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  cameraGuide: { alignItems: 'center' },
  guideFrame: { width: SCREEN_WIDTH * 0.75, height: SCREEN_WIDTH * 0.75, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 16, borderStyle: 'dashed' },
  cameraGuideText: { color: '#fff', fontSize: 14, marginTop: 12, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  cameraBottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 40, paddingBottom: 50 },
  galleryBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  captureBtnInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff' },

  // Preview
  previewContainer: { flex: 1 },
  previewImage: { width: '100%', height: SCREEN_WIDTH, backgroundColor: theme.bgInput },
  previewActions: { flexDirection: 'row', padding: 16, gap: 12 },
  retakeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, backgroundColor: theme.bgInput, gap: 8 },
  retakeBtnText: { fontSize: 15, fontWeight: '600', color: theme.text },
  analyzeBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, backgroundColor: theme.accent, gap: 8 },
  analyzeBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Analyzing
  analyzingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  analyzingIcon: { marginBottom: 24 },
  analyzingTitle: { fontSize: 20, fontWeight: '700', color: theme.text, marginBottom: 8 },
  analyzingSubtitle: { fontSize: 14, color: theme.textMuted, textAlign: 'center' },
  analyzingThumb: { width: 120, height: 120, borderRadius: 16, marginTop: 32, opacity: 0.7 },

  // Results
  resultsScroll: { flex: 1, padding: 16 },
  descCard: { backgroundColor: theme.bgCard, borderRadius: 14, padding: 16, marginBottom: 16 },
  descText: { fontSize: 15, color: theme.text, lineHeight: 22, marginBottom: 12 },
  descMeta: { flexDirection: 'row', gap: 16 },
  descMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  descMetaText: { fontSize: 14, fontWeight: '600', color: theme.text },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.text, marginBottom: 12 },
  foodCard: { backgroundColor: theme.bgCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'transparent' },
  foodCardSelected: { borderColor: theme.accent + '60' },
  foodCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  foodCheckbox: { marginRight: 12 },
  foodInfo: { flex: 1 },
  foodName: { fontSize: 15, fontWeight: '600', color: theme.text },
  foodPortion: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  confidenceText: { fontSize: 12, fontWeight: '700' },
  foodNutrients: { flexDirection: 'row', gap: 8 },
  nutrientPill: { flex: 1, backgroundColor: theme.bgInput, borderRadius: 8, padding: 8, alignItems: 'center' },
  nutrientPillLabel: { fontSize: 10, color: theme.textMuted, marginBottom: 2 },
  nutrientPillValue: { fontSize: 13, fontWeight: '700', color: theme.text },
  suggestCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: `${theme.warning}10`, padding: 14, borderRadius: 12, marginTop: 8, gap: 10 },
  suggestText: { flex: 1, fontSize: 13, color: theme.textSecondary, lineHeight: 18 },

  // Bottom Bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.bgCard, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 14 },
  bottomInfo: { flex: 1 },
  bottomInfoText: { fontSize: 13, color: theme.textMuted },
  logBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 12, gap: 8 },
  logBtnDisabled: { opacity: 0.4 },
  logBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
