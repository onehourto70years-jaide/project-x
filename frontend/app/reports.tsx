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
import { SkeletonReports } from '../src/components/Skeleton';
import EmptyState from '../src/components/EmptyState';

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

  /* ───── CSV Export (Full 72+ Nutrients) ───── */
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

      const nutrientCols = raw.nutrient_columns || [];

      // ═══ SHEET 1: Meals with Full Nutrients ═══
      const mealHeader = ['Date', 'Food', 'Meal Type', 'Portion (g)', 'Cooking Method', ...nutrientCols.map((k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))];
      let csv = '=== MEALS (Full Nutrient Profile) ===\n';
      csv += mealHeader.join(',') + '\n';
      (raw.meals || []).forEach((m: any) => {
        const row = [
          m.date,
          `"${(m.food_name || '').replace(/"/g, '""')}"`,
          m.meal_type || '',
          m.portion_grams || '',
          m.cooking_method || 'raw',
          ...nutrientCols.map((k: string) => m.nutrients?.[k] != null ? Number(m.nutrients[k]).toFixed(2) : '')
        ];
        csv += row.join(',') + '\n';
      });

      // ═══ SHEET 2: Daily Summaries with Aggregated Nutrients ═══
      csv += '\n=== DAILY NUTRIENT SUMMARIES ===\n';
      csv += ['Date', 'Total Calories', 'Meals Count', ...nutrientCols.map((k: string) => k.replace(/_/g, ' '))].join(',') + '\n';
      (raw.daily_summaries || []).forEach((d: any) => {
        const row = [
          d.date,
          d.total_calories || 0,
          d.meals_count || 0,
          ...nutrientCols.map((k: string) => d.nutrients?.[k] != null ? Number(d.nutrients[k]).toFixed(2) : '')
        ];
        csv += row.join(',') + '\n';
      });

      // ═══ SHEET 3: Water Intake ═══
      csv += '\n=== WATER INTAKE ===\n';
      csv += 'Date,Total (ml),Entries\n';
      (raw.water || []).forEach((w: any) => {
        csv += `${w.date},${w.total_ml},${w.entries}\n`;
      });

      // ═══ SHEET 4: Weight Log ═══
      csv += '\n=== WEIGHT LOG ===\n';
      csv += 'Date,Weight (kg),Note\n';
      (raw.weight || []).forEach((w: any) => {
        csv += `${w.date},${w.weight_kg},"${(w.note || '').replace(/"/g, '""')}"\n`;
      });

      // ═══ GDPR Notice ═══
      csv += `\n=== GDPR NOTICE ===\n`;
      csv += `Exported: ${raw.exported_at}\n`;
      csv += `Period: ${raw.data_period?.from} to ${raw.data_period?.to}\n`;
      csv += `${raw.gdpr_notice || ''}\n`;

      const fileUri = FileSystem.cacheDirectory + 'NutriOS_Full_Export.csv';
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
        hapticSuccess();
        await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Export NutriOS Full Data' });
      } else {
        Alert.alert('Saved', `File saved to ${fileUri}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to export CSV');
    } finally {
      setExporting(null);
    }
  };

  /* ───── PDF Export (Full 72+ Nutrients Report) ───── */
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

      const nutrientCols = raw.nutrient_columns || [];

      // Group nutrients by category for the PDF
      const categories: Record<string, string[]> = {
        'Macronutrients': nutrientCols.filter((k: string) => ['protein_g','carbohydrate_g','fat_g','fiber_g','water_g','sugars_g','energy_kcal'].includes(k)),
        'Fats': nutrientCols.filter((k: string) => k.includes('saturated') || k.includes('monounsaturated') || k.includes('polyunsaturated') || k.includes('trans_fat') || k.includes('cholesterol')),
        'Omega Fatty Acids': nutrientCols.filter((k: string) => k.includes('omega')),
        'Vitamins': nutrientCols.filter((k: string) => k.includes('vitamin') || k.includes('folate')),
        'Minerals': nutrientCols.filter((k: string) => ['calcium_mg','iron_mg','magnesium_mg','phosphorus_mg','potassium_mg','sodium_mg','zinc_mg','copper_mg','manganese_mg','selenium_mcg','fluoride_mcg','choline_mg','salt_g'].includes(k)),
        'Amino Acids': nutrientCols.filter((k: string) => ['leucine_mg','lysine_mg','tryptophan_mg','valine_mg','histidine_mg','isoleucine_mg','methionine_mg','phenylalanine_mg','threonine_mg','arginine_mg','cystine_mg','tyrosine_mg','glycine_mg','proline_mg'].includes(k)),
        'Carotenoids': nutrientCols.filter((k: string) => k.includes('carotene') || k.includes('lycopene') || k.includes('lutein')),
      };

      // Format nutrient key for display
      const fmtKey = (k: string) => k.replace(/_g$/, ' (g)').replace(/_mg$/, ' (mg)').replace(/_mcg$/, ' (µg)').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

      // Build meal detail rows (first 200)
      const mealRows = (raw.meals || []).slice(0, 200).map((m: any) =>
        `<tr><td>${m.date}</td><td>${m.food_name || ''}</td><td>${m.meal_type || ''}</td><td>${m.portion_grams || ''}g</td><td>${m.nutrients?.energy_kcal?.toFixed(0) || 0}</td><td>${m.nutrients?.protein_g?.toFixed(1) || 0}</td><td>${m.nutrients?.fat_g?.toFixed(1) || 0}</td><td>${m.nutrients?.carbohydrate_g?.toFixed(1) || 0}</td><td>${m.nutrients?.fiber_g?.toFixed(1) || 0}</td></tr>`
      ).join('');

      // Build daily nutrient summary table (grouped by category)
      let nutrientSections = '';
      const summaries = raw.daily_summaries || [];
      if (summaries.length > 0) {
        // Calculate averages across all days
        const avgNutrients: Record<string, number> = {};
        let daysWithData = 0;
        summaries.forEach((s: any) => {
          if (s.nutrients && Object.keys(s.nutrients).length > 0) {
            daysWithData++;
            Object.entries(s.nutrients).forEach(([k, v]: [string, any]) => {
              avgNutrients[k] = (avgNutrients[k] || 0) + (Number(v) || 0);
            });
          }
        });
        if (daysWithData > 0) {
          Object.keys(avgNutrients).forEach(k => { avgNutrients[k] = avgNutrients[k] / daysWithData; });
        }

        Object.entries(categories).forEach(([catName, keys]) => {
          const relevantKeys = keys.filter((k: string) => avgNutrients[k] > 0);
          if (relevantKeys.length === 0) return;
          nutrientSections += `<h3 style="color:#0984e3;margin-top:20px;">${catName}</h3>`;
          nutrientSections += '<table><tr><th>Nutrient</th><th>Daily Avg</th><th>Total (period)</th></tr>';
          relevantKeys.forEach((k: string) => {
            const total = avgNutrients[k] * daysWithData;
            nutrientSections += `<tr><td>${fmtKey(k)}</td><td>${avgNutrients[k].toFixed(2)}</td><td>${total.toFixed(1)}</td></tr>`;
          });
          nutrientSections += '</table>';
        });
      }

      const waterRows = (raw.water || []).map((w: any) =>
        `<tr><td>${w.date}</td><td>${w.total_ml} ml</td><td>${w.entries}</td></tr>`
      ).join('');
      const weightRows = (raw.weight || []).map((w: any) =>
        `<tr><td>${w.date}</td><td>${w.weight_kg} kg</td><td>${w.note || ''}</td></tr>`
      ).join('');

      const html = `
      <html><head><meta charset="UTF-8"/>
      <style>
        body{font-family:Helvetica,Arial,sans-serif;padding:20px;color:#222;font-size:11px;}
        h1{color:#00d4ff;border-bottom:2px solid #00d4ff;padding-bottom:8px;font-size:22px;}
        h2{color:#4ecdc4;margin-top:30px;font-size:16px;}
        h3{font-size:13px;margin-bottom:5px;}
        table{width:100%;border-collapse:collapse;margin-top:8px;margin-bottom:16px;font-size:10px;}
        th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;}
        th{background:#f0f7ff;font-weight:bold;}
        tr:nth-child(even){background:#fafafa;}
        .meta{color:#666;font-size:12px;margin-bottom:20px;}
        .stats{display:flex;gap:20px;margin:15px 0;}
        .stat-box{background:#f8f9fa;border-radius:8px;padding:12px;border:1px solid #e0e0e0;text-align:center;flex:1;}
        .stat-val{font-size:18px;font-weight:bold;color:#00d4ff;}
        .stat-label{font-size:9px;color:#666;margin-top:4px;}
        .footer{text-align:center;color:#aaa;font-size:9px;margin-top:40px;border-top:1px solid #eee;padding-top:10px;}
        .gdpr{background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:10px;margin-top:20px;font-size:10px;color:#856404;}
      </style></head><body>
        <h1>NutriOS Complete Health Report</h1>
        <p class="meta">Period: ${raw.data_period?.from || ''} → ${raw.data_period?.to || ''} &bull; ${raw.user_email || ''}</p>

        <div class="stats">
          <div class="stat-box"><div class="stat-val">${(raw.meals || []).length}</div><div class="stat-label">Meals Logged</div></div>
          <div class="stat-box"><div class="stat-val">${summaries.length}</div><div class="stat-label">Days Tracked</div></div>
          <div class="stat-box"><div class="stat-val">${nutrientCols.length}</div><div class="stat-label">Nutrients Tracked</div></div>
          <div class="stat-box"><div class="stat-val">${(raw.water || []).length}</div><div class="stat-label">Water Days</div></div>
        </div>

        <h2>📊 Nutrient Analysis (Daily Averages)</h2>
        ${nutrientSections || '<p style="color:#999">No nutrient data available yet. Log meals to see your data.</p>'}

        <h2>🍽️ Meals Log (${(raw.meals || []).length} entries)</h2>
        <table><tr><th>Date</th><th>Food</th><th>Type</th><th>Portion</th><th>Cal</th><th>Prot(g)</th><th>Fat(g)</th><th>Carb(g)</th><th>Fiber(g)</th></tr>${mealRows}</table>

        <h2>💧 Water Intake</h2>
        <table><tr><th>Date</th><th>Total</th><th>Entries</th></tr>${waterRows}</table>

        ${weightRows ? `<h2>⚖️ Weight Log</h2><table><tr><th>Date</th><th>Weight</th><th>Note</th></tr>${weightRows}</table>` : ''}

        <div class="gdpr">
          <strong>GDPR Notice:</strong> ${raw.gdpr_notice || 'This export contains all personal health data stored by NutriOS. You may request deletion at any time.'}
        </div>
        <div class="footer">Generated by NutriOS v4.0 &bull; ${new Date().toISOString()} &bull; For personal and medical use only</div>
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
        <TouchableOpacity onPress={() => { hapticLight(); router.back(); }} style={s.back}
          accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title} accessibilityRole="header">{t('report_title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <SkeletonReports />
      ) : !data || (!data.this_week?.meals_count && !data.last_week?.meals_count) ? (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <EmptyState
            icon="analytics-outline"
            iconColor="#4ecdc4"
            title="No Reports Yet"
            subtitle="Start logging your meals, water, and routines to unlock weekly comparison reports and exportable health summaries."
            ctaLabel="Log Your First Meal"
            onCta={() => router.push('/(tabs)/search')}
          />
        </ScrollView>
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
            <TouchableOpacity style={s.exportBtn} onPress={exportCSV} disabled={exporting !== null}
              accessibilityRole="button" accessibilityLabel={t('report_csv')} accessibilityHint={t('report_csv_desc')} accessibilityState={{ disabled: exporting !== null }}>
              {exporting === 'csv' ? <ActivityIndicator size="small" color="#4ecdc4" /> : (
                <>
                  <Ionicons name="document-text" size={24} color="#4ecdc4" />
                  <Text style={s.exportLabel}>{t('report_csv')}</Text>
                  <Text style={s.exportSub}>{t('report_csv_desc')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.exportBtn} onPress={exportPDF} disabled={exporting !== null}
              accessibilityRole="button" accessibilityLabel={t('report_pdf')} accessibilityHint={t('report_pdf_desc')} accessibilityState={{ disabled: exporting !== null }}>
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
