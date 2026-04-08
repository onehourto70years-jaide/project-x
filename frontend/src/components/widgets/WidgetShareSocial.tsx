import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';

interface Props { onShareDaily: () => void; onShareWeekly: () => void; onViewBadges: () => void; }

export default function WidgetShareSocial({ onShareDaily, onShareWeekly, onViewBadges }: Props) {
  const { t } = useLanguage();
  return (
    <View style={s.wrap}>
      <Text style={s.title}><Ionicons name="share-social" size={16} color="#a29bfe" /> {t('dash_share_progress')}</Text>
      <View style={s.row}>
        <TouchableOpacity style={s.card} onPress={onShareDaily} accessibilityRole="button" accessibilityLabel={t('dash_daily_report')}>
          <View style={[s.iconBg, { backgroundColor: 'rgba(0,212,255,0.15)' }]}><Ionicons name="today" size={22} color="#00d4ff" /></View>
          <Text style={s.cardLabel}>{t('dash_daily_report')}</Text>
          <Text style={s.cardSub}>{t('dash_share_today_desc')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.card} onPress={onShareWeekly} accessibilityRole="button" accessibilityLabel={t('dash_weekly_report')}>
          <View style={[s.iconBg, { backgroundColor: 'rgba(162,155,254,0.15)' }]}><Ionicons name="calendar" size={22} color="#a29bfe" /></View>
          <Text style={s.cardLabel}>{t('dash_weekly_report')}</Text>
          <Text style={s.cardSub}>{t('dash_share_weekly_desc')}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={s.badgesBtn} onPress={onViewBadges}>
        <Ionicons name="trophy" size={20} color="#ffd93d" />
        <Text style={s.badgesText}>{t('dash_view_badges')}</Text>
        <Ionicons name="arrow-forward" size={16} color="#666" />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginBottom: 24 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: { flex: 1, backgroundColor: '#0d0d22', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  iconBg: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cardLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  cardSub: { color: '#666', fontSize: 11, marginTop: 4, textAlign: 'center' },
  badgesBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,217,61,0.06)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(255,217,61,0.12)' },
  badgesText: { flex: 1, color: '#ffd93d', fontSize: 14, fontWeight: '600', marginLeft: 10 },
});
