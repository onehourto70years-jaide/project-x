import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';

interface Props { meals: any[]; onViewAll: () => void; }

export default function WidgetRecentMeals({ meals, onViewAll }: Props) {
  const { t } = useLanguage();
  if (!meals || meals.length === 0) return null;
  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.title}>{t('dash_recent_meals')}</Text>
        <TouchableOpacity onPress={onViewAll}><Text style={s.seeAll}>{t('dash_view_all')}</Text></TouchableOpacity>
      </View>
      {meals.slice(0, 3).map((meal: any, i: number) => (
        <View key={i} style={s.card}>
          <View style={s.icon}><Ionicons name="restaurant" size={18} color="#4ecdc4" /></View>
          <View style={s.info}>
            <Text style={s.name} numberOfLines={1}>{meal.food_name}</Text>
            <Text style={s.meta}>{meal.portion_grams}g • {meal.cooking_method}</Text>
          </View>
          <Text style={s.cal}>{Math.round(meal.nutrients?.energy_kcal || 0)} kcal</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  seeAll: { color: '#00d4ff', fontSize: 13, fontWeight: '500' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d22', borderRadius: 12, padding: 14, marginTop: 8 },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(78,205,196,0.1)', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12 },
  name: { color: '#fff', fontSize: 14, fontWeight: '500' },
  meta: { color: '#666', fontSize: 11, marginTop: 2 },
  cal: { color: '#ff6b6b', fontSize: 13, fontWeight: '600' },
});
