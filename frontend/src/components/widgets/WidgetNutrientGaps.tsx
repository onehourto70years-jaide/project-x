import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '../../ThemeContext';
import NutrientGapAlerts from '../NutrientGapAlerts';

interface Props { nutrients: any; }

export default function WidgetNutrientGaps({ nutrients }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={[s.title, { color: theme.text }]}><Ionicons name="pulse" size={16} color={theme.warning} /> {t('dash_nutrient_gaps')}</Text>
      </View>
      <NutrientGapAlerts nutrients={nutrients || {}} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700' },
});
