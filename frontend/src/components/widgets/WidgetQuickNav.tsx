import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../LanguageContext';

export default function WidgetQuickNav() {
  const router = useRouter();
  const { t } = useLanguage();
  const items = [
    { label: t('dash_molecular'), icon: 'flask', color: '#00ff88', route: '/molecular-engine' },
    { label: t('dash_sequence'), icon: 'git-branch', color: '#ffd93d', route: '/sequence-optimizer' },
    { label: t('dash_recipes'), icon: 'restaurant', color: '#4ecdc4', route: '/recipes' },
    { label: t('dash_ai_coach'), icon: 'sparkles', color: '#fd79a8', route: '/ai-home' },
  ];
  return (
    <View style={s.grid}>
      {items.map(it => (
        <TouchableOpacity key={it.label} style={s.item} onPress={() => router.push(it.route as any)}
          accessibilityRole="button" accessibilityLabel={it.label}>
          <View style={[s.icon, { backgroundColor: it.color + '15' }]}>
            <Ionicons name={it.icon as any} size={24} color={it.color} />
          </View>
          <Text style={s.label}>{it.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 24 },
  item: { width: '25%', alignItems: 'center', marginBottom: 16 },
  icon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  label: { color: '#888', fontSize: 11, marginTop: 6, fontWeight: '500' },
});
