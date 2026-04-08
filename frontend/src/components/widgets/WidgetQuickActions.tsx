import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '../../ThemeContext';

interface Props {
  onAddWater: (ml: number) => void;
  onLogMeal: () => void;
  onScan: () => void;
}

export default function WidgetQuickActions({ onAddWater, onLogMeal, onScan }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  return (
    <View style={s.row}>
      <TouchableOpacity style={s.btn} onPress={() => onAddWater(250)}
        accessibilityRole="button" accessibilityLabel={`${t('dash_water')}: +250ml`}>
        <View style={[s.glow, { backgroundColor: `${theme.accent}24`, borderColor: `${theme.accent}33` }]}><Ionicons name="water" size={22} color={theme.accent} /></View>
        <Text style={[s.label, { color: theme.textMuted }]}>+250ml</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={() => onAddWater(500)}
        accessibilityRole="button" accessibilityLabel={`${t('dash_water')}: +500ml`}>
        <View style={[s.glow, { backgroundColor: `${theme.accent}24`, borderColor: `${theme.accent}33` }]}><Ionicons name="water" size={22} color="#0099ff" /></View>
        <Text style={[s.label, { color: theme.textMuted }]}>+500ml</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={onLogMeal}
        accessibilityRole="button" accessibilityLabel={t('dash_log_meal')}>
        <View style={[s.glow, { backgroundColor: `${theme.danger}24`, borderColor: `${theme.danger}33` }]}><Ionicons name="add-circle" size={22} color={theme.danger} /></View>
        <Text style={[s.label, { color: theme.textMuted }]}>{t('dash_log_meal')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={onScan}
        accessibilityRole="button" accessibilityLabel={t('dash_scan')}>
        <View style={[s.glow, { backgroundColor: `${theme.warning}24`, borderColor: `${theme.warning}33` }]}><Ionicons name="barcode" size={22} color={theme.warning} /></View>
        <Text style={[s.label, { color: theme.textMuted }]}>{t('dash_scan')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, justifyContent: 'space-between' },
  btn: { alignItems: 'center', flex: 1 },
  glow: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  label: { fontSize: 11, marginTop: 6, fontWeight: '500' },
});
