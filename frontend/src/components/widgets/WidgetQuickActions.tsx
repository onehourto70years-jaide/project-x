import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';

interface Props {
  onAddWater: (ml: number) => void;
  onLogMeal: () => void;
  onScan: () => void;
}

export default function WidgetQuickActions({ onAddWater, onLogMeal, onScan }: Props) {
  const { t } = useLanguage();
  return (
    <View style={s.row}>
      <TouchableOpacity style={s.btn} onPress={() => onAddWater(250)}
        accessibilityRole="button" accessibilityLabel={`${t('dash_water')}: +250ml`}>
        <View style={s.glow}><Ionicons name="water" size={22} color="#00d4ff" /></View>
        <Text style={s.label}>+250ml</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={() => onAddWater(500)}
        accessibilityRole="button" accessibilityLabel={`${t('dash_water')}: +500ml`}>
        <View style={s.glow}><Ionicons name="water" size={22} color="#0099ff" /></View>
        <Text style={s.label}>+500ml</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={onLogMeal}
        accessibilityRole="button" accessibilityLabel={t('dash_log_meal')}>
        <View style={[s.glow, { backgroundColor: 'rgba(255,107,107,0.15)' }]}><Ionicons name="add-circle" size={22} color="#ff6b6b" /></View>
        <Text style={s.label}>{t('dash_log_meal')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={onScan}
        accessibilityRole="button" accessibilityLabel={t('dash_scan')}>
        <View style={[s.glow, { backgroundColor: 'rgba(255,217,61,0.15)' }]}><Ionicons name="barcode" size={22} color="#ffd93d" /></View>
        <Text style={s.label}>{t('dash_scan')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 16, justifyContent: 'space-between' },
  btn: { alignItems: 'center', flex: 1 },
  glow: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,212,255,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)' },
  label: { color: '#888', fontSize: 11, marginTop: 6, fontWeight: '500' },
});
