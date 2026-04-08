import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '../../ThemeContext';

interface Props { dashboard: any; }

export default function WidgetMacros({ dashboard }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const macros = [
    { label: 'Carbs', val: dashboard?.nutrition?.carbs?.current || 0, color: theme.warning, icon: 'leaf' },
    { label: 'Fat', val: dashboard?.nutrition?.fat?.current || 0, color: theme.orange, icon: 'water' },
    { label: 'Fiber', val: 0, color: theme.teal, icon: 'nutrition' },
  ];
  return (
    <View style={[s.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
      <Text style={[s.title, { color: theme.text }]}>{t('dash_macro_breakdown')}</Text>
      <View style={s.row}>
        {macros.map(m => (
          <View key={m.label} style={s.item}>
            <View style={[s.iconBg, { backgroundColor: m.color + '20' }]}>
              <Ionicons name={m.icon as any} size={18} color={m.color} />
            </View>
            <Text style={[s.val, { color: theme.text }]}>{Math.round(m.val)}g</Text>
            <Text style={[s.label, { color: theme.textDim }]}>{m.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 24, borderRadius: 16, padding: 20, borderWidth: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 16 },
  item: { alignItems: 'center' },
  iconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  val: { fontSize: 18, fontWeight: 'bold', marginTop: 8 },
  label: { fontSize: 11, marginTop: 2 },
});
