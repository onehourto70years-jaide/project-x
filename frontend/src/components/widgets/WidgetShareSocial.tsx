import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '../../ThemeContext';

interface Props { onShareDaily: () => void; onShareWeekly: () => void; onViewBadges: () => void; }

export default function WidgetShareSocial({ onShareDaily, onShareWeekly, onViewBadges }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  return (
    <View style={s.wrap}>
      <Text style={[s.title, { color: theme.text }]}><Ionicons name="share-social" size={16} color={theme.purple} /> {t('dash_share_progress')}</Text>
      <View style={s.row}>
        <TouchableOpacity style={[s.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]} onPress={onShareDaily} accessibilityRole="button" accessibilityLabel={t('dash_daily_report')}>
          <View style={[s.iconBg, { backgroundColor: `${theme.accent}24` }]}><Ionicons name="today" size={22} color={theme.accent} /></View>
          <Text style={[s.cardLabel, { color: theme.text }]}>{t('dash_daily_report')}</Text>
          <Text style={[s.cardSub, { color: theme.textDim }]}>{t('dash_share_today_desc')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.card, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]} onPress={onShareWeekly} accessibilityRole="button" accessibilityLabel={t('dash_weekly_report')}>
          <View style={[s.iconBg, { backgroundColor: `${theme.purple}24` }]}><Ionicons name="calendar" size={22} color={theme.purple} /></View>
          <Text style={[s.cardLabel, { color: theme.text }]}>{t('dash_weekly_report')}</Text>
          <Text style={[s.cardSub, { color: theme.textDim }]}>{t('dash_share_weekly_desc')}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[s.badgesBtn, { backgroundColor: `${theme.warning}0f`, borderColor: `${theme.warning}1e` }]} onPress={onViewBadges}>
        <Ionicons name="trophy" size={20} color={theme.warning} />
        <Text style={[s.badgesText, { color: theme.warning }]}>{t('dash_view_badges')}</Text>
        <Ionicons name="arrow-forward" size={16} color={theme.textDim} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginBottom: 24 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1 },
  iconBg: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardLabel: { fontSize: 14, fontWeight: '600' },
  cardSub: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  badgesBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1 },
  badgesText: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 10 },
});
