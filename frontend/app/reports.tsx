import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { useLanguage } from '../src/LanguageContext';
import { hapticLight, hapticSuccess, hapticMedium } from '../src/haptics';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface WeekData {
  start: string;
  end: string;
  nutrition: { avg_calories: number; avg_protein: number; avg_carbs: number; avg_fat: number; total_calories: number; days_tracked: number };
  water: { avg_ml: number; total_ml: number; days_tracked: number };
  routines: { completed: number; total: number; rate: number };
  weight: { avg: number | null; start: number | null; end: number | null; entries: number };
  meals_count: number;
}

interface ComparisonData {
  this_week: WeekData;
  last_week: WeekData;
  comparisons: Record<string, number | null>;
}

/* ────────────────────── helper ────────────────────── */
const fmt = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const fmtDate = (d: string) => {
  const parts = d.split('-');
  return `${parts[1]}/${parts[2]}`;
};

const ChangeTag = ({ value }: { value: number | null }) => {
  if (value == null) return <Text style={s.tagNeutral}>—</Text>;
  const positive = value >= 0;
  return (
    <View style={[s.tag, positive ? s.tagUp : s.tagDown]}>
      <Ionicons name={positive ? 'arrow-up' : 'arrow-down'} size={10} color={positive ? '#00ff88' : '#ff6b6b'} />
      <Text style={[s.tagText, { color: positive ? '#00ff88' : '#ff6b6b' }]}>{Math.abs(value)}%</Text>
    </View>
  );
};

/* ────────────── simple bar chart ────────────── */
const ComparisonBar = ({ label, thisVal, lastVal, unit, color, change }: { label: string; thisVal: number; lastVal: number; unit: string; color: string; change: number | null }) => {
  const maxVal = Math.max(thisVal, lastVal, 1);
  const thisPct = (thisVal / maxVal) * 100;
  const lastPct = (lastVal / maxVal) * 100;
  return (
    <View style={s.barCard}>
      <View style={s.barHeader}>
        <Text style={s.barLabel}>{label}</Text>
        <ChangeTag value={change} />
      </View>
      {/* This Week */}
      <View style={s.barRow}>
        <Text style={s.barWeekLabel}>This</Text>
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${Math.max(thisPct, 2)}%`, backgroundColor: color }]} />
        </View>
        <Text style={[s.barValue, { color }]}>{fmt(thisVal)}{unit}</Text>
      </View>
      {/* Last Week */}
      <View style={s.barRow}>
        <Text style={s.barWeekLabel}>Last</Text>
        <View style={s.barTrack}>
          <View style={[s.barFill, { width: `${Math.max(lastPct, 2)}%`, backgroundColor: color + '60' }]} />
        </View>
        <Text style={[s.barValue, { color: '#888' }]}>{fmt(lastVal)}{unit}</Text>
      </View>
    </View>
  );
};

/* ────────────────────── main ────────────────────── */
export default function ReportsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${BACKEND_URL}/api/reports/weekly-comparison`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.warn('Report fetch error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchReport(); }, [fetchReport]));

  /* ───── CSV Export ───── */
  const exportCSV = async () => {
    hapticMedium();
    setExporting('csv');
    try {
      const token = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${BACKEND_URL}/api/reports/export-data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const raw = await res.json();

      // Build CSV
      let csv = 'Category,Date,Detail,Value\n';
      (raw.meals || []).forEach((m: any) => {
        csv += `Meal,${m.date},${(m.food_name || '').replace(/,/g, ';')},${m.nutrients?.energy_kcal || 0} kcal\n`;
      });
      (raw.water || []).forEach((w: any) => {
        csv += `Water,${w.date},Intake,${w.total_ml} ml\n`;
      });
      (raw.weight || []).forEach((w: any) => {
        csv += `Weight,${w.date},${(w.note || '').replace(/,/g, ';')},${w.weight_kg} kg\n`;
      });
      (raw.daily_summaries || []).forEach((d: any) => {
        csv += `Summary,${d.date},Calories,${d.total_calories || 0} kcal\n`;
        csv += `Summary,${d.date},Protein,${d.total_protein || 0} g\n`;
      });

      const fileUri = FileSystem.cacheDirectory + 'NutriOS_Export.csv';
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        hapticSuccess();
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export NutriOS Data' });
      } else {
        Alert.alert('Saved', `File saved to ${fileUri}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to export CSV');
    } finally {
      setExporting(null);
    }
  };

  /* ───── PDF Export ───── */
  const exportPDF = async () => {
    hapticMedium();
    setExporting('pdf');
    try {
      const token = await AsyncStorage.getItem('session_token');
      const res = await fetch(`${BACKEND_URL}/api/reports/export-data`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const raw = await res.json();

      // Build HTML report
      const mealRows = (raw.meals || []).slice(0, 200).map((m: any) =>
        `<tr><td>${m.date}</td><td>${m.food_name || ''}</td><td>${m.meal_type || ''}</td><td>${m.portion_grams || ''}g</td><td>${m.nutrients?.energy_kcal?.toFixed(0) || 0}</td><td>${m.nutrients?.protein_g?.toFixed(1) || 0}</td></tr>`
      ).join('');
      const waterRows = (raw.water || []).map((w: any) =>
        `<tr><td>${w.date}</td><td>${w.total_ml} ml</td><td>${w.entries}</td></tr>`
      ).join('');
      const weightRows = (raw.weight || []).map((w: any) =>
        `<tr><td>${w.date}</td><td>${w.weight_kg} kg</td><td>${w.note || ''}</td></tr>`
      ).join('');

      const html = `
      <html><head><meta charset="UTF-8"/>
      <style>
        body{font-family:Helvetica,Arial,sans-serif;padding:20px;color:#222;}
        h1{color:#00d4ff;border-bottom:2px solid #00d4ff;padding-bottom:8px;}
        h2{color:#4ecdc4;margin-top:30px;}
        table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px;}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;}
        th{background:#f0f7ff;font-weight:bold;}
        tr:nth-child(even){background:#fafafa;}
        .meta{color:#666;font-size:12px;margin-bottom:20px;}
        .footer{text-align:center;color:#aaa;font-size:10px;margin-top:40px;border-top:1px solid #eee;padding-top:10px;}
      </style></head><body>
        <h1>NutriOS Health Report</h1>
        <p class="meta">Exported: ${new Date().toLocaleDateString()} &bull; ${raw.user_email || ''}</p>

        <h2>Meals (${(raw.meals || []).length} entries)</h2>
        <table><tr><th>Date</th><th>Food</th><th>Type</th><th>Portion</th><th>Calories</th><th>Protein (g)</th></tr>${mealRows}</table>

        <h2>Water Intake</h2>
        <table><tr><th>Date</th><th>Total</th><th>Entries</th></tr>${waterRows}</table>

        <h2>Weight Log</h2>
        <table><tr><th>Date</th><th>Weight</th><th>Note</th></tr>${weightRows}</table>

        <div class="footer">Generated by NutriOS &bull; For personal and medical use</div>
      </body></html>`;

      const { uri } = await Print.printToFileAsync({ html, base64: false });

      if (await Sharing.isAvailableAsync()) {
        hapticSuccess();
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'NutriOS Report PDF' });
      } else {
        Alert.alert('Saved', `PDF saved to ${uri}`);
      }
    } catch (e) {
      console.warn('PDF export error', e);
      Alert.alert('Error', 'Failed to export PDF');
    } finally {
      setExporting(null);
    }
  };

  /* ───── render ───── */
  const tw = data?.this_week;
  const lw = data?.last_week;
  const cmp = data?.comparisons;

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => { hapticLight(); router.back(); }} style={s.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title}>{t('report_title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#00d4ff" /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

          {/* Date Range Banner */}
          {tw && lw && (
            <View style={s.rangeBanner}>
              <View style={s.rangePill}>
                <Ionicons name="calendar" size={14} color="#00d4ff" />
                <Text style={s.rangeText}>{fmtDate(tw.start)} – {fmtDate(tw.end)}</Text>
              </View>
              <Text style={s.rangeVs}>vs</Text>
              <View style={[s.rangePill, { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                <Ionicons name="calendar-outline" size={14} color="#888" />
                <Text style={[s.rangeText, { color: '#888' }]}>{fmtDate(lw.start)} – {fmtDate(lw.end)}</Text>
              </View>
            </View>
          )}

          {/* Quick Stats Row */}
          {tw && (
            <View style={s.statsRow}>
              <View style={s.statBox}>
                <Text style={s.statVal}>{tw.meals_count}</Text>
                <Text style={s.statLabel}>{t('report_meals')}</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statVal}>{tw.nutrition.days_tracked}</Text>
                <Text style={s.statLabel}>{t('report_days_tracked')}</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statVal}>{tw.water.days_tracked}</Text>
                <Text style={s.statLabel}>{t('report_water_days')}</Text>
              </View>
            </View>
          )}

          {/* Section: Nutrition */}
          <Text style={s.sectionTitle}>{t('report_nutrition')}</Text>
          {tw && lw && cmp && (
            <>
              <ComparisonBar label={t('report_calories')} thisVal={tw.nutrition.avg_calories} lastVal={lw.nutrition.avg_calories} unit=" kcal" color="#ff6b6b" change={cmp.calories} />
              <ComparisonBar label={t('report_protein')} thisVal={tw.nutrition.avg_protein} lastVal={lw.nutrition.avg_protein} unit="g" color="#00d4ff" change={cmp.protein} />
              <ComparisonBar label={t('report_carbs')} thisVal={tw.nutrition.avg_carbs} lastVal={lw.nutrition.avg_carbs} unit="g" color="#ffd93d" change={cmp.carbs} />
              <ComparisonBar label={t('report_fat')} thisVal={tw.nutrition.avg_fat} lastVal={lw.nutrition.avg_fat} unit="g" color="#a29bfe" change={cmp.fat} />
            </>
          )}

          {/* Section: Hydration */}
          <Text style={s.sectionTitle}>{t('report_hydration')}</Text>
          {tw && lw && cmp && (
            <ComparisonBar label={t('report_avg_water')} thisVal={tw.water.avg_ml} lastVal={lw.water.avg_ml} unit=" ml" color="#4ecdc4" change={cmp.water} />
          )}

          {/* Section: Routines */}
          <Text style={s.sectionTitle}>{t('report_routines')}</Text>
          {tw && lw && cmp && (
            <ComparisonBar label={t('report_completion')} thisVal={tw.routines.rate} lastVal={lw.routines.rate} unit="%" color="#fd79a8" change={cmp.routines} />
          )}

          {/* Section: Weight */}
          <Text style={s.sectionTitle}>{t('report_weight')}</Text>
          {tw && lw && (
            <View style={s.weightRow}>
              <View style={s.weightCard}>
                <Text style={s.weightCardLabel}>{t('report_this_week')}</Text>
                <Text style={s.weightCardVal}>{tw.weight.avg != null ? `${fmt(tw.weight.avg)} kg` : '—'}</Text>
                <Text style={s.weightCardSub}>{tw.weight.entries} {t('weight_entries')}</Text>
              </View>
              <View style={s.weightCard}>
                <Text style={s.weightCardLabel}>{t('report_last_week')}</Text>
                <Text style={[s.weightCardVal, { color: '#888' }]}>{lw.weight.avg != null ? `${fmt(lw.weight.avg)} kg` : '—'}</Text>
                <Text style={s.weightCardSub}>{lw.weight.entries} {t('weight_entries')}</Text>
              </View>
            </View>
          )}

          {/* Export Section */}
          <Text style={s.sectionTitle}>{t('report_export')}</Text>
          <View style={s.exportRow}>
            <TouchableOpacity style={s.exportBtn} onPress={exportCSV} disabled={exporting !== null}>
              {exporting === 'csv' ? <ActivityIndicator size="small" color="#4ecdc4" /> : (
                <>
                  <Ionicons name="document-text" size={24} color="#4ecdc4" />
                  <Text style={s.exportLabel}>{t('report_csv')}</Text>
                  <Text style={s.exportSub}>{t('report_csv_desc')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.exportBtn} onPress={exportPDF} disabled={exporting !== null}>
              {exporting === 'pdf' ? <ActivityIndicator size="small" color="#ff6b6b" /> : (
                <>
                  <Ionicons name="print" size={24} color="#ff6b6b" />
                  <Text style={s.exportLabel}>{t('report_pdf')}</Text>
                  <Text style={s.exportSub}>{t('report_pdf_desc')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ───────────────────── styles ───────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#080818' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16 },

  // Range banner
  rangeBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, gap: 8 },
  rangePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,212,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  rangeText: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },
  rangeVs: { color: '#444', fontSize: 12, fontWeight: '700' },

  // Quick stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: '#0d0d22', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  statVal: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4, textTransform: 'uppercase' },

  // Section
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 },

  // Bar chart card
  barCard: { backgroundColor: '#0d0d22', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  barLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  barWeekLabel: { width: 36, fontSize: 11, color: '#666', fontWeight: '600' },
  barTrack: { flex: 1, height: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 7, overflow: 'hidden', marginHorizontal: 8 },
  barFill: { height: '100%', borderRadius: 7 },
  barValue: { width: 80, textAlign: 'right', fontSize: 13, fontWeight: '700' },

  // Change tag
  tag: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tagUp: { backgroundColor: 'rgba(0,255,136,0.1)' },
  tagDown: { backgroundColor: 'rgba(255,107,107,0.1)' },
  tagNeutral: { color: '#555', fontSize: 12 },
  tagText: { fontSize: 12, fontWeight: '700' },

  // Weight cards
  weightRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  weightCard: { flex: 1, backgroundColor: '#0d0d22', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  weightCardLabel: { fontSize: 11, color: '#666', textTransform: 'uppercase', fontWeight: '600' },
  weightCardVal: { fontSize: 22, fontWeight: '800', color: '#4ecdc4', marginTop: 6 },
  weightCardSub: { fontSize: 12, color: '#444', marginTop: 4 },

  // Export
  exportRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  exportBtn: { flex: 1, backgroundColor: '#0d0d22', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', minHeight: 100, justifyContent: 'center' },
  exportLabel: { fontSize: 15, fontWeight: '700', color: '#fff', marginTop: 10 },
  exportSub: { fontSize: 11, color: '#666', marginTop: 4, textAlign: 'center' },
});
