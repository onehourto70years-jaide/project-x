import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';

interface Props { dashboard: any; }

export default function WidgetMacros({ dashboard }: Props) {
  const { t } = useLanguage();
  const macros = [
    { label: 'Carbs', val: dashboard?.nutrition?.carbs?.current || 0, color: '#ffd93d', icon: 'leaf' },
    { label: 'Fat', val: dashboard?.nutrition?.fat?.current || 0, color: '#ff9f43', icon: 'water' },
    { label: 'Fiber', val: 0, color: '#4ecdc4', icon: 'nutrition' },
  ];
  return (
    <View style={s.card}>
      <Text style={s.title}>{t('dash_macro_breakdown')}</Text>
      <View style={s.row}>
        {macros.map(m => (
          <View key={m.label} style={s.item}>
            <View style={[s.iconBg, { backgroundColor: m.color + '20' }]}>
              <Ionicons name={m.icon as any} size={18} color={m.color} />
            </View>
            <Text style={s.val}>{Math.round(m.val)}g</Text>
            <Text style={s.label}>{m.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 24, backgroundColor: '#0d0d22', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  item: { alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  val: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  label: { fontSize: 11, color: '#666', marginTop: 2 },
});
