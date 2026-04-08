import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '../../ThemeContext';

interface Props { insights: any[]; }

export default function WidgetAIInsights({ insights }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  if (!insights || insights.length === 0) return null;
  return (
    <View style={s.wrap}>
      <Text style={[s.title, { color: theme.text }]}><Ionicons name="sparkles" size={16} color={theme.purple} /> {t('dash_ai_insights')}</Text>
      {insights.slice(0, 3).map((ins: any, i: number) => (
        <View key={i} style={[s.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <View style={[s.dot, { backgroundColor: ins.priority === 'high' ? theme.danger : ins.priority === 'normal' ? theme.warning : theme.teal }]} />
          <View style={s.content}>
            <Text style={[s.cardTitle, { color: theme.text }]}>{ins.title}</Text>
            <Text style={[s.msg, { color: theme.textMuted }]}>{ins.message}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: 24 },
  title: { fontSize: 16, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  content: { marginLeft: 12, flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  msg: { fontSize: 12, marginTop: 2 },
});
