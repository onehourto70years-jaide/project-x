import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useLanguage } from '../../LanguageContext';
import { useTheme } from '../../ThemeContext';
import ProgressRing from '../ProgressRing';

function HealthScore({ score }: { score: number }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const getGrade = () => {
    if (score >= 90) return { grade: 'A+', color: theme.success, msg: t('dash_outstanding') };
    if (score >= 80) return { grade: 'A', color: theme.accent, msg: t('dash_excellent') };
    if (score >= 70) return { grade: 'B+', color: theme.teal, msg: t('dash_great') };
    if (score >= 60) return { grade: 'B', color: theme.warning, msg: t('dash_good_progress') };
    if (score >= 40) return { grade: 'C', color: theme.orange, msg: t('dash_keep_going') };
    return { grade: 'D', color: theme.danger, msg: t('dash_start_tracking') };
  };
  const { grade, color, msg } = getGrade();
  const pulseAnim = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
    ])).start();
  }, []);

  return (
    <View style={s.scoreContainer}>
      <Animated.View style={[s.scoreGlow, { backgroundColor: color + '20', opacity: pulseAnim }]} />
      <ProgressRing size={130} strokeWidth={8} progress={score} colors={[color, color + 'aa']} label="" value={grade} unit={msg} icon="shield-checkmark" />
      <Text style={[s.scoreLabel, { color }]}>{t('dash_score')}</Text>
    </View>
  );
}

interface Props { dashboard: any; }

export default function WidgetHealthScore({ dashboard }: Props) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const calcScore = () => {
    if (!dashboard) return 0;
    const n = dashboard.nutrition || {};
    const h = dashboard.hydration || {};
    const r = dashboard.routines || {};
    const cal = Math.min(n.calories?.percentage || 0, 100);
    const prot = Math.min(n.protein?.percentage || 0, 100);
    const water = Math.min(h.percentage || 0, 100);
    const routine = r.percentage || 0;
    const bonus = Math.min((n.meals_count || 0) * 10, 20);
    return Math.round(cal * 0.25 + prot * 0.25 + water * 0.25 + routine * 0.15 + bonus);
  };

  return (
    <View style={s.hero}>
      <View style={[s.heroGlow, { backgroundColor: `${theme.accent}0f` }]} />
      <HealthScore score={calcScore()} />
      <View style={s.rings}>
        <ProgressRing size={90} strokeWidth={6} progress={dashboard?.nutrition?.calories?.percentage || 0}
          colors={[theme.danger, theme.orange]} label={t('dash_calories')} icon="flame"
          value={`${Math.round(dashboard?.nutrition?.calories?.current || 0)}`}
          unit={`/${dashboard?.nutrition?.calories?.goal || 2000}`} />
        <ProgressRing size={90} strokeWidth={6} progress={dashboard?.hydration?.percentage || 0}
          colors={[theme.accent, '#0099ff']} label={t('dash_water')} icon="water"
          value={`${((dashboard?.hydration?.current_ml || 0) / 1000).toFixed(1)}`}
          unit={`/${((dashboard?.hydration?.goal_ml || 2500) / 1000).toFixed(1)}L`} />
        <ProgressRing size={90} strokeWidth={6} progress={dashboard?.nutrition?.protein?.percentage || 0}
          colors={[theme.success, theme.teal]} label={t('dash_protein')} icon="barbell"
          value={`${Math.round(dashboard?.nutrition?.protein?.current || 0)}`}
          unit={`/${dashboard?.nutrition?.protein?.goal || 50}g`} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: 16, position: 'relative' },
  heroGlow: { position: 'absolute', top: 20, width: 200, height: 200, borderRadius: 100 },
  rings: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', paddingHorizontal: 16, marginTop: 16 },
  scoreContainer: { alignItems: 'center', position: 'relative' },
  scoreGlow: { position: 'absolute', width: 160, height: 160, borderRadius: 80 },
  scoreLabel: { fontSize: 13, fontWeight: '600', marginTop: 4 },
});
