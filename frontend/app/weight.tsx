import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, Modal, KeyboardAvoidingView, Platform, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../src/LanguageContext';
import { useTheme } from '../src/ThemeContext';
import EmptyState from '../src/components/EmptyState';
import FormField from '../src/components/FormField';
import { hapticLight, hapticSuccess, hapticMedium, hapticError } from '../src/haptics';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { weightSchema } from '../src/schemas';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SW } = Dimensions.get('window');

interface WeightEntry {
  weight_kg: number;
  date: string;
  note?: string;
}

interface WeightStats {
  current: number;
  first: number;
  change: number;
  min: number;
  max: number;
  avg: number;
  total_entries: number;
}

// Simple chart component for weight history
function WeightChart({ entries, stats }: { entries: WeightEntry[]; stats: WeightStats }) {
  if (entries.length < 2) return null;

  const chartWidth = SW - 64;
  const chartHeight = 160;
  const padding = 20;
  const weights = entries.map(e => e.weight_kg);
  const minW = stats.min - 1;
  const maxW = stats.max + 1;
  const range = maxW - minW || 1;

  const points = entries.map((entry, i) => {
    const x = padding + (i / (entries.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - ((entry.weight_kg - minW) / range) * (chartHeight - 2 * padding);
    return { x, y, weight: entry.weight_kg, date: entry.date };
  });

  // Build SVG-like path using View positioning
  return (
    <View style={[styles.chartContainer, { width: chartWidth, height: chartHeight }]}>
      {/* Y-axis labels */}
      <Text style={[styles.chartLabel, { top: padding - 6, left: 0 }]}>{maxW.toFixed(0)}</Text>
      <Text style={[styles.chartLabel, { bottom: padding - 6, left: 0 }]}>{minW.toFixed(0)}</Text>

      {/* Grid lines */}
      <View style={[styles.chartGridLine, { top: padding }]} />
      <View style={[styles.chartGridLine, { top: chartHeight / 2 }]} />
      <View style={[styles.chartGridLine, { bottom: padding }]} />

      {/* Data points and connecting lines */}
      {points.map((point, i) => (
        <View key={i}>
          {/* Line to next point */}
          {i < points.length - 1 && (() => {
            const next = points[i + 1];
            const dx = next.x - point.x;
            const dy = next.y - point.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            return (
              <View
                style={{
                  position: 'absolute',
                  left: point.x,
                  top: point.y,
                  width: length,
                  height: 2,
                  backgroundColor: stats.change <= 0 ? '#00ff88' : '#ff6b6b',
                  opacity: 0.6,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: 'left center',
                }}
              />
            );
          })()}
          {/* Point */}
          <View style={{
            position: 'absolute',
            left: point.x - 4,
            top: point.y - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === points.length - 1 ? '#00d4ff' : '#666',
            borderWidth: i === points.length - 1 ? 2 : 0,
            borderColor: '#00d4ff',
          }} />
        </View>
      ))}

      {/* X-axis dates */}
      {entries.length > 0 && (
        <>
          <Text style={[styles.chartDateLabel, { left: padding }]}>{entries[0].date.slice(5)}</Text>
          <Text style={[styles.chartDateLabel, { right: padding }]}>{entries[entries.length - 1].date.slice(5)}</Text>
        </>
      )}
    </View>
  );
}

export default function WeightTrackingScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [stats, setStats] = useState<WeightStats>({ current: 70, first: 70, change: 0, min: 70, max: 70, avg: 70, total_entries: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(30);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ── react-hook-form ──
  const { control, handleSubmit, reset, formState: { errors, touchedFields } } = useForm({
    resolver: zodResolver(weightSchema),
    defaultValues: { weight_kg: '', note: '' },
    mode: 'onBlur',
  });

  const getToken = async () => {
    try {
      return await AsyncStorage.getItem('session_token') || '';
    } catch { return ''; }
  };

  const fetchHistory = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/weight/history?days=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setStats(data.stats || stats);
      }
    } catch (e) {
      console.log('Weight fetch error:', e);
    } finally {
      setRefreshing(false);
    }
  }, [period]);

  useFocusEffect(useCallback(() => { fetchHistory(); }, [fetchHistory]));

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleLogWeight = async (formData: { weight_kg: string; note?: string }) => {
    const weight = parseFloat(formData.weight_kg);
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/weight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ weight_kg: weight, note: formData.note || null }),
      });
      if (res.ok) {
        hapticSuccess();
        setShowAddModal(false);
        reset();
        fetchHistory();
      }
    } catch (e) {
      console.log('Weight log error:', e);
    } finally {
      setLoading(false);
    }
  };

  const changeColor = stats.change < 0 ? '#00ff88' : stats.change > 0 ? '#ff6b6b' : '#888';
  const changeIcon = stats.change < 0 ? 'trending-down' : stats.change > 0 ? 'trending-up' : 'remove';

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchHistory(); }} tintColor="#00d4ff" />}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => { hapticLight(); router.back(); }} style={styles.backBtn}
          accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{t('weight_title')}</Text>
              <Text style={styles.subtitle}>{t('weight_subtitle')}</Text>
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={() => { hapticMedium(); setShowAddModal(true); }}>
              <Ionicons name="add" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {entries.length === 0 ? (
            <EmptyState
              icon="scale"
              iconColor="#00d4ff"
              title={t('weight_empty_title')}
              subtitle={t('weight_empty_subtitle')}
              ctaLabel={t('weight_log_cta')}
              onCta={() => setShowAddModal(true)}
            />
          ) : (
            <>
              {/* Current Weight Card */}
              <View style={styles.currentCard}>
                <View style={styles.currentMain}>
                  <Text style={styles.currentLabel}>{t('weight_current')}</Text>
                  <Text style={styles.currentValue}>{stats.current}<Text style={styles.currentUnit}>kg</Text></Text>
                </View>
                <View style={[styles.changeBadge, { backgroundColor: changeColor + '12' }]}>
                  <Ionicons name={changeIcon as any} size={18} color={changeColor} />
                  <Text style={[styles.changeText, { color: changeColor }]}>
                    {stats.change > 0 ? '+' : ''}{stats.change}kg
                  </Text>
                </View>
              </View>

              {/* Period Toggle */}
              <View style={styles.periodRow}>
                {[7, 30, 90, 365].map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.periodBtn, period === p && styles.periodBtnActive]}
                    onPress={() => { hapticLight(); setPeriod(p); }}
                  >
                    <Text style={[styles.periodText, period === p && styles.periodTextActive]}>
                      {p === 365 ? '1Y' : `${p}D`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.cardTitle}>{t('weight_progress')}</Text>
                <WeightChart entries={entries} stats={stats} />
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.min}</Text>
                  <Text style={styles.statLabel}>{t('weight_min')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.avg}</Text>
                  <Text style={styles.statLabel}>{t('weight_avg')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.max}</Text>
                  <Text style={styles.statLabel}>{t('weight_max')}</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.total_entries}</Text>
                  <Text style={styles.statLabel}>{t('weight_entries')}</Text>
                </View>
              </View>

              {/* Recent Entries */}
              <View style={styles.recentSection}>
                <Text style={styles.cardTitle}>{t('weight_recent')}</Text>
                {entries.slice(-10).reverse().map((entry, i) => (
                  <View key={entry.date} style={styles.entryRow}>
                    <View style={styles.entryDot} />
                    <View style={styles.entryInfo}>
                      <Text style={styles.entryDate}>{entry.date}</Text>
                      {entry.note ? <Text style={styles.entryNote}>{entry.note}</Text> : null}
                    </View>
                    <Text style={styles.entryWeight}>{entry.weight_kg}kg</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* Add Weight Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{t('weight_log_title')}</Text>

              <Text style={styles.inputLabel}>{t('weight_kg_label')}</Text>
              <Controller
                control={control}
                name="weight_kg"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField
                    placeholder="70.5"
                    keyboardType="decimal-pad"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.weight_kg?.message as string}
                    touched={!!touchedFields.weight_kg || !!errors.weight_kg}
                    icon="scale"
                    autoFocus
                  />
                )}
              />

              <Text style={styles.inputLabel}>{t('weight_note_label')}</Text>
              <Controller
                control={control}
                name="note"
                render={({ field: { onChange, onBlur, value } }) => (
                  <FormField
                    placeholder={t('weight_note_placeholder')}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.note?.message as string}
                    touched={!!touchedFields.note || !!errors.note}
                    icon="document-text"
                  />
                )}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { hapticLight(); setShowAddModal(false); reset(); }}>
                  <Text style={styles.cancelText}>{t('set_cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, loading && { opacity: 0.5 }]}
                  onPress={handleSubmit(handleLogWeight)}
                  disabled={loading}
                >
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.saveText}>{t('weight_save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  scrollContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a3e', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center' },
  // Current weight
  currentCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, backgroundColor: '#0d0d22', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: 'rgba(0,212,255,0.1)' },
  currentMain: {},
  currentLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
  currentValue: { fontSize: 40, fontWeight: '900', color: '#fff' },
  currentUnit: { fontSize: 18, color: '#666', fontWeight: '500' },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  changeText: { fontSize: 16, fontWeight: '800' },
  // Period
  periodRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, gap: 8 },
  periodBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#0d0d22', alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#00d4ff' },
  periodText: { color: '#666', fontWeight: '700', fontSize: 13 },
  periodTextActive: { color: '#fff' },
  // Chart
  chartCard: { marginHorizontal: 20, marginTop: 16, backgroundColor: '#0d0d22', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#ccc', marginBottom: 16 },
  chartContainer: { position: 'relative', alignSelf: 'center' },
  chartLabel: { position: 'absolute', color: '#444', fontSize: 10, fontWeight: '600' },
  chartDateLabel: { position: 'absolute', bottom: 0, color: '#444', fontSize: 10 },
  chartGridLine: { position: 'absolute', left: 20, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, marginTop: 16, gap: 8 },
  statCard: { width: (SW - 56) / 4, backgroundColor: '#0d0d22', borderRadius: 14, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: '#666', marginTop: 4, fontWeight: '500' },
  // Recent entries
  recentSection: { marginHorizontal: 20, marginTop: 20 },
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  entryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00d4ff', marginRight: 14 },
  entryInfo: { flex: 1 },
  entryDate: { fontSize: 14, color: '#ccc', fontWeight: '600' },
  entryNote: { fontSize: 12, color: '#555', marginTop: 2 },
  entryWeight: { fontSize: 18, fontWeight: '800', color: '#fff' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#12122a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 24, textAlign: 'center' },
  inputLabel: { fontSize: 13, color: '#888', fontWeight: '600', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#0d0d22', borderRadius: 14, padding: 16, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#1a1a3e', alignItems: 'center' },
  cancelText: { color: '#888', fontWeight: '700', fontSize: 15 },
  saveBtn: { flex: 2, flexDirection: 'row', gap: 8, padding: 16, borderRadius: 14, backgroundColor: '#00d4ff', alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
