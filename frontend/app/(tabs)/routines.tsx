import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, TextInput, Modal, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedFetch, CacheKeys, CacheTTL, clearCacheForKey } from '../../src/cache';
import { useLanguage } from '../../src/LanguageContext';
import EmptyState from '../../src/components/EmptyState';
import { hapticLight, hapticSuccess, hapticMedium } from '../../src/haptics';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Task {
  id: string;
  name: string;
  completed?: boolean;
}

interface Routine {
  id: string;
  name: string;
  type: string;
  time_start: string;
  time_end: string;
  days: string[];
  tasks: Task[];
}

const ROUTINE_TYPES = [
  { id: 'morning', label: 'Morning', icon: 'sunny', color: '#ffd93d' },
  { id: 'work', label: 'Work', icon: 'briefcase', color: '#00d4ff' },
  { id: 'workout', label: 'Workout', icon: 'barbell', color: '#ff6b6b' },
  { id: 'evening', label: 'Evening', icon: 'moon', color: '#a29bfe' },
  { id: 'custom', label: 'Custom', icon: 'list', color: '#4ecdc4' },
];

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export default function RoutinesScreen() {
  const { t } = useLanguage();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [todayRoutines, setTodayRoutines] = useState<Routine[]>([]);
  const [streak, setStreak] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoutine, setNewRoutine] = useState({ name: '', type: 'morning', time_start: '07:00', time_end: '08:00', days: [...DAYS], tasks: [] as Task[] });
  const [newTaskName, setNewTaskName] = useState('');

  const fetchRoutines = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const authHeaders = { 'Authorization': `Bearer ${token}` };

      const [routinesResult, todayResult, streakResult] = await Promise.all([
        cachedFetch(CacheKeys.routines, async () => {
          const res = await fetch(`${BACKEND_URL}/api/routines`, { headers: authHeaders });
          if (!res.ok) throw new Error('routines failed');
          return res.json();
        }, CacheTTL.MEDIUM),
        cachedFetch(CacheKeys.routinesToday, async () => {
          const res = await fetch(`${BACKEND_URL}/api/routines/today`, { headers: authHeaders });
          if (!res.ok) throw new Error('routines today failed');
          return res.json();
        }, CacheTTL.SHORT),
        cachedFetch('routines_streak', async () => {
          const res = await fetch(`${BACKEND_URL}/api/routines/streak`, { headers: authHeaders });
          if (!res.ok) throw new Error('streak failed');
          return res.json();
        }, CacheTTL.SHORT),
      ]);

      setRoutines(routinesResult.data?.routines || []);
      setTodayRoutines(todayResult.data?.routines || []);
      setStreak(streakResult.data?.streak_days || 0);
    } catch (error) {
      console.error('Error fetching routines:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchRoutines(); }, []));

  const completeTask = async (routineId: string, taskId: string) => {
    hapticSuccess();
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      await fetch(`${BACKEND_URL}/api/routines/${routineId}/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Update local state and invalidate cache
      await Promise.all([
        clearCacheForKey(CacheKeys.routinesToday),
        clearCacheForKey('routines_streak'),
        clearCacheForKey(CacheKeys.dashboard),
      ]);
      setTodayRoutines(prev => prev.map(r => {
        if (r.id === routineId) {
          return {
            ...r,
            tasks: r.tasks.map(t => t.id === taskId ? { ...t, completed: true } : t)
          };
        }
        return r;
      }));
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const createRoutine = async () => {
    if (!newRoutine.name.trim()) {
      Alert.alert('Error', 'Please enter a routine name');
      return;
    }
    hapticMedium();

    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/routines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newRoutine)
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewRoutine({ name: '', type: 'morning', time_start: '07:00', time_end: '08:00', days: [...DAYS], tasks: [] });
        await Promise.all([
          clearCacheForKey(CacheKeys.routines),
          clearCacheForKey(CacheKeys.routinesToday),
        ]);
        fetchRoutines();
      }
    } catch (error) {
      console.error('Error creating routine:', error);
      Alert.alert('Error', 'Failed to create routine');
    }
  };

  const addTask = () => {
    if (!newTaskName.trim()) return;
    setNewRoutine(prev => ({
      ...prev,
      tasks: [...prev.tasks, { id: Date.now().toString(), name: newTaskName.trim() }]
    }));
    setNewTaskName('');
    // Scroll to bottom so the input stays visible
    setTimeout(() => modalScrollRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const removeTask = (taskId: string) => {
    setNewRoutine(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== taskId)
    }));
  };

  const toggleDay = (day: string) => {
    setNewRoutine(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
    }));
  };

  const getRoutineType = (typeId: string) => ROUTINE_TYPES.find(rt => rt.id === typeId) || ROUTINE_TYPES[4];
  const modalScrollRef = useRef<ScrollView>(null);
  const taskInputRef = useRef<TextInput>(null);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRoutines(); }} tintColor="#00d4ff" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{t('rout_title')}</Text>
            <Text style={styles.subtitle}>{t('rout_subtitle')}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreateModal(true)}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Streak Card */}
        <View style={styles.streakCard}>
          <View style={styles.streakIcon}>
            <Ionicons name="flame" size={28} color="#ff6b6b" />
          </View>
          <View style={styles.streakInfo}>
            <Text style={styles.streakValue}>{streak} {t('rout_streak')}</Text>
            <Text style={styles.streakLabel}>{t('rout_keep_going')}</Text>
          </View>
        </View>

        {/* Today's Routines */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('rout_today_schedule')}</Text>
          {todayRoutines.length > 0 ? (
            todayRoutines.map((routine) => {
              const type = getRoutineType(routine.type);
              const completedTasks = routine.tasks.filter(t => t.completed).length;
              const progress = routine.tasks.length > 0 ? (completedTasks / routine.tasks.length) * 100 : 0;

              return (
                <View key={routine.id} style={styles.routineCard}>
                  <View style={styles.routineHeader}>
                    <View style={[styles.routineTypeIcon, { backgroundColor: type.color + '20' }]}>
                      <Ionicons name={type.icon as any} size={20} color={type.color} />
                    </View>
                    <View style={styles.routineInfo}>
                      <Text style={styles.routineName}>{routine.name}</Text>
                      <Text style={styles.routineTime}>{routine.time_start} - {routine.time_end}</Text>
                    </View>
                    <View style={styles.progressBadge}>
                      <Text style={styles.progressText}>{completedTasks}/{routine.tasks.length}</Text>
                    </View>
                  </View>

                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: type.color }]} />
                  </View>

                  <View style={styles.tasksList}>
                    {routine.tasks.map((task) => (
                      <TouchableOpacity
                        key={task.id}
                        style={styles.taskItem}
                        onPress={() => !task.completed && completeTask(routine.id, task.id)}
                        disabled={task.completed}
                      >
                        <View style={[styles.taskCheckbox, task.completed && styles.taskChecked]}>
                          {task.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                        <Text style={[styles.taskName, task.completed && styles.taskNameCompleted]}>{task.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>{t('rout_no_routines')}</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
                <Text style={styles.createBtnText}>{t('rout_create_first')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* All Routines */}
        {routines.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('rout_all')} ({routines.length})</Text>
            {routines.map((routine) => {
              const type = getRoutineType(routine.type);
              return (
                <View key={routine.id} style={styles.routineItemSmall}>
                  <View style={[styles.routineTypeIconSmall, { backgroundColor: type.color + '20' }]}>
                    <Ionicons name={type.icon as any} size={16} color={type.color} />
                  </View>
                  <View style={styles.routineItemInfo}>
                    <Text style={styles.routineItemName}>{routine.name}</Text>
                    <Text style={styles.routineItemDays}>{routine.days.map(d => d.charAt(0).toUpperCase()).join(' ')}</Text>
                  </View>
                  <Text style={styles.routineItemTasks}>{routine.tasks.length} {t('rout_tasks')}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon="list"
            iconColor="#a29bfe"
            title={t('rout_empty_title')}
            subtitle={t('rout_empty_subtitle')}
            ctaLabel={t('rout_create')}
            onCta={() => setShowCreateModal(true)}
          />
        )}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('rout_create')}</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView
                ref={modalScrollRef}
                style={styles.modalScroll}
                contentContainerStyle={{ paddingBottom: 30 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.inputLabel}>Routine Name</Text>
                <TextInput
                  style={styles.input}
                  value={newRoutine.name}
                  onChangeText={(text) => setNewRoutine(prev => ({ ...prev, name: text }))}
                  placeholder="e.g., Morning Workout"
                  placeholderTextColor="#666"
                  onFocus={() => setTimeout(() => modalScrollRef.current?.scrollTo({ y: 0, animated: true }), 200)}
                />

                <Text style={styles.inputLabel}>Type</Text>
                <View style={styles.typeGrid}>
                  {ROUTINE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.id}
                      style={[styles.typeOption, newRoutine.type === type.id && { borderColor: type.color, backgroundColor: type.color + '20' }]}
                      onPress={() => setNewRoutine(prev => ({ ...prev, type: type.id }))}
                    >
                      <Ionicons name={type.icon as any} size={20} color={newRoutine.type === type.id ? type.color : '#666'} />
                      <Text style={[styles.typeLabel, newRoutine.type === type.id && { color: type.color }]}>{type.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Days</Text>
                <View style={styles.daysRow}>
                  {DAYS.map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayOption, newRoutine.days.includes(day) && styles.daySelected]}
                      onPress={() => toggleDay(day)}
                    >
                      <Text style={[styles.dayText, newRoutine.days.includes(day) && styles.dayTextSelected]}>{day.charAt(0).toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.timeRow}>
                  <View style={styles.timeInput}>
                    <Text style={styles.inputLabel}>Start Time</Text>
                    <TextInput
                      style={styles.input}
                      value={newRoutine.time_start}
                      onChangeText={(text) => setNewRoutine(prev => ({ ...prev, time_start: text }))}
                      placeholder="07:00"
                      placeholderTextColor="#666"
                    />
                  </View>
                  <View style={styles.timeInput}>
                    <Text style={styles.inputLabel}>End Time</Text>
                    <TextInput
                      style={styles.input}
                      value={newRoutine.time_end}
                      onChangeText={(text) => setNewRoutine(prev => ({ ...prev, time_end: text }))}
                      placeholder="08:00"
                      placeholderTextColor="#666"
                    />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Tasks</Text>
                <View style={styles.addTaskRow}>
                  <TextInput
                    ref={taskInputRef}
                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                    value={newTaskName}
                    onChangeText={setNewTaskName}
                    placeholder="Add a task"
                    placeholderTextColor="#666"
                    onSubmitEditing={addTask}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onFocus={() => setTimeout(() => modalScrollRef.current?.scrollToEnd({ animated: true }), 200)}
                  />
                  <TouchableOpacity style={styles.addTaskBtn} onPress={addTask}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {newRoutine.tasks.map((task) => (
                  <View key={task.id} style={styles.taskPreview}>
                    <Ionicons name="checkbox-outline" size={18} color="#00d4ff" />
                    <Text style={styles.taskPreviewText}>{task.name}</Text>
                    <TouchableOpacity onPress={() => removeTask(task.id)}>
                      <Ionicons name="close-circle" size={20} color="#ff6b6b" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.createRoutineBtn} onPress={createRoutine}>
                <Text style={styles.createRoutineBtnText}>Create Routine</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center' },
  streakCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 107, 107, 0.1)', borderRadius: 16, padding: 16, marginBottom: 20 },
  streakIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255, 107, 107, 0.2)', justifyContent: 'center', alignItems: 'center' },
  streakInfo: { marginLeft: 16, flex: 1 },
  streakValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  streakLabel: { fontSize: 12, color: '#888', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  routineCard: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 16, marginBottom: 12 },
  routineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  routineTypeIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  routineInfo: { flex: 1, marginLeft: 12 },
  routineName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  routineTime: { fontSize: 12, color: '#888', marginTop: 2 },
  progressBadge: { backgroundColor: 'rgba(78, 205, 196, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  progressText: { color: '#4ecdc4', fontSize: 12, fontWeight: '600' },
  progressBar: { height: 4, backgroundColor: '#2a2a4e', borderRadius: 2, marginBottom: 12 },
  progressFill: { height: 4, borderRadius: 2 },
  tasksList: {},
  taskItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  taskCheckbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#444', justifyContent: 'center', alignItems: 'center' },
  taskChecked: { backgroundColor: '#4ecdc4', borderColor: '#4ecdc4' },
  taskName: { marginLeft: 12, fontSize: 14, color: '#fff' },
  taskNameCompleted: { color: '#666', textDecorationLine: 'line-through' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyText: { color: '#666', marginTop: 16, marginBottom: 20 },
  createBtn: { backgroundColor: '#00d4ff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  createBtnText: { color: '#fff', fontWeight: '600' },
  routineItemSmall: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, marginBottom: 8 },
  routineTypeIconSmall: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  routineItemInfo: { flex: 1, marginLeft: 12 },
  routineItemName: { fontSize: 14, fontWeight: '500', color: '#fff' },
  routineItemDays: { fontSize: 11, color: '#888', marginTop: 2 },
  routineItemTasks: { fontSize: 12, color: '#666' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a4e' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalScroll: { padding: 20 },
  inputLabel: { fontSize: 12, color: '#888', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#2a2a4e', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  typeOption: { width: '30%', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: '#2a2a4e', alignItems: 'center', marginRight: '3%', marginBottom: 10 },
  typeLabel: { fontSize: 11, color: '#888', marginTop: 4 },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayOption: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2a2a4e', justifyContent: 'center', alignItems: 'center' },
  daySelected: { backgroundColor: '#00d4ff' },
  dayText: { fontSize: 12, color: '#888', fontWeight: '600' },
  dayTextSelected: { color: '#fff' },
  timeRow: { flexDirection: 'row' },
  timeInput: { flex: 1, marginRight: 8 },
  addTaskRow: { flexDirection: 'row', alignItems: 'center' },
  addTaskBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center' },
  taskPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2a2a4e', padding: 12, borderRadius: 8, marginTop: 8 },
  taskPreviewText: { flex: 1, marginLeft: 10, color: '#fff', fontSize: 14 },
  createRoutineBtn: { backgroundColor: '#00d4ff', margin: 20, padding: 16, borderRadius: 12, alignItems: 'center' },
  createRoutineBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
