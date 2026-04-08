import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../LanguageContext';
import { clearCacheForKey, CacheKeys } from '../cache';
import FormField from './FormField';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { quickMealSchema } from '../schemas';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Props { visible: boolean; onClose: () => void; onMealLogged: () => void; }

export default function QuickMealModal({ visible, onClose, onMealLogged }: Props) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [unit, setUnit] = useState<'g' | 'ml'>('g');
  const [cooking, setCooking] = useState('raw');
  const [logging, setLogging] = useState(false);

  const { control, handleSubmit, reset, setValue, watch, formState: { errors, touchedFields } } = useForm({
    resolver: zodResolver(quickMealSchema),
    defaultValues: { food_name: '', portion_grams: '100' },
    mode: 'onBlur',
  });
  const portionAmount = watch('portion_grams');

  const getAutoMealType = () => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast'; if (h < 15) return 'lunch'; if (h < 20) return 'dinner'; return 'snack';
  };

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/foods/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: search, page_size: 5 })
      });
      if (res.ok) setResults((await res.json()).foods || []);
    } catch {} finally { setSearching(false); }
  };

  const selectFood = (food: any) => {
    setSelected(food);
    setValue('food_name', food.description || food.fdc_id?.toString() || 'food');
    setValue('portion_grams', '100');
    setUnit('g'); setCooking('raw');
  };

  const confirmLog = async (formData: { food_name: string; portion_grams: string }) => {
    if (!selected) return;
    setLogging(true);
    try {
      const grams = parseFloat(formData.portion_grams);
      const token = await AsyncStorage.getItem('session_token');
      if (!token) { Alert.alert('Error', 'Not logged in'); return; }

      let foodName = selected.description;
      let nutrientData: Record<string, number> = {};
      let elementsData: Record<string, number> = {};
      let allergensList: string[] = [];

      try {
        const res = await fetch(`${BACKEND_URL}/api/foods/analyze`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fdc_id: selected.fdc_id, portion_grams: grams, cooking_method: cooking })
        });
        if (res.ok) {
          const a = await res.json();
          foodName = a.food_name || selected.description;
          nutrientData = cooking !== 'raw' && a.nutrients?.cooked ? a.nutrients.cooked : a.nutrients?.raw || {};
          elementsData = a.elements?.mass_grams || {};
          allergensList = a.allergens || [];
        } else {
          const basic = selected.foodNutrients || [];
          basic.forEach((n: any) => {
            const f = grams / 100;
            if (n.nutrientName?.includes('Energy')) nutrientData['energy_kcal'] = Math.round((n.value || 0) * f * 10) / 10;
            else if (n.nutrientName?.includes('Protein')) nutrientData['protein_g'] = Math.round((n.value || 0) * f * 10) / 10;
            else if (n.nutrientName?.includes('fat') || n.nutrientName?.includes('Fat')) nutrientData['fat_g'] = Math.round((n.value || 0) * f * 10) / 10;
            else if (n.nutrientName?.includes('Carbohydrate')) nutrientData['carbohydrate_g'] = Math.round((n.value || 0) * f * 10) / 10;
          });
        }
      } catch {}

      const mealRes = await fetch(`${BACKEND_URL}/api/meals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          fdc_id: selected.fdc_id, food_name: foodName,
          portion_grams: grams, meal_type: getAutoMealType(), cooking_method: cooking,
          nutrients: nutrientData, elements: elementsData, allergens: allergensList
        })
      });

      if (mealRes.ok) {
        closeAndReset();
        await Promise.all([clearCacheForKey(CacheKeys.dashboard), clearCacheForKey(CacheKeys.mealsToday)]);
        onMealLogged();
        Alert.alert(t('dash_logged'), `${foodName} (${grams}${unit}, ${cooking}) ${t('dash_added_to')} ${getAutoMealType()}`);
      } else {
        const err = await mealRes.json().catch(() => ({}));
        Alert.alert('Error', err.detail || 'Failed to save meal.');
      }
    } catch { Alert.alert('Error', 'Failed to log meal.'); }
    finally { setLogging(false); }
  };

  const closeAndReset = () => {
    setSearch(''); setResults([]); setSelected(null); reset(); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.content}>
          <View style={s.header}>
            <Text style={s.headerTitle}>{selected ? t('dash_customize_meal') : t('dash_quick_add_meal')}</Text>
            <TouchableOpacity onPress={() => { if (selected) setSelected(null); else closeAndReset(); }}>
              <Ionicons name={selected ? 'arrow-back' : 'close'} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {!selected ? (
            <>
              <View style={s.searchRow}>
                <TextInput style={s.searchInput} value={search} onChangeText={setSearch}
                  placeholder={t('dash_search_food')} placeholderTextColor="#666"
                  onSubmitEditing={doSearch} returnKeyType="search" autoFocus />
                <TouchableOpacity style={s.searchBtn} onPress={doSearch}>
                  <Ionicons name="search" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView style={s.scroll}>
                {searching && <Text style={s.searchingText}>Searching...</Text>}
                {results.map((food) => (
                  <TouchableOpacity key={food.fdc_id} style={s.foodRow} onPress={() => selectFood(food)}>
                    <Ionicons name="add-circle" size={22} color="#00d4ff" />
                    <View style={s.foodInfo}>
                      <Text style={s.foodName} numberOfLines={1}>{food.description}</Text>
                      <Text style={s.foodMeta}>{food.data_type} • Tap to customize</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#444" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
              <View style={s.selectedCard}>
                <Ionicons name="restaurant" size={20} color="#4ecdc4" />
                <Text style={s.selectedName} numberOfLines={2}>{selected.description}</Text>
              </View>

              <Text style={s.formLabel}>{t('nutr_portion_label')}</Text>
              <View style={s.portionRow}>
                <Controller control={control} name="portion_grams"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <View style={{ flex: 1 }}>
                      <FormField value={value} onChangeText={onChange} onBlur={onBlur}
                        keyboardType="numeric" placeholder="100"
                        error={errors.portion_grams?.message as string}
                        touched={!!touchedFields.portion_grams || !!errors.portion_grams} />
                    </View>
                  )} />
                <View style={s.unitToggle}>
                  {(['g', 'ml'] as const).map(u => (
                    <TouchableOpacity key={u} style={[s.unitBtn, unit === u && s.unitBtnActive]} onPress={() => setUnit(u)}>
                      <Text style={[s.unitText, unit === u && s.unitTextActive]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <Text style={s.formLabel}>{t('nutr_cooking')}</Text>
              <View style={s.cookGrid}>
                {[
                  { id: 'raw', label: t('nutr_raw'), icon: 'leaf' },
                  { id: 'boiling', label: t('nutr_boiled'), icon: 'water' },
                  { id: 'steaming', label: t('nutr_steamed'), icon: 'cloud' },
                  { id: 'frying', label: t('nutr_fried'), icon: 'flame' },
                  { id: 'baking', label: t('nutr_baked'), icon: 'pizza' },
                  { id: 'grilling', label: t('nutr_grilled'), icon: 'bonfire' },
                ].map(m => (
                  <TouchableOpacity key={m.id} style={[s.cookOpt, cooking === m.id && s.cookOptActive]} onPress={() => setCooking(m.id)}>
                    <Ionicons name={m.icon as any} size={18} color={cooking === m.id ? '#00d4ff' : '#888'} />
                    <Text style={[s.cookLabel, cooking === m.id && s.cookLabelActive]}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.formLabel}>{t('dash_meal_type')}: <Text style={{ color: '#00d4ff' }}>{getAutoMealType()}</Text></Text>

              <TouchableOpacity style={[s.confirmBtn, logging && { opacity: 0.6 }]} onPress={handleSubmit(confirmLog)} disabled={logging}>
                {logging ? <Text style={s.confirmText}>Analyzing & Logging...</Text> : (
                  <><Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={s.confirmText}>Log {portionAmount}{unit} ({cooking})</Text></>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  content: { backgroundColor: '#12122a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  searchRow: { flexDirection: 'row', padding: 16, paddingBottom: 0 },
  searchInput: { flex: 1, backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, color: '#fff', fontSize: 15, marginRight: 8 },
  searchBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, maxHeight: 400 },
  searchingText: { color: '#888', textAlign: 'center', padding: 20 },
  foodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a3e', borderRadius: 12, padding: 14, marginBottom: 8 },
  foodInfo: { flex: 1, marginLeft: 12 },
  foodName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  foodMeta: { color: '#666', fontSize: 11, marginTop: 2 },
  selectedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(78,205,196,0.1)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(78,205,196,0.2)' },
  selectedName: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 10 },
  formLabel: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  portionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  unitToggle: { flexDirection: 'row', backgroundColor: '#1a1a3e', borderRadius: 12, overflow: 'hidden' },
  unitBtn: { paddingHorizontal: 20, paddingVertical: 14 },
  unitBtnActive: { backgroundColor: '#00d4ff' },
  unitText: { color: '#888', fontSize: 16, fontWeight: '700' },
  unitTextActive: { color: '#fff' },
  cookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  cookOpt: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1a1a3e', borderWidth: 1, borderColor: 'transparent' },
  cookOptActive: { borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.1)' },
  cookLabel: { color: '#888', fontSize: 13, fontWeight: '500', marginLeft: 6 },
  cookLabelActive: { color: '#00d4ff' },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00d4ff', borderRadius: 14, paddingVertical: 16, marginTop: 16, marginBottom: 8 },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
});
