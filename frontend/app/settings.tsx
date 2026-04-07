import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, TextInput, Switch, Alert, Platform, Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from './_layout';
import { useTheme } from '../src/ThemeContext';
import { useLanguage } from '../src/LanguageContext';
import { SUPPORTED_LOCALES, Locale } from '../src/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const ACTIVITY_LEVEL_IDS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
const HEALTH_GOAL_DEFS = [
  { id: 'muscle_gain', key: 'set_muscle_gain', icon: 'barbell' },
  { id: 'weight_loss', key: 'set_weight_loss', icon: 'fitness' },
  { id: 'energy', key: 'set_energy', icon: 'flash' },
  { id: 'immune', key: 'set_immunity', icon: 'shield-checkmark' },
  { id: 'brain', key: 'set_brain', icon: 'bulb' },
  { id: 'gut_health', key: 'set_gut', icon: 'leaf' },
] as const;

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
  const { locale, setLocale, t } = useLanguage();
  const [showLangModal, setShowLangModal] = useState(false);
  const [profile, setProfile] = useState({
    weight_kg: 70, height_cm: 170, age: 30, sex: 'male',
    activity_level: 'moderate', weight_goal: 'maintain', health_goals: [] as string[]
  });
  const [settings, setSettings] = useState({
    daily_calorie_goal: 2000, daily_protein_goal: 50, daily_water_goal_ml: 2500,
    notifications_enabled: true, water_reminder_enabled: true, meal_reminder_enabled: true, routine_reminder_enabled: true
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<any>(null);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const [profileRes, settingsRes, payRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/user/settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/payments/status`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile({
          weight_kg: data.weight_kg || 70, height_cm: data.height_cm || 170,
          age: data.age || 30, sex: data.sex || 'male',
          activity_level: data.activity_level || 'moderate',
          weight_goal: data.weight_goal || 'maintain',
          health_goals: data.health_goals || []
        });
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
      if (payRes.ok) {
        const data = await payRes.json();
        setPaymentStatus(data);
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
      Alert.alert(t('set_saved'), t('set_saved_desc'));
    } catch (e) { Alert.alert('Error', 'Failed to save settings'); }
    finally { setSaving(false); }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);

  const handleDeleteAccount = () => {
    // Block if active subscription not cancelled
    if (paymentStatus?.is_premium && !paymentStatus?.cancel_at_period_end) {
      Alert.alert(
        'Cancel Subscription First',
        'Please cancel your subscription before deleting your account. Go to Settings → Subscription → Cancel Subscription.',
        [{ text: 'OK' }]
      );
      return;
    }
    setDeleteStep(1);
    setShowDeleteModal(true);
  };

  const executeDeleteAccount = async () => {
    setDeleting(true);
    setShowDeleteModal(false);
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/user/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await AsyncStorage.clear();
        try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch (e) {}
        signOut();
      } else {
        const err = await res.json().catch(() => ({}));
        Alert.alert('Error', err.detail || 'Failed to delete account.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('set_title')}</Text>
        <TouchableOpacity onPress={saveAll} disabled={saving} style={[styles.saveHeaderBtn, { backgroundColor: theme.accent }]}>
          <Text style={styles.saveHeaderText}>{saving ? '...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('set_appearance')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <View style={[styles.settingIcon, { backgroundColor: isDark ? 'rgba(162, 155, 254, 0.15)' : 'rgba(255, 217, 61, 0.15)' }]}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={isDark ? '#a29bfe' : '#ffd93d'} />
              </View>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>Dark Mode</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>{isDark ? t('set_dark_desc') : t('set_light_desc')}</Text>
              </View>
            </View>
            <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: '#ddd', true: theme.accent }} thumbColor="#fff" />
          </View>
        </View>

        {/* Language Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('set_language')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.switchRow} onPress={() => setShowLangModal(true)}>
            <View style={styles.switchLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(0,212,255,0.15)' }]}>
                <Ionicons name="language" size={20} color="#00d4ff" />
              </View>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>{t('set_language')}</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>
                  {SUPPORTED_LOCALES.find(l => l.code === locale)?.flag} {SUPPORTED_LOCALES.find(l => l.code === locale)?.nativeName}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Profile Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('set_profile')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {/* Weight & Height in row */}
          <View style={styles.profileRow}>
            <View style={styles.profileField}>
              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{t('set_weight')}</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.bgInput, color: theme.text }]}
                value={String(profile.weight_kg)}
                onChangeText={(v) => setProfile(prev => ({ ...prev, weight_kg: parseFloat(v) || 0 }))}
                keyboardType="numeric" placeholderTextColor={theme.textDim} />
            </View>
            <View style={styles.profileField}>
              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{t('set_height')}</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.bgInput, color: theme.text }]}
                value={String(profile.height_cm)}
                onChangeText={(v) => setProfile(prev => ({ ...prev, height_cm: parseFloat(v) || 0 }))}
                keyboardType="numeric" placeholderTextColor={theme.textDim} />
            </View>
          </View>

          {/* Age & Sex in row */}
          <View style={styles.profileRow}>
            <View style={styles.profileField}>
              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{t('set_age')}</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.bgInput, color: theme.text }]}
                value={String(profile.age)}
                onChangeText={(v) => setProfile(prev => ({ ...prev, age: parseInt(v) || 0 }))}
                keyboardType="numeric" placeholderTextColor={theme.textDim} />
            </View>
            <View style={styles.profileField}>
              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{t('set_sex')}</Text>
              <View style={styles.sexToggle}>
                {[{ id: 'male', icon: 'male' }, { id: 'female', icon: 'female' }].map((s) => (
                  <TouchableOpacity key={s.id}
                    style={[styles.sexOption, { backgroundColor: theme.bgInput }, profile.sex === s.id && { backgroundColor: theme.accent }]}
                    onPress={() => setProfile(prev => ({ ...prev, sex: s.id }))}>
                    <Ionicons name={s.icon as any} size={18} color={profile.sex === s.id ? '#fff' : theme.textMuted} />
                    <Text style={[styles.sexLabel, { color: theme.textMuted }, profile.sex === s.id && { color: '#fff' }]}>
                      {s.id === 'male' ? t('set_male') : t('set_female')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Weight Goal */}
          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{t('set_weight_goal')}</Text>
          <View style={styles.weightGoalGrid}>
            {[
              { id: 'lose', label: t('set_lose_weight'), icon: 'trending-down', color: '#ff6b6b' },
              { id: 'maintain', label: t('set_maintain'), icon: 'remove', color: '#00d4ff' },
              { id: 'gain', label: t('set_gain_weight'), icon: 'trending-up', color: '#00ff88' },
            ].map((g) => (
              <TouchableOpacity key={g.id}
                style={[styles.weightGoalOption, { backgroundColor: theme.bgInput },
                  profile.weight_goal === g.id && { backgroundColor: g.color + '20', borderColor: g.color, borderWidth: 1 }]}
                onPress={() => setProfile(prev => ({ ...prev, weight_goal: g.id }))}>
                <Ionicons name={g.icon as any} size={18} color={profile.weight_goal === g.id ? g.color : theme.textMuted} />
                <Text style={[styles.weightGoalLabel, { color: theme.textMuted },
                  profile.weight_goal === g.id && { color: g.color }]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{t('set_activity')}</Text>
          <View style={styles.activityGrid}>
            {ACTIVITY_LEVEL_IDS.map((levelId) => {
              const labelKey = `set_${levelId}` as const;
              return (
              <TouchableOpacity key={levelId}
                style={[styles.activityOption, { backgroundColor: theme.bgInput }, profile.activity_level === levelId && { backgroundColor: theme.accent }]}
                onPress={() => setProfile(prev => ({ ...prev, activity_level: levelId }))}>
                <Text style={[styles.activityLabel, { color: theme.textMuted }, profile.activity_level === levelId && { color: '#fff' }]}>
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{t('set_health_goals')}</Text>
          <View style={styles.goalsGrid}>
            {HEALTH_GOAL_DEFS.map((goal) => (
              <TouchableOpacity key={goal.id}
                style={[styles.goalOption, { backgroundColor: theme.bgInput }, profile.health_goals.includes(goal.id) && { backgroundColor: theme.accentGlow, borderColor: theme.accent, borderWidth: 1 }]}
                onPress={() => toggleGoal(goal.id)}>
                <Ionicons name={goal.icon as any} size={16} color={profile.health_goals.includes(goal.id) ? theme.accent : theme.textMuted} />
                <Text style={[styles.goalLabel, { color: theme.textMuted }, profile.health_goals.includes(goal.id) && { color: theme.accent }]}>
                  {t(goal.key)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Daily Goals Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('set_daily_goals')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {[
            { key: 'daily_calorie_goal', label: t('set_calorie_goal'), unit: 'kcal', icon: 'flame', color: '#ff6b6b' },
            { key: 'daily_protein_goal', label: t('set_protein_goal'), unit: 'g', icon: 'barbell', color: '#00d4ff' },
            { key: 'daily_water_goal_ml', label: t('set_water_goal_label'), unit: 'ml', icon: 'water', color: '#4ecdc4' },
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
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('set_notifications')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {/* Master Toggle */}
          <View style={styles.switchRow}>
            <View style={styles.switchLeft}>
              <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 255, 136, 0.15)' }]}>
                <Ionicons name="notifications" size={18} color="#00ff88" />
              </View>
              <View>
                <Text style={[styles.switchLabel, { color: theme.text }]}>{t('set_all_notifs')}</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>{t('set_notif_master')}</Text>
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
                <Text style={[styles.switchLabel, { color: theme.text }]}>{t('set_water_reminders')}</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>{t('set_water_every_2h')}</Text>
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
                <Text style={[styles.switchLabel, { color: theme.text }]}>{t('set_meal_reminders')}</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>{t('set_meal_times')}</Text>
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
                <Text style={[styles.switchLabel, { color: theme.text }]}>{t('set_routine_reminders')}</Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>{t('set_routine_times')}</Text>
              </View>
            </View>
            <Switch value={settings.routine_reminder_enabled && settings.notifications_enabled}
              onValueChange={(v) => setSettings(prev => ({ ...prev, routine_reminder_enabled: v }))}
              disabled={!settings.notifications_enabled}
              trackColor={{ false: theme.bgInput, true: theme.accent }} thumbColor="#fff" />
          </View>
          {/* Test Notification */}
          <TouchableOpacity
            style={[styles.testNotifBtn, { backgroundColor: theme.bgInput }]}
            onPress={async () => {
              try {
                const token = await AsyncStorage.getItem('session_token');
                if (!token) return;
                const res = await fetch(`${BACKEND_URL}/api/notifications/test`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                  Alert.alert('Sent!', 'A test notification has been sent to your device.');
                } else {
                  const err = await res.json();
                  Alert.alert('Info', err.detail || 'Could not send test notification. Make sure notifications are enabled on your device.');
                }
              } catch (e) {
                Alert.alert('Note', 'Push notifications work on physical devices only. They do not work in the web preview.');
              }
            }}
          >
            <Ionicons name="send" size={16} color={theme.accent} />
            <Text style={[styles.testNotifText, { color: theme.accent }]}>{t('set_test_notif')}</Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('set_subscription')}</Text>
        <View style={[styles.card, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          {paymentStatus?.is_premium ? (
            <>
              <View style={styles.premiumBadge}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(255, 217, 61, 0.15)' }]}>
                  <Ionicons name="diamond" size={20} color="#ffd93d" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { color: '#ffd93d' }]}>NutriOS Pro</Text>
                  <Text style={[styles.switchDesc, { color: theme.textMuted }]}>
                    {paymentStatus.subscription_plan === 'annual' ? 'Annual plan' : 'Monthly plan'} — Active
                  </Text>
                </View>
                <Ionicons name="checkmark-circle" size={24} color="#00ff88" />
              </View>

              {paymentStatus.cancel_at_period_end ? (
                <View style={styles.cancelledNotice}>
                  <Ionicons name="information-circle" size={18} color="#ffa500" />
                  <Text style={[styles.cancelledText, { color: theme.textMuted }]}>
                    Cancelling — access until {paymentStatus.access_until ? new Date(paymentStatus.access_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'end of period'}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.cancelSubBtn}
                  onPress={() => {
                    Alert.alert(
                      'Cancel Subscription',
                      'Are you sure? You will keep access until the end of your current billing period.',
                      [
                        { text: 'Keep Subscription', style: 'cancel' },
                        {
                          text: 'Cancel Subscription',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              const token = await AsyncStorage.getItem('session_token');
                              if (!token) return;
                              const res = await fetch(`${BACKEND_URL}/api/payments/cancel-subscription`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` },
                              });
                              if (res.ok) {
                                const data = await res.json();
                                Alert.alert(
                                  'Subscription Cancelled',
                                  `You'll have access until ${data.access_until_formatted}. A confirmation email has been sent.`
                                );
                                fetchData();
                              } else {
                                Alert.alert('Error', 'Failed to cancel subscription');
                              }
                            } catch (e) {
                              Alert.alert('Error', 'Failed to cancel subscription');
                            }
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#ff6b6b" />
                  <Text style={styles.cancelSubText}>Cancel Subscription</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <View style={styles.trialInfo}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 212, 255, 0.15)' }]}>
                  <Ionicons name="time" size={20} color="#00d4ff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Free Trial</Text>
                  <Text style={[styles.switchDesc, { color: theme.textMuted }]}>
                    {paymentStatus?.trial_days_remaining > 0
                      ? `${paymentStatus.trial_days_remaining} days remaining`
                      : 'Trial expired'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => router.push('/upgrade')}
              >
                <Ionicons name="diamond" size={18} color="#000" />
                <Text style={styles.upgradeBtnText}>Subscribe from {'\u20ac'}2.99/mo</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Account Section */}
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('set_account')}</Text>
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
          <Text style={[styles.logoutText, { color: theme.danger }]}>{t('set_logout')}</Text>
        </TouchableOpacity>

        {/* Danger Zone */}
        <Text style={[styles.sectionTitle, { color: '#ff6b6b', marginTop: 24 }]}>{t('set_danger_zone')}</Text>
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
              {deleting ? t('set_deleting') : t('set_delete_account')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.disclaimer, { color: theme.textDim }]}>
          NutriOS v3.0 • Nutritional information only. Not medical advice.
        </Text>
        <TouchableOpacity style={styles.tosLink} onPress={() => Linking.openURL('https://sites.google.com/view/nutrios-terms-of-service/home-page')}>
          <Ionicons name="document-text-outline" size={14} color={theme.accent} />
          <Text style={[styles.tosText, { color: theme.accent }]}>{t('set_terms')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal visible={showLangModal} transparent animationType="fade" onRequestClose={() => setShowLangModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.bgCard || '#1a1a2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: theme.border || 'rgba(255,255,255,0.08)' }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="language" size={36} color="#00d4ff" />
              <Text style={{ color: theme.text || '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 }}>{t('set_language')}</Text>
            </View>
            {SUPPORTED_LOCALES.map((lang) => {
              const isActive = locale === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 6, backgroundColor: isActive ? 'rgba(0,212,255,0.1)' : 'transparent', borderWidth: isActive ? 1 : 0, borderColor: '#00d4ff', gap: 12 }}
                  onPress={() => { setLocale(lang.code); setShowLangModal(false); }}
                >
                  <Text style={{ fontSize: 28 }}>{lang.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: isActive ? '#00d4ff' : (theme.text || '#fff'), fontSize: 16, fontWeight: '600' }}>{lang.nativeName}</Text>
                    <Text style={{ color: theme.textMuted || '#888', fontSize: 12 }}>{lang.label}</Text>
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={22} color="#00d4ff" />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={{ marginTop: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}
              onPress={() => setShowLangModal(false)}
            >
              <Text style={{ color: theme.text || '#fff', fontSize: 15, fontWeight: '600' }}>{t('common_done')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.cardBg || '#1a1a2e', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)' }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="warning" size={48} color="#ff3b30" />
            </View>

            {deleteStep === 1 ? (
              <>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>{t('set_delete_question')}</Text>
                <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                  Are you sure you want to permanently delete your account and all your data? This action cannot be undone.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#ff3b30', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
                  onPress={() => setDeleteStep(2)}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('set_delete_btn')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>{t('set_final_confirm')}</Text>
                <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 }}>
                  This will permanently delete ALL your data including meals, water logs, routines, recipes, and badges. This is irreversible.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: '#ff3b30', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
                  onPress={executeDeleteAccount}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{t('set_delete_final_btn')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>{t('set_keep')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  profileRow: { flexDirection: 'row', gap: 12 },
  profileField: { flex: 1 },
  sexToggle: { flexDirection: 'row', gap: 8 },
  sexOption: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  sexLabel: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
  weightGoalGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  weightGoalOption: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  weightGoalLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
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
  premiumBadge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  cancelledNotice: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255, 165, 0, 0.08)', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  cancelledText: { fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 18 },
  cancelSubBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingVertical: 12, borderRadius: 10, backgroundColor: 'rgba(255, 107, 107, 0.08)' },
  cancelSubText: { color: '#ff6b6b', fontSize: 14, fontWeight: '600', marginLeft: 6 },
  trialInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffd93d', paddingVertical: 14, borderRadius: 12 },
  upgradeBtnText: { color: '#000', fontSize: 15, fontWeight: '700', marginLeft: 8 },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 16 },
  tosLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, marginBottom: 24, paddingVertical: 8 },
  tosText: { fontSize: 13, fontWeight: '500', marginLeft: 6, textDecorationLine: 'underline' },
  testNotifBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, marginTop: 12 },
  testNotifText: { fontSize: 13, fontWeight: '600', marginLeft: 8 },
});
