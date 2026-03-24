import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, Switch, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from './_layout';
import { useTheme } from '../src/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const ACTIVITY_LEVELS = [
  { id: 'sedentary', label: 'Sedentary' },
  { id: 'light', label: 'Light' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'active', label: 'Active' },
  { id: 'very_active', label: 'Very Active' },
];

const HEALTH_GOALS = [
  { id: 'muscle_gain', label: 'Muscle Gain', icon: 'barbell' },
  { id: 'weight_loss', label: 'Weight Loss', icon: 'fitness' },
  { id: 'energy', label: 'More Energy', icon: 'flash' },
  { id: 'immune', label: 'Immunity', icon: 'shield-checkmark' },
  { id: 'brain', label: 'Brain Health', icon: 'bulb' },
  { id: 'gut_health', label: 'Gut Health', icon: 'leaf' },
];

// Schedule local notifications
async function scheduleWaterReminders(enabled: boolean) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;

  if (Platform.OS === 'web') return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission Required', 'Please enable notifications in your device settings');
    return;
  }

  // Water reminders every 2 hours from 8am to 8pm
  for (let hour = 8; hour <= 20; hour += 2) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💧 Stay Hydrated!',
        body: "Time to drink water. Your body needs it for optimal nutrient absorption!",
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0 },
    });
  }
}

async function scheduleMealReminders(enabled: boolean) {
  if (!enabled || Platform.OS === 'web') return;

  const meals = [
    { hour: 8, title: '🍳 Breakfast Time', body: 'Start your day with a nutrient-rich breakfast!' },
    { hour: 12, title: '🥗 Lunch Time', body: "Don't forget to log your lunch for accurate tracking!" },
    { hour: 19, title: '🍽️ Dinner Time', body: 'Plan a balanced dinner to hit your daily goals!' },
  ];

  for (const meal of meals) {
    await Notifications.scheduleNotificationAsync({
      content: { title: meal.title, body: meal.body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: meal.hour, minute: 0 },
    });
  }
}

async function scheduleRoutineReminders(enabled: boolean) {
  if (!enabled || Platform.OS === 'web') return;

  const routines = [
    { hour: 7, title: '🌅 Morning Routine', body: 'Time to start your morning routine!' },
    { hour: 22, title: '🌙 Evening Routine', body: 'Wind down with your evening routine.' },
  ];

  for (const r of routines) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: 0 },
    });
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const [profile, setProfile] = useState({ weight_kg: 70, activity_level: 'moderate', health_goals: [] as string[] });
  const [settings, setSettings] = useState({
    daily_calorie_goal: 2000, daily_protein_goal: 50, daily_water_goal_ml: 2500,
    notifications_enabled: true, water_reminder_enabled: true, meal_reminder_enabled: true, routine_reminder_enabled: true
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    } catch (e) { }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const saveAll = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      await Promise.all([
        fetch(`${BACKEND_URL}/api/user/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(profile)
        }),
        fetch(`${BACKEND_URL}/api/user/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(settings)
        })
      ]);
      // Schedule notifications based on settings
      if (settings.notifications_enabled) {
        await scheduleWaterReminders(settings.water_reminder_enabled);
        await scheduleMealReminders(settings.meal_reminder_enabled);
        await scheduleRoutineReminders(settings.routine_reminder_enabled);
      } else {
        // Master toggle off - cancel all
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
      Alert.alert('Saved!', 'Your settings have been updated');
    } catch (e) { Alert.alert('Error', 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account and all your data? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Second confirmation
            Alert.alert(
              'Final Confirmation',
              'This will permanently delete ALL your data including meals, water logs, routines, recipes, and badges. Type is irreversible.',
              [
                { text: 'Keep Account', style: 'cancel' },
                {
                  text: 'Permanently Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      const token = await AsyncStorage.getItem('session_token');
                      if (!token) return;
                      const res = await fetch(`${BACKEND_URL}/api/user/account`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      if (res.ok) {
                        await AsyncStorage.clear();
                        await Notifications.cancelAllScheduledNotificationsAsync();
                        signOut();
                      } else {
                        Alert.alert('Error', 'Failed to delete account. Please try again.');
                      }
                    } catch (e) {
                      Alert.alert('Error', 'Failed to delete account. Please try again.');
                    } finally {
                      setDeleting(false);
                    }
                  }
                }
              ]
            );
          }
        }
      ]
    );
  };

  const toggleGoal = (goalId: string) => {
    setProfile(prev => ({
      ...prev,
      health_goals: prev.health_goals.includes(goalId) ? prev.health_goals.filter(g => g !== goalId) : [...prev.health_goals, goalId]
    }));
  };

  const s = makeStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.bgCard }]}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <TouchableOpacity onPress={saveAll} disabled={saving} style={[styles.saveHeaderBtn, { backgroundColor: theme.accent }]}>
          <Text style={styles.saveHeaderText}>{saving ? '...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Appearance</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <View style={[styles.settingIcon, { backgroundColor: isDark ? 'rgba(162, 155, 254, 0.15)' : 'rgba(255, 217, 61, 0.15)' }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={isDark ? '#a29bfe' : '#ffd93d'} />
              </View>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>Dark Mode</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>{isDark ? 'Futuristic dark theme' : 'Clean light theme'}</Text>
              </View>
            </View>
            <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#ddd', true: theme.accent }} thumbColor="#fff" />
          </View>
        </View>

        {/* Profile Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Profile</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Weight (kg)</Text>
          <TextInput style={[styles.input, { backgroundColor: theme.bgInput, color: theme.text }]}
            value={String(profile.weight_kg)}
            onChangeText={(t) => setProfile(prev => ({ ...prev, weight_kg: parseFloat(t) || 0 }))}
            keyboardType="numeric" placeholderTextColor={theme.textDim} />

          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Activity Level</Text>
          <View style={styles.activityGrid}>
            {ACTIVITY_LEVELS.map((level) => (
              <TouchableOpacity key={level.id}
                style={[styles.activityOption, { backgroundColor: theme.bgInput }, profile.activity_level === level.id && { backgroundColor: theme.accent }]}
                onPress={() => setProfile(prev => ({ ...prev, activity_level: level.id }))}>
                <Text style={[styles.activityLabel, { color: theme.textMuted }, profile.activity_level === level.id && { color: '#fff' }]}>
                  {level.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Health Goals</Text>
          <View style={styles.goalsGrid}>
            {HEALTH_GOALS.map((goal) => (
              <TouchableOpacity key={goal.id}
                style={[styles.goalOption, { backgroundColor: theme.bgInput }, profile.health_goals.includes(goal.id) && { backgroundColor: theme.accentGlow, borderColor: theme.accent, borderWidth: 1 }]}
                onPress={() => toggleGoal(goal.id)}>
                <Ionicons name={goal.icon as any} size={16} color={profile.health_goals.includes(goal.id) ? theme.accent : theme.textMuted} />
                <Text style={[styles.goalLabel, { color: theme.textMuted }, profile.health_goals.includes(goal.id) && { color: theme.accent }]}>
                  {goal.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Daily Goals Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Daily Goals</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {[
            { key: 'daily_calorie_goal', label: 'Calorie Goal', unit: 'kcal', icon: 'flame', color: '#ff6b6b' },
            { key: 'daily_protein_goal', label: 'Protein Goal', unit: 'g', icon: 'barbell', color: '#00d4ff' },
            { key: 'daily_water_goal_ml', label: 'Water Goal', unit: 'ml', icon: 'water', color: '#4ecdc4' },
          ].map((goal) => (
            <View key={goal.key} style={styles.goalInputRow}>
              <View style={[styles.settingIcon, { backgroundColor: goal.color + '15' }]}>
                <Ionicons name={goal.icon as any} size={18} color={goal.color} />
              </View>
              <View style={styles.goalInputInfo}>
                <Text style={[styles.goalInputLabel, { color: theme.text }]}>{goal.label}</Text>
              </View>
              <View style={styles.goalInputGroup}>
                <TextInput style={[styles.goalInput, { backgroundColor: theme.bgInput, color: theme.text }]}
                  value={String((settings as any)[goal.key])}
                  onChangeText={(t) => setSettings(prev => ({ ...prev, [goal.key]: parseInt(t) || 0 }))}
                  keyboardType="numeric" />
                <Text style={[styles.goalUnit, { color: theme.textDim }]}>{goal.unit}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Notifications Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Notifications</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {/* Master Toggle */}
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 255, 136, 0.15)' }]}>
                <Ionicons name="notifications" size={18} color="#00ff88" />
              </View>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>All Notifications</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>Master toggle for all alerts</Text>
              </View>
            </View>
            <Switch value={settings.notifications_enabled}
              onValueChange={(v) => setSettings(prev => ({ ...prev, notifications_enabled: v }))}
              trackColor={{ false: theme.bgInput, true: '#00ff88' }} thumbColor="#fff" />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          {/* Water Reminders */}
          <View style={[styles.switchRow, !settings.notifications_enabled && { opacity: 0.4 }]}>
            <View style={styles.switchLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 212, 255, 0.15)' }]}>
                <Ionicons name="water" size={18} color="#00d4ff" />
              </View>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>Water Reminders</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>Every 2 hours, 8am–8pm</Text>
              </View>
            </View>
            <Switch value={settings.water_reminder_enabled && settings.notifications_enabled}
              onValueChange={(v) => setSettings(prev => ({ ...prev, water_reminder_enabled: v }))}
              disabled={!settings.notifications_enabled}
              trackColor={{ false: theme.bgInput, true: theme.accent }} thumbColor="#fff" />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          {/* Meal Reminders */}
          <View style={[styles.switchRow, !settings.notifications_enabled && { opacity: 0.4 }]}>
            <View style={styles.switchLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(255, 107, 107, 0.15)' }]}>
                <Ionicons name="restaurant" size={18} color="#ff6b6b" />
              </View>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>Meal Reminders</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>Breakfast, Lunch, Dinner</Text>
              </View>
            </View>
            <Switch value={settings.meal_reminder_enabled && settings.notifications_enabled}
              onValueChange={(v) => setSettings(prev => ({ ...prev, meal_reminder_enabled: v }))}
              disabled={!settings.notifications_enabled}
              trackColor={{ false: theme.bgInput, true: theme.accent }} thumbColor="#fff" />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          {/* Routine Reminders */}
          <View style={[styles.switchRow, !settings.notifications_enabled && { opacity: 0.4 }]}>
            <View style={styles.switchLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(162, 155, 254, 0.15)' }]}>
                <Ionicons name="time" size={18} color="#a29bfe" />
              </View>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>Routine Reminders</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>Morning & evening routines</Text>
              </View>
            </View>
            <Switch value={settings.routine_reminder_enabled && settings.notifications_enabled}
              onValueChange={(v) => setSettings(prev => ({ ...prev, routine_reminder_enabled: v }))}
              disabled={!settings.notifications_enabled}
              trackColor={{ false: theme.bgInput, true: theme.accent }} thumbColor="#fff" />
          </View>
        </View>

        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Account</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.accountInfo}>
            <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
            </View>
            <View style={styles.accountDetails}>
              <Text style={[styles.accountName, { color: theme.text }]}>{user?.name || 'User'}</Text>
              <Text style={[styles.accountEmail, { color: theme.textMuted }]}>{user?.email || ''}</Text>
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: 'rgba(255, 107, 107, 0.1)' }]} onPress={() => {
          Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut }
          ]);
        }}>
          <Ionicons name="log-out" size={20} color={theme.danger} />
          <Text style={[styles.logoutText, { color: theme.danger }]}>Sign Out</Text>
        </TouchableOpacity>

        {/* Danger Zone */}
        <Text style={[styles.sectionTitle, { color: '#ff6b6b', marginTop: 24 }]}>Danger Zone</Text>
        <View style={[styles.card, { backgroundColor: 'rgba(255, 59, 48, 0.06)', borderColor: 'rgba(255, 59, 48, 0.2)' }]}>
          <View style={styles.dangerInfo}>
            <Ionicons name="warning" size={20} color="#ff3b30" />
            <Text style={[styles.dangerInfoText, { color: theme.textMuted }]}>
              Permanently delete your account and all associated data. This cannot be undone.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={styles.deleteAccountText}>
              {deleting ? 'Deleting...' : 'Delete Account'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.disclaimer, { color: theme.textDim }]}>
          NutriOS v3.0 • Nutritional information only. Not medical advice.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: any) { return theme; }

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  saveHeaderBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  saveHeaderText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 60 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8, marginLeft: 4 },
  card: { borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1 },
  inputLabel: { fontSize: 13, marginBottom: 8, marginTop: 12, fontWeight: '500' },
  input: { borderRadius: 12, padding: 14, fontSize: 16 },
  activityGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  activityOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginRight: 8, marginBottom: 8 },
  activityLabel: { fontSize: 13, fontWeight: '500' },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  goalOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  goalLabel: { fontSize: 12, marginLeft: 6, fontWeight: '500' },
  goalInputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 0 },
  settingIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  goalInputInfo: { flex: 1 },
  goalInputLabel: { fontSize: 15, fontWeight: '500' },
  goalInputGroup: { flexDirection: 'row', alignItems: 'center' },
  goalInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 16, width: 80, textAlign: 'center', fontWeight: '600' },
  goalUnit: { fontSize: 13, marginLeft: 6 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  switchLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  switchLabel: { fontSize: 15, fontWeight: '500' },
  switchDesc: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginVertical: 8 },
  accountInfo: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  accountDetails: { marginLeft: 14 },
  accountName: { fontSize: 16, fontWeight: '600' },
  accountEmail: { fontSize: 13, marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, marginTop: 12 },
  logoutText: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  dangerInfo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  dangerInfoText: { fontSize: 13, lineHeight: 19, marginLeft: 10, flex: 1 },
  deleteAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ff3b30', paddingVertical: 14, borderRadius: 12 },
  deleteAccountText: { color: '#fff', fontSize: 15, fontWeight: '700', marginLeft: 8 },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 },
});
