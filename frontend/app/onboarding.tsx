import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Dimensions, Animated, Platform, KeyboardAvoidingView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../src/LanguageContext';
import { hapticLight, hapticSuccess } from '../src/haptics';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

const ACTIVITY_LEVEL_DEFS = [
  { id: 'sedentary', labelKey: 'ob_act_sedentary', descKey: 'ob_act_sedentary_desc', icon: 'bed', emoji: '🛋️' },
  { id: 'light', labelKey: 'ob_act_light', descKey: 'ob_act_light_desc', icon: 'walk', emoji: '🚶' },
  { id: 'moderate', labelKey: 'ob_act_moderate', descKey: 'ob_act_moderate_desc', icon: 'bicycle', emoji: '🚴' },
  { id: 'active', labelKey: 'ob_act_active', descKey: 'ob_act_active_desc', icon: 'fitness', emoji: '🏋️' },
  { id: 'very_active', labelKey: 'ob_act_very_active', descKey: 'ob_act_very_active_desc', icon: 'flame', emoji: '🔥' },
];

const HEALTH_GOAL_DEFS = [
  { id: 'muscle_gain', labelKey: 'ob_goal_muscle', icon: 'barbell', color: '#ff6b6b' },
  { id: 'weight_loss', labelKey: 'ob_goal_weight_loss', icon: 'trending-down', color: '#ffd93d' },
  { id: 'energy', labelKey: 'ob_goal_energy', icon: 'flash', color: '#00d4ff' },
  { id: 'immune', labelKey: 'ob_goal_immune', icon: 'shield-checkmark', color: '#4ecdc4' },
  { id: 'brain', labelKey: 'ob_goal_brain', icon: 'bulb', color: '#a29bfe' },
  { id: 'gut_health', labelKey: 'ob_goal_gut', icon: 'leaf', color: '#00ff88' },
  { id: 'longevity', labelKey: 'ob_goal_longevity', icon: 'heart', color: '#fd79a8' },
];

const DIET_TYPE_DEFS = [
  { id: 'standard', label: 'Standard', icon: 'restaurant', emoji: '🍽️' },
  { id: 'vegetarian', label: 'Vegetarian', icon: 'leaf', emoji: '🥬' },
  { id: 'vegan', label: 'Vegan', icon: 'nutrition', emoji: '🌱' },
  { id: 'keto', label: 'Keto', icon: 'flame', emoji: '🥑' },
  { id: 'paleo', label: 'Paleo', icon: 'fish', emoji: '🥩' },
  { id: 'mediterranean', label: 'Mediterranean', icon: 'globe', emoji: '🫒' },
];

const SEX_DEFS = [
  { id: 'male', label: 'Male', icon: 'male', emoji: '♂️', color: '#00d4ff' },
  { id: 'female', label: 'Female', icon: 'female', emoji: '♀️', color: '#fd79a8' },
];

// Total steps: 0=Jaide Intro, 1=Sex/Age, 2=Height/Weight, 3=Activity, 4=Sleep, 5=Diet, 6=Goals
const TOTAL_STEPS = 7;

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [sex, setSex] = useState('male');
  const [age, setAge] = useState('30');
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('70');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [sleepHours, setSleepHours] = useState('7');
  const [dietType, setDietType] = useState('standard');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (next: number) => {
    hapticLight();
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 150);
  };

  const toggleGoal = (goalId: string) => {
    hapticLight();
    setSelectedGoals(prev =>
      prev.includes(goalId) ? prev.filter(g => g !== goalId) : [...prev, goalId]
    );
  };

  const saveAndFinish = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      await Promise.all([
        fetch(`${BACKEND_URL}/api/user/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            sex,
            age: parseInt(age) || 30,
            height_cm: parseFloat(height) || 170,
            weight_kg: parseFloat(weight) || 70,
            activity_level: activityLevel,
            sleep_hours: parseFloat(sleepHours) || 7,
            diet_type: dietType,
            health_goals: selectedGoals,
          })
        }),
        fetch(`${BACKEND_URL}/api/user/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ onboarding_completed: true })
        })
      ]);

      hapticSuccess();
      await AsyncStorage.setItem('onboarding_completed', 'true');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Onboarding save error:', error);
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      // ── Step 0: Jaide Introduction ──
      case 0:
        return (
          <View style={styles.stepContent}>
            <Image
              source={require('../assets/jaide/jaide-onboarding.png')}
              style={styles.jaideImage}
              resizeMode="contain"
            />
            <View style={styles.jaideSpeechBubble}>
              <Text style={styles.jaideText}>
                {"Welcome, traveler. I am "}
                <Text style={styles.jaideHighlight}>Jaide</Text>
                {"."}
              </Text>
              <Text style={styles.jaideSubText}>
                I see what lies beneath what you eat. Food is not just consumption — it is composition. Energy. Choice.
              </Text>
            </View>
            <Text style={styles.jaideCaption}>
              Let me understand your biological structure.
            </Text>
          </View>
        );

      // ── Step 1: Sex & Age ──
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🧬</Text>
            <Text style={styles.stepTitle}>{t('ob_bio_title') || 'Your Biology'}</Text>
            <Text style={styles.stepSubtitle}>{t('ob_bio_sub') || 'This helps calculate your metabolic rate'}</Text>

            {/* Sex Selection */}
            <Text style={styles.sectionLabel}>{t('ob_sex_label') || 'Biological Sex'}</Text>
            <View style={styles.sexRow}>
              {SEX_DEFS.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.sexCard, sex === s.id && { borderColor: s.color, backgroundColor: s.color + '15' }]}
                  onPress={() => { hapticLight(); setSex(s.id); }}
                >
                  <Text style={styles.sexEmoji}>{s.emoji}</Text>
                  <Text style={[styles.sexLabel, sex === s.id && { color: s.color }]}>{s.label}</Text>
                  {sex === s.id && <Ionicons name="checkmark-circle" size={20} color={s.color} style={styles.sexCheck} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* Age Input */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t('ob_age_label') || 'Age'}</Text>
            <View style={styles.numberInputRow}>
              <TouchableOpacity style={styles.numBtn} onPress={() => { hapticLight(); setAge(String(Math.max(10, (parseInt(age) || 30) - 1))); }}>
                <Ionicons name="remove" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.numDisplay}>
                <TextInput style={styles.numInput} value={age} onChangeText={setAge} keyboardType="numeric" maxLength={3} />
                <Text style={styles.numUnit}>{t('ob_years') || 'years'}</Text>
              </View>
              <TouchableOpacity style={styles.numBtn} onPress={() => { hapticLight(); setAge(String(Math.min(120, (parseInt(age) || 30) + 1))); }}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        );

      // ── Step 2: Height & Weight ──
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>📏</Text>
            <Text style={styles.stepTitle}>{t('ob_body_title') || 'Body Metrics'}</Text>
            <Text style={styles.stepSubtitle}>{t('ob_body_sub') || 'For precise BMR & TDEE calculation'}</Text>

            {/* Height */}
            <Text style={styles.sectionLabel}>{t('ob_height_label') || 'Height'}</Text>
            <View style={styles.numberInputRow}>
              <TouchableOpacity style={styles.numBtn} onPress={() => { hapticLight(); setHeight(String(Math.max(100, (parseFloat(height) || 170) - 1))); }}>
                <Ionicons name="remove" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.numDisplay}>
                <TextInput style={styles.numInput} value={height} onChangeText={setHeight} keyboardType="numeric" maxLength={3} />
                <Text style={styles.numUnit}>cm</Text>
              </View>
              <TouchableOpacity style={styles.numBtn} onPress={() => { hapticLight(); setHeight(String(Math.min(250, (parseFloat(height) || 170) + 1))); }}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Weight */}
            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t('ob_weight_title') || 'Weight'}</Text>
            <View style={styles.numberInputRow}>
              <TouchableOpacity style={styles.numBtn} onPress={() => { hapticLight(); setWeight(String(Math.max(30, (parseFloat(weight) || 70) - 1))); }}>
                <Ionicons name="remove" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.numDisplay}>
                <TextInput style={styles.numInput} value={weight} onChangeText={setWeight} keyboardType="numeric" maxLength={5} />
                <Text style={styles.numUnit}>kg</Text>
              </View>
              <TouchableOpacity style={styles.numBtn} onPress={() => { hapticLight(); setWeight(String(Math.min(300, (parseFloat(weight) || 70) + 1))); }}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* BMR Preview */}
            <View style={styles.previewCard}>
              <Ionicons name="flame" size={20} color="#ff6b6b" />
              <Text style={styles.previewText}>
                {'BMR Estimate: '}
                <Text style={styles.previewValue}>
                  {Math.round(
                    (10 * (parseFloat(weight) || 70)) +
                    (6.25 * (parseFloat(height) || 170)) -
                    (5 * (parseInt(age) || 30)) +
                    (sex === 'female' ? -161 : 5)
                  )} kcal/day
                </Text>
              </Text>
            </View>
          </View>
        );

      // ── Step 3: Activity Level ──
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🏃</Text>
            <Text style={styles.stepTitle}>{t('ob_activity_title')}</Text>
            <Text style={styles.stepSubtitle}>{t('ob_activity_sub')}</Text>
            <View style={styles.activityList}>
              {ACTIVITY_LEVEL_DEFS.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  style={[styles.activityCard, activityLevel === level.id && styles.activityCardActive]}
                  onPress={() => { hapticLight(); setActivityLevel(level.id); }}
                >
                  <Text style={styles.activityEmoji}>{level.emoji}</Text>
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityLabel, activityLevel === level.id && styles.activityLabelActive]}>
                      {t(level.labelKey)}
                    </Text>
                    <Text style={styles.activityDesc}>{t(level.descKey)}</Text>
                  </View>
                  {activityLevel === level.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#00d4ff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // ── Step 4: Sleep Hours ──
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>😴</Text>
            <Text style={styles.stepTitle}>{t('ob_sleep_title') || 'Sleep Pattern'}</Text>
            <Text style={styles.stepSubtitle}>{t('ob_sleep_sub') || 'Sleep affects recovery, hydration needs, and metabolism'}</Text>

            <View style={styles.numberInputRow}>
              <TouchableOpacity style={styles.numBtn} onPress={() => { hapticLight(); setSleepHours(String(Math.max(3, (parseFloat(sleepHours) || 7) - 0.5))); }}>
                <Ionicons name="remove" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.numDisplay}>
                <TextInput style={styles.numInputLarge} value={sleepHours} onChangeText={setSleepHours} keyboardType="numeric" maxLength={4} />
                <Text style={styles.numUnit}>{t('ob_hours') || 'hours/night'}</Text>
              </View>
              <TouchableOpacity style={styles.numBtn} onPress={() => { hapticLight(); setSleepHours(String(Math.min(12, (parseFloat(sleepHours) || 7) + 0.5))); }}>
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.sleepHint}>
              <Ionicons name="information-circle" size={18} color="#a29bfe" />
              <Text style={styles.sleepHintText}>
                {parseFloat(sleepHours) < 6
                  ? 'Low sleep increases cortisol and water needs'
                  : parseFloat(sleepHours) >= 8
                  ? 'Optimal sleep for recovery and metabolism'
                  : 'Adequate sleep — consider aiming for 7-9 hours'}
              </Text>
            </View>
          </View>
        );

      // ── Step 5: Diet Type ──
      case 5:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🥗</Text>
            <Text style={styles.stepTitle}>{t('ob_diet_title') || 'Diet Preference'}</Text>
            <Text style={styles.stepSubtitle}>{t('ob_diet_sub') || 'Helps personalize nutrient priorities'}</Text>
            <View style={styles.dietGrid}>
              {DIET_TYPE_DEFS.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.dietCard, dietType === d.id && styles.dietCardActive]}
                  onPress={() => { hapticLight(); setDietType(d.id); }}
                >
                  <Text style={styles.dietEmoji}>{d.emoji}</Text>
                  <Text style={[styles.dietLabel, dietType === d.id && styles.dietLabelActive]}>{d.label}</Text>
                  {dietType === d.id && <Ionicons name="checkmark-circle" size={18} color="#00d4ff" style={styles.dietCheck} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      // ── Step 6: Health Goals ──
      case 6:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🎯</Text>
            <Text style={styles.stepTitle}>{t('ob_goals_title')}</Text>
            <Text style={styles.stepSubtitle}>{t('ob_goals_sub')}</Text>
            <View style={styles.goalsGrid}>
              {HEALTH_GOAL_DEFS.map((goal) => (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.goalCard, selectedGoals.includes(goal.id) && { borderColor: goal.color, backgroundColor: goal.color + '15' }]}
                  onPress={() => toggleGoal(goal.id)}
                >
                  <View style={[styles.goalIconCircle, { backgroundColor: goal.color + '20' }]}>
                    <Ionicons name={goal.icon as any} size={28} color={goal.color} />
                  </View>
                  <Text style={[styles.goalLabel, selectedGoals.includes(goal.id) && { color: goal.color }]}>
                    {t(goal.labelKey) || goal.id.replace(/_/g, ' ')}
                  </Text>
                  {selectedGoals.includes(goal.id) && (
                    <Ionicons name="checkmark-circle" size={20} color={goal.color} style={styles.goalCheck} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Jaide closing message */}
            <View style={[styles.jaideMiniSpeech, { marginTop: 16 }]}>
              <Image source={require('../assets/jaide/jaide-cartoon.png')} style={styles.jaideAvatar} />
              <View style={styles.jaideMiniTextWrap}>
                <Text style={styles.jaideMiniText}>
                  "You are now visible. Let us refine your balance."
                </Text>
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive, i < step && styles.progressDotDone]} />
        ))}
      </View>

      {/* Skip button */}
      {step > 0 && (
        <TouchableOpacity style={styles.skipBtn} onPress={() => { AsyncStorage.setItem('onboarding_completed', 'true'); router.replace('/(tabs)'); }}>
          <Text style={styles.skipText}>{t('ob_skip')}</Text>
        </TouchableOpacity>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim }}>
            {renderStep()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Buttons */}
      <View style={styles.bottomBar}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => animateTransition(step - 1)}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, step === 0 && { flex: 1 }]}
          onPress={() => {
            if (step < TOTAL_STEPS - 1) {
              animateTransition(step + 1);
            } else {
              saveAndFinish();
            }
          }}
          disabled={saving}
        >
          <Text style={styles.nextBtnText}>
            {step === 0 ? (t('ob_begin_journey') || 'Begin Journey') : step === TOTAL_STEPS - 1 ? (saving ? t('ob_saving') : (t('ob_finish') || 'Complete Setup')) : (t('ob_continue') || 'Continue')}
          </Text>
          {step < TOTAL_STEPS - 1 && step > 0 && <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  progressBar: { flexDirection: 'row', justifyContent: 'center', paddingTop: 16, paddingBottom: 8 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2a2a4e', marginHorizontal: 3 },
  progressDotActive: { width: 20, backgroundColor: '#00d4ff' },
  progressDotDone: { width: 8, backgroundColor: '#00d4ff' },
  skipBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 16, right: 20, zIndex: 10 },
  skipText: { color: '#666', fontSize: 15 },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 120 },
  stepContent: { flex: 1, alignItems: 'center' },

  // Jaide Intro
  jaideImage: { width: width * 0.7, height: width * 0.7, marginBottom: 16 },
  jaideSpeechBubble: { backgroundColor: 'rgba(0, 212, 255, 0.08)', borderRadius: 20, padding: 20, marginHorizontal: 8, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.2)' },
  jaideText: { fontSize: 18, color: '#e0e0ff', textAlign: 'center', lineHeight: 26 },
  jaideHighlight: { color: '#00d4ff', fontWeight: 'bold', fontSize: 20 },
  jaideSubText: { fontSize: 14, color: '#8888aa', textAlign: 'center', marginTop: 12, lineHeight: 22, fontStyle: 'italic' },
  jaideCaption: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 20 },

  // Jaide mini
  jaideMiniSpeech: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 212, 255, 0.06)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.15)' },
  jaideAvatar: { width: 44, height: 44, borderRadius: 22 },
  jaideMiniTextWrap: { flex: 1, marginLeft: 12 },
  jaideMiniText: { fontSize: 13, color: '#a0a0cc', fontStyle: 'italic', lineHeight: 18 },

  // Common step
  stepEmoji: { fontSize: 48, marginBottom: 12 },
  stepTitle: { fontSize: 26, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: '#888', textAlign: 'center', marginBottom: 20, paddingHorizontal: 16 },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'flex-start', marginBottom: 12, marginLeft: 4 },

  // Sex selection
  sexRow: { flexDirection: 'row', width: '100%', gap: 12 },
  sexCard: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  sexEmoji: { fontSize: 36, marginBottom: 8 },
  sexLabel: { fontSize: 16, fontWeight: '600', color: '#ccc' },
  sexCheck: { position: 'absolute', top: 8, right: 8 },

  // Number input
  numberInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  numBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#2a2a4e', justifyContent: 'center', alignItems: 'center' },
  numDisplay: { alignItems: 'center', marginHorizontal: 20 },
  numInput: { fontSize: 44, fontWeight: 'bold', color: '#fff', textAlign: 'center', minWidth: 100 },
  numInputLarge: { fontSize: 52, fontWeight: 'bold', color: '#fff', textAlign: 'center', minWidth: 100 },
  numUnit: { fontSize: 14, color: '#888', marginTop: 2 },

  // BMR Preview
  previewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 107, 107, 0.1)', borderRadius: 12, padding: 14, marginTop: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.2)' },
  previewText: { fontSize: 14, color: '#ccc', marginLeft: 10 },
  previewValue: { color: '#ff6b6b', fontWeight: 'bold' },

  // Activity
  activityList: { width: '100%', marginTop: 4 },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  activityCardActive: { borderColor: '#00d4ff', backgroundColor: 'rgba(0, 212, 255, 0.08)' },
  activityEmoji: { fontSize: 24, marginRight: 12 },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 15, fontWeight: '600', color: '#fff' },
  activityLabelActive: { color: '#00d4ff' },
  activityDesc: { fontSize: 11, color: '#888', marginTop: 2 },

  // Sleep hint
  sleepHint: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(162, 155, 254, 0.1)', borderRadius: 12, padding: 14, marginTop: 24, width: '100%', borderWidth: 1, borderColor: 'rgba(162, 155, 254, 0.2)' },
  sleepHintText: { fontSize: 13, color: '#a29bfe', marginLeft: 10, flex: 1, lineHeight: 18 },

  // Diet
  dietGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%' },
  dietCard: { width: '48%', backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, marginBottom: 10, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  dietCardActive: { borderColor: '#00d4ff', backgroundColor: 'rgba(0, 212, 255, 0.08)' },
  dietEmoji: { fontSize: 32, marginBottom: 8 },
  dietLabel: { fontSize: 14, fontWeight: '600', color: '#ccc' },
  dietLabelActive: { color: '#00d4ff' },
  dietCheck: { position: 'absolute', top: 8, right: 8 },

  // Goals
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', marginTop: 4 },
  goalCard: { width: '48%', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 18, marginBottom: 10, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  goalIconCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  goalLabel: { fontSize: 13, fontWeight: '600', color: '#ccc', textAlign: 'center' },
  goalCheck: { position: 'absolute', top: 8, right: 8 },

  // Bottom bar
  bottomBar: { flexDirection: 'row', padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, backgroundColor: '#0a0a1a', borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  backBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2a2a4e', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  nextBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#00d4ff', borderRadius: 16, height: 56 },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
