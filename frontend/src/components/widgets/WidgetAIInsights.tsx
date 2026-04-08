import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';

interface Props { insights: any[]; }

export default function WidgetAIInsights({ insights }: Props) {
  const { t } = useLanguage();
  if (!insights || insights.length === 0) return null;
  return (
    <View style={s.wrap}>
      <Text style={s.title}><Ionicons name="sparkles" size={16} color="#a29bfe" /> {t('dash_ai_insights')}</Text>
      {insights.slice(0, 3).map((ins: any, i: number) => (
        <View key={i} style={s.card}>
          <View style={[s.dot, { backgroundColor: ins.priority === 'high' ? '#ff6b6b' : ins.priority === 'normal' ? '#ffd93d' : '#4ecdc4' }]} />
          <View style={s.content}>
            <Text style={s.cardTitle}>{ins.title}</Text>
            <Text style={s.msg}>{ins.message}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 24 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#0d0d22', borderRadius: 12, padding: 14, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  content: { marginLeft: 12, flex: 1 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  msg: { color: '#888', fontSize: 12, marginTop: 2 },
});
