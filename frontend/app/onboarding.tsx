import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Dimensions, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../src/LanguageContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width } = Dimensions.get('window');

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise', icon: 'bed', emoji: '🛋️' },
  { id: 'light', label: 'Light', desc: 'Exercise 1-3 days/week', icon: 'walk', emoji: '🚶' },
  { id: 'moderate', label: 'Moderate', desc: 'Exercise 3-5 days/week', icon: 'bicycle', emoji: '🚴' },
  { id: 'active', label: 'Active', desc: 'Exercise 6-7 days/week', icon: 'fitness', emoji: '🏋️' },
  { id: 'very_active', label: 'Very Active', desc: 'Hard exercise daily', icon: 'flame', emoji: '🔥' },
];

const HEALTH_GOALS = [
  { id: 'muscle_gain', label: 'Build Muscle', icon: 'barbell', color: '#ff6b6b' },
  { id: 'weight_loss', label: 'Lose Weight', icon: 'trending-down', color: '#ffd93d' },
  { id: 'energy', label: 'More Energy', icon: 'flash', color: '#00d4ff' },
  { id: 'immune', label: 'Boost Immunity', icon: 'shield-checkmark', color: '#4ecdc4' },
  { id: 'brain', label: 'Brain Health', icon: 'bulb', color: '#a29bfe' },
  { id: 'gut_health', label: 'Gut Health', icon: 'leaf', color: '#00ff88' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState('70');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setStep(next), 150);
  };

  const toggleGoal = (goalId: string) => {
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
          body: JSON.stringify({ weight_kg: parseFloat(weight) || 70, activity_level: activityLevel, health_goals: selectedGoals })
        }),
        fetch(`${BACKEND_URL}/api/user/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ onboarding_completed: true })
        })
      ]);

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
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.welcomeIcon}>
              <Ionicons name="flask" size={64} color="#00d4ff" />
            </View>
            <Text style={styles.stepTitle}>Welcome to NutriOS</Text>
            <Text style={styles.stepSubtitle}>Your Personal Nutrition Operating System</Text>
            <Text style={styles.stepDesc}>
              We'll map your food to its exact atomic composition, flag allergens, and use AI to optimize your nutrition.
            </Text>
            <View style={styles.featureList}>
              {[
                { icon: 'analytics', text: 'Track C, H, O, N elemental intake', color: '#00d4ff' },
                { icon: 'warning', text: 'Auto-detect allergens', color: '#ff6b6b' },
                { icon: 'bulb', text: 'AI-powered food synergies', color: '#ffd93d' },
                { icon: 'flame', text: 'Cooking method optimization', color: '#4ecdc4' },
              ].map((f, i) => (
                <View key={i} style={styles.featureItem}>
                  <View style={[styles.featureIconCircle, { backgroundColor: f.color + '20' }]}>
                    <Ionicons name={f.icon as any} size={20} color={f.color} />
                  </View>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>⚖️</Text>
            <Text style={styles.stepTitle}>What's your weight?</Text>
            <Text style={styles.stepSubtitle}>This helps us calculate your optimal nutrition targets</Text>
            <View style={styles.weightInputContainer}>
              <TouchableOpacity style={styles.weightBtn} onPress={() => setWeight(String(Math.max(30, (parseFloat(weight) || 70) - 1)))}>
                <Ionicons name="remove" size={28} color="#fff" />
              </TouchableOpacity>
              <View style={styles.weightDisplay}>
                <TextInput
                  style={styles.weightInput}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  maxLength={5}
                />
                <Text style={styles.weightUnit}>kg</Text>
              </View>
              <TouchableOpacity style={styles.weightBtn} onPress={() => setWeight(String(Math.min(300, (parseFloat(weight) || 70) + 1)))}>
                <Ionicons name="add" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>This is used to personalize water goals and nutrient targets</Text>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🏃</Text>
            <Text style={styles.stepTitle}>Activity Level</Text>
            <Text style={styles.stepSubtitle}>How active are you on a typical week?</Text>
            <View style={styles.activityList}>
              {ACTIVITY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level.id}
                  style={[styles.activityCard, activityLevel === level.id && styles.activityCardActive]}
                  onPress={() => setActivityLevel(level.id)}
                >
                  <Text style={styles.activityEmoji}>{level.emoji}</Text>
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityLabel, activityLevel === level.id && styles.activityLabelActive]}>
                      {level.label}
                    </Text>
                    <Text style={styles.activityDesc}>{level.desc}</Text>
                  </View>
                  {activityLevel === level.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#00d4ff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepEmoji}>🎯</Text>
            <Text style={styles.stepTitle}>Health Goals</Text>
            <Text style={styles.stepSubtitle}>Select what matters most to you (pick any)</Text>
            <View style={styles.goalsGrid}>
              {HEALTH_GOALS.map((goal) => (
                <TouchableOpacity
                  key={goal.id}
                  style={[styles.goalCard, selectedGoals.includes(goal.id) && { borderColor: goal.color, backgroundColor: goal.color + '15' }]}
                  onPress={() => toggleGoal(goal.id)}
                >
                  <View style={[styles.goalIconCircle, { backgroundColor: goal.color + '20' }]}>
                    <Ionicons name={goal.icon as any} size={28} color={goal.color} />
                  </View>
                  <Text style={[styles.goalLabel, selectedGoals.includes(goal.id) && { color: goal.color }]}>
                    {goal.label}
                  </Text>
                  {selectedGoals.includes(goal.id) && (
                    <Ionicons name="checkmark-circle" size={20} color={goal.color} style={styles.goalCheck} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Dots */}
      <View style={styles.progressBar}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.progressDot, i <= step && styles.progressDotActive, i < step && styles.progressDotDone]} />
        ))}
      </View>

      {/* Skip button */}
      {step > 0 && (
        <TouchableOpacity style={styles.skipBtn} onPress={() => { AsyncStorage.setItem('onboarding_completed', 'true'); router.replace('/(tabs)'); }}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {renderStep()}
        </Animated.View>
      </ScrollView>

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
            if (step < 3) {
              animateTransition(step + 1);
            } else {
              saveAndFinish();
            }
          }}
          disabled={saving}
        >
          <Text style={styles.nextBtnText}>
            {step === 0 ? "Let's Go!" : step === 3 ? (saving ? 'Saving...' : 'Finish Setup') : 'Continue'}
          </Text>
          {step < 3 && <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  progressBar: { flexDirection: 'row', justifyContent: 'center', paddingTop: 16, paddingBottom: 8 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2a2a4e', marginHorizontal: 4 },
  progressDotActive: { width: 24, backgroundColor: '#00d4ff' },
  progressDotDone: { width: 8, backgroundColor: '#00d4ff' },
  skipBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 16, right: 20, zIndex: 10 },
  skipText: { color: '#666', fontSize: 15 },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 120 },
  stepContent: { flex: 1, alignItems: 'center' },
  welcomeIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(0, 212, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.3)' },
  stepEmoji: { fontSize: 56, marginBottom: 16 },
  stepTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', textAlign: 'center', marginBottom: 8 },
  stepSubtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 24, paddingHorizontal: 20 },
  stepDesc: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, paddingHorizontal: 10, marginBottom: 24 },
  featureList: { width: '100%', marginTop: 8 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureIconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  featureText: { color: '#ccc', fontSize: 15, marginLeft: 14, flex: 1 },
  weightInputContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 24 },
  weightBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2a2a4e', justifyContent: 'center', alignItems: 'center' },
  weightDisplay: { alignItems: 'center', marginHorizontal: 24 },
  weightInput: { fontSize: 56, fontWeight: 'bold', color: '#fff', textAlign: 'center', minWidth: 120 },
  weightUnit: { fontSize: 18, color: '#888', marginTop: 4 },
  hint: { color: '#555', fontSize: 13, marginTop: 24, textAlign: 'center' },
  activityList: { width: '100%', marginTop: 8 },
  activityCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 2, borderColor: 'transparent' },
  activityCardActive: { borderColor: '#00d4ff', backgroundColor: 'rgba(0, 212, 255, 0.08)' },
  activityEmoji: { fontSize: 28, marginRight: 14 },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  activityLabelActive: { color: '#00d4ff' },
  activityDesc: { fontSize: 12, color: '#888', marginTop: 2 },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', marginTop: 8 },
  goalCard: { width: '48%', backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  goalIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  goalLabel: { fontSize: 14, fontWeight: '600', color: '#ccc', textAlign: 'center' },
  goalCheck: { position: 'absolute', top: 8, right: 8 },
  bottomBar: { flexDirection: 'row', padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, backgroundColor: '#0f0f23', borderTopWidth: 1, borderTopColor: '#1a1a2e' },
  backBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2a2a4e', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  nextBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#00d4ff', borderRadius: 16, height: 56 },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
