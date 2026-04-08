import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, TextInput, Animated, PanResponder, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';
import { useTheme, ThemeColors } from '../../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCacheForKey, CacheKeys } from '../../cache';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const SWIPE_THRESHOLD = -80;

interface Meal { id?: string; food_name: string; portion_grams: number; cooking_method: string; meal_type?: string; nutrients?: Record<string, number>; }
interface Props { meals: Meal[]; onViewAll: () => void; onRefresh: () => void; }

function MealRow({ meal, onEdit, onDelete }: { meal: Meal; onEdit: () => void; onDelete: () => void }) {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => { if (g.dx < 0) { translateX.setValue(Math.max(g.dx, -120)); deleteOpacity.setValue(Math.min(Math.abs(g.dx) / 80, 1)); } },
      onPanResponderRelease: (_, g) => {
        if (g.dx < SWIPE_THRESHOLD) { Animated.spring(translateX, { toValue: -100, useNativeDriver: true }).start(); }
        else { Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(); Animated.timing(deleteOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(); }
      },
    })
  ).current;
  const closeSwipe = () => { Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(); Animated.timing(deleteOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(); };
  const handleDelete = () => { Alert.alert('Delete Meal', `Remove "${meal.food_name}" from your log?`, [{ text: 'Cancel', style: 'cancel', onPress: closeSwipe }, { text: 'Delete', style: 'destructive', onPress: () => { closeSwipe(); onDelete(); } }]); };

  return (
    <View style={s.rowWrap}>
      <Animated.View style={[s.deleteAction, { opacity: deleteOpacity }]}>
        <TouchableOpacity style={s.deleteBtnInner} onPress={handleDelete}>
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={s.deleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
      <Animated.View style={[s.card, { backgroundColor: theme.bgSecondary, transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <TouchableOpacity style={s.cardInner} onPress={onEdit} activeOpacity={0.7}>
          <View style={[s.icon, { backgroundColor: `${theme.teal}18` }]}><Ionicons name="restaurant" size={18} color={theme.teal} /></View>
          <View style={s.info}>
            <Text style={[s.name, { color: theme.text }]} numberOfLines={1}>{meal.food_name}</Text>
            <Text style={[s.meta, { color: theme.textDim }]}>{meal.portion_grams}g · {meal.cooking_method}{meal.meal_type ? ` · ${meal.meal_type}` : ''}</Text>
          </View>
          <View style={s.right}>
            <Text style={[s.cal, { color: theme.danger }]}>{Math.round(meal.nutrients?.energy_kcal || 0)} kcal</Text>
            <Ionicons name="chevron-forward" size={14} color={theme.textDim} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function EditMealModal({ meal, visible, onClose, onSave }: { meal: Meal | null; visible: boolean; onClose: () => void; onSave: (data: { portion_grams: number; cooking_method: string; meal_type: string }) => void }) {
  const [portion, setPortion] = useState('');
  const [cooking, setCooking] = useState('raw');
  const [mealType, setMealType] = useState('lunch');
  const { t } = useLanguage();
  const { theme } = useTheme();
  React.useEffect(() => { if (meal && visible) { setPortion(String(meal.portion_grams || 100)); setCooking(meal.cooking_method || 'raw'); setMealType(meal.meal_type || 'lunch'); } }, [meal, visible]);
  if (!meal) return null;
  const COOKING = [{ id: 'raw', label: t('nutr_raw'), icon: 'leaf' }, { id: 'boiling', label: t('nutr_boiled'), icon: 'water' }, { id: 'steaming', label: t('nutr_steamed'), icon: 'cloud' }, { id: 'frying', label: t('nutr_fried'), icon: 'flame' }, { id: 'baking', label: t('nutr_baked'), icon: 'pizza' }, { id: 'grilling', label: t('nutr_grilled'), icon: 'bonfire' }];
  const TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={[s.modalContent, { backgroundColor: theme.bgCard }]}>
          <View style={[s.modalHeader, { borderBottomColor: theme.bgInput }]}>
            <Text style={[s.modalTitle, { color: theme.text }]}>Edit Meal</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
          </View>
          <View style={[s.mealPreview, { backgroundColor: `${theme.teal}12`, borderColor: `${theme.teal}24` }]}>
            <Ionicons name="restaurant" size={20} color={theme.teal} />
            <Text style={[s.mealPreviewName, { color: theme.text }]} numberOfLines={2}>{meal.food_name}</Text>
          </View>
          <Text style={[s.label, { color: theme.textMuted }]}>Portion (grams)</Text>
          <TextInput style={[s.input, { backgroundColor: theme.bgInput, color: theme.text, borderColor: theme.border }]} value={portion} onChangeText={setPortion} keyboardType="numeric" placeholder="100" placeholderTextColor={theme.textDim} />
          <Text style={[s.label, { color: theme.textMuted }]}>Cooking Method</Text>
          <View style={s.chipGrid}>
            {COOKING.map(c => (
              <TouchableOpacity key={c.id} style={[s.chip, { backgroundColor: theme.bgInput }, cooking === c.id && { borderColor: theme.accent, backgroundColor: `${theme.accent}18` }]} onPress={() => setCooking(c.id)}>
                <Ionicons name={c.icon as any} size={14} color={cooking === c.id ? theme.accent : theme.textDim} />
                <Text style={[s.chipText, { color: theme.textDim }, cooking === c.id && { color: theme.accent }]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.label, { color: theme.textMuted }]}>Meal Type</Text>
          <View style={s.chipGrid}>
            {TYPES.map(mt => (
              <TouchableOpacity key={mt} style={[s.chip, { backgroundColor: theme.bgInput }, mealType === mt && { borderColor: theme.accent, backgroundColor: `${theme.accent}18` }]} onPress={() => setMealType(mt)}>
                <Text style={[s.chipText, { color: theme.textDim }, mealType === mt && { color: theme.accent }]}>{mt.charAt(0).toUpperCase() + mt.slice(1)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[s.saveBtn, { backgroundColor: theme.accent }]} onPress={() => { const grams = parseFloat(portion); if (!grams || grams <= 0) { Alert.alert('Error', 'Enter a valid portion'); return; } onSave({ portion_grams: grams, cooking_method: cooking, meal_type: mealType }); }}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={s.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function WidgetRecentMeals({ meals, onViewAll, onRefresh }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  if (!meals || meals.length === 0) return null;
  const deleteMeal = async (mealId: string) => { try { const token = await AsyncStorage.getItem('session_token'); if (!token) return; const res = await fetch(`${BACKEND_URL}/api/meals/${mealId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); if (res.ok) { await Promise.all([clearCacheForKey(CacheKeys.dashboard), clearCacheForKey(CacheKeys.mealsToday)]); onRefresh(); } } catch (e) { console.error('Delete meal error:', e); } };
  const updateMeal = async (data: { portion_grams: number; cooking_method: string; meal_type: string }) => { if (!editMeal?.id) return; try { const token = await AsyncStorage.getItem('session_token'); if (!token) return; const res = await fetch(`${BACKEND_URL}/api/meals/${editMeal.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(data) }); if (res.ok) { setShowEdit(false); setEditMeal(null); await Promise.all([clearCacheForKey(CacheKeys.dashboard), clearCacheForKey(CacheKeys.mealsToday)]); onRefresh(); } else { Alert.alert('Error', 'Failed to update meal'); } } catch (e) { Alert.alert('Error', 'Network error'); } };
  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={[s.title, { color: theme.text }]}>{t('dash_recent_meals')}</Text>
        <TouchableOpacity onPress={onViewAll}><Text style={[s.seeAll, { color: theme.accent }]}>{t('dash_view_all')}</Text></TouchableOpacity>
      </View>
      <Text style={[s.hint, { color: theme.textDim }]}>Swipe left to delete · Tap to edit</Text>
      {meals.slice(0, 3).map((meal, i) => (<MealRow key={meal.id || i} meal={meal} onEdit={() => { setEditMeal(meal); setShowEdit(true); }} onDelete={() => meal.id && deleteMeal(meal.id)} />))}
      <EditMealModal meal={editMeal} visible={showEdit} onClose={() => { setShowEdit(false); setEditMeal(null); }} onSave={updateMeal} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700' },
  seeAll: { fontSize: 13, fontWeight: '500' },
  hint: { fontSize: 11, marginBottom: 8, fontStyle: 'italic' },
  rowWrap: { position: 'relative', marginTop: 8, borderRadius: 12, overflow: 'hidden' },
  deleteAction: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, backgroundColor: '#ff3b30', justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  deleteBtnInner: { alignItems: 'center', gap: 4 },
  deleteText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  card: { borderRadius: 12 },
  cardInner: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  icon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 14, fontWeight: '500' },
  meta: { fontSize: 11, marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  cal: { fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, paddingBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  mealPreview: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 20, gap: 10, borderWidth: 1 },
  mealPreviewName: { flex: 1, fontSize: 15, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 12 },
  input: { borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  chipText: { fontSize: 13, fontWeight: '500' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 16, marginTop: 24, gap: 8 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
