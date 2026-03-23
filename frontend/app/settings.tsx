import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from './_layout';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
  { id: 'light', label: 'Light', desc: '1-3 days/week' },
  { id: 'moderate', label: 'Moderate', desc: '3-5 days/week' },
  { id: 'active', label: 'Active', desc: '6-7 days/week' },
  { id: 'very_active', label: 'Very Active', desc: 'Hard exercise daily' },
];

const HEALTH_GOALS = [
  { id: 'muscle_gain', label: 'Muscle Gain', icon: 'barbell' },
  { id: 'weight_loss', label: 'Weight Loss', icon: 'fitness' },
  { id: 'energy', label: 'More Energy', icon: 'flash' },
  { id: 'immune', label: 'Immunity', icon: 'shield-checkmark' },
  { id: 'brain', label: 'Brain Health', icon: 'bulb' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState({ weight_kg: 70, activity_level: 'moderate', health_goals: [] as string[] });
  const [settings, setSettings] = useState({ daily_calorie_goal: 2000, daily_protein_goal: 50, daily_water_goal_ml: 2500, water_reminder_enabled: true, meal_reminder_enabled: true });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const [profileRes, settingsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/user/settings`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile({ weight_kg: data.weight_kg || 70, activity_level: data.activity_level || 'moderate', health_goals: data.health_goals || [] });
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (e) {}
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const saveProfile = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      await fetch(`${BACKEND_URL}/api/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(profile)
      });
      Alert.alert('Saved', 'Profile updated successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      await fetch(`${BACKEND_URL}/api/user/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(settings)
      });
      Alert.alert('Saved', 'Settings updated successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleGoal = (goalId: string) => {
    setProfile(prev => ({
      ...prev,
      health_goals: prev.health_goals.includes(goalId) ? prev.health_goals.filter(g => g !== goalId) : [...prev.health_goals, goalId]
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <Text style={styles.sectionTitle}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Weight (kg)</Text>
            <TextInput style={styles.input} value={String(profile.weight_kg)} onChangeText={(t) => setProfile(prev => ({ ...prev, weight_kg: parseFloat(t) || 0 }))} keyboardType="numeric" placeholderTextColor="#666" />
          </View>

          <Text style={styles.inputLabel}>Activity Level</Text>
          <View style={styles.activityGrid}>
            {ACTIVITY_LEVELS.map((level) => (
              <TouchableOpacity key={level.id} style={[styles.activityOption, profile.activity_level === level.id && styles.activityActive]} onPress={() => setProfile(prev => ({ ...prev, activity_level: level.id }))}>
                <Text style={[styles.activityLabel, profile.activity_level === level.id && styles.activityLabelActive]}>{level.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Health Goals</Text>
          <View style={styles.goalsGrid}>
            {HEALTH_GOALS.map((goal) => (
              <TouchableOpacity key={goal.id} style={[styles.goalOption, profile.health_goals.includes(goal.id) && styles.goalActive]} onPress={() => toggleGoal(goal.id)}>
                <Ionicons name={goal.icon as any} size={18} color={profile.health_goals.includes(goal.id) ? '#00d4ff' : '#666'} />
                <Text style={[styles.goalLabel, profile.health_goals.includes(goal.id) && styles.goalLabelActive]}>{goal.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
          </TouchableOpacity>
        </View>

        {/* Goals Section */}
        <Text style={styles.sectionTitle}>Daily Goals</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Calorie Goal (kcal)</Text>
            <TextInput style={styles.input} value={String(settings.daily_calorie_goal)} onChangeText={(t) => setSettings(prev => ({ ...prev, daily_calorie_goal: parseInt(t) || 0 }))} keyboardType="numeric" placeholderTextColor="#666" />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Protein Goal (g)</Text>
            <TextInput style={styles.input} value={String(settings.daily_protein_goal)} onChangeText={(t) => setSettings(prev => ({ ...prev, daily_protein_goal: parseInt(t) || 0 }))} keyboardType="numeric" placeholderTextColor="#666" />
          </View>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Water Goal (ml)</Text>
            <TextInput style={styles.input} value={String(settings.daily_water_goal_ml)} onChangeText={(t) => setSettings(prev => ({ ...prev, daily_water_goal_ml: parseInt(t) || 0 }))} keyboardType="numeric" placeholderTextColor="#666" />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveSettings} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Goals'}</Text>
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Water Reminders</Text>
              <Text style={styles.switchDesc}>Remind me to stay hydrated</Text>
            </View>
            <Switch value={settings.water_reminder_enabled} onValueChange={(v) => setSettings(prev => ({ ...prev, water_reminder_enabled: v }))} trackColor={{ false: '#2a2a4e', true: '#00d4ff' }} />
          </View>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Meal Reminders</Text>
              <Text style={styles.switchDesc}>Remind me to log meals</Text>
            </View>
            <Switch value={settings.meal_reminder_enabled} onValueChange={(v) => setSettings(prev => ({ ...prev, meal_reminder_enabled: v }))} trackColor={{ false: '#2a2a4e', true: '#00d4ff' }} />
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={signOut}>
          <Ionicons name="log-out" size={20} color="#ff6b6b" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>This app provides nutritional information only. Not medical advice.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#888', marginBottom: 12, marginTop: 8, textTransform: 'uppercase' },
  card: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 20, marginBottom: 16 },
  inputRow: { marginBottom: 16 },
  inputLabel: { color: '#888', fontSize: 13, marginBottom: 8 },
  input: { backgroundColor: '#2a2a4e', borderRadius: 10, padding: 14, color: '#fff', fontSize: 16 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  activityOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2a2a4e', marginRight: 8, marginBottom: 8 },
  activityActive: { backgroundColor: '#00d4ff' },
  activityLabel: { color: '#888', fontSize: 13 },
  activityLabelActive: { color: '#fff' },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  goalOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2a2a4e', marginRight: 8, marginBottom: 8 },
  goalActive: { backgroundColor: 'rgba(0, 212, 255, 0.2)' },
  goalLabel: { color: '#888', fontSize: 12, marginLeft: 6 },
  goalLabelActive: { color: '#00d4ff' },
  saveBtn: { backgroundColor: '#00d4ff', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a4e' },
  switchLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  switchDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 107, 107, 0.1)', padding: 16, borderRadius: 12, marginTop: 8 },
  logoutText: { color: '#ff6b6b', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  disclaimer: { color: '#555', fontSize: 11, textAlign: 'center', marginTop: 20 },
});
