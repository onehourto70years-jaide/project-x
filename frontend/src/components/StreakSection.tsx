import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../LanguageContext';
import { useTheme } from '../ThemeContext';

const MILESTONES = [
  { days: 3, icon: 'flame', label: '3-Day', color: '#ff9f43' },
  { days: 7, icon: 'trophy', label: '1 Week', color: '#ffd93d' },
  { days: 14, icon: 'star', label: '2 Weeks', color: '#00d4ff' },
  { days: 30, icon: 'diamond', label: '1 Month', color: '#a29bfe' },
  { days: 60, icon: 'ribbon', label: '2 Months', color: '#fd79a8' },
  { days: 100, icon: 'planet', label: '100 Days', color: '#00ff88' },
];

interface StreakData { streakDays: number; mealsToday: number; routinesCompleted: number; routinesTotal: number; }

function AnimatedFlame({ streakDays }: { streakDays: number }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 600, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 700, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 0.8, duration: 1200, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
    ])).start();
    Animated.spring(bounceAnim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }).start();
  }, []);
  const flameColor = streakDays >= 30 ? '#ff6b6b' : streakDays >= 7 ? '#ff9f43' : '#ffd93d';
  const flameSize = Math.min(44 + streakDays * 0.5, 60);
  return (
    <Animated.View style={[s.flameContainer, { transform: [{ scale: bounceAnim }] }]}>
      <Animated.View style={[s.flameGlowOuter, { opacity: glowAnim, backgroundColor: flameColor + '15' }]} />
      <Animated.View style={[s.flameGlowInner, { opacity: glowAnim, backgroundColor: flameColor + '25' }]} />
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons name="flame" size={flameSize} color={flameColor} />
      </Animated.View>
    </Animated.View>
  );
}

function CalendarDayItem({ day, index, isActive, isToday }: { day: string; index: number; isActive: boolean; isToday: boolean }) {
  const { theme } = useTheme();
  const dotAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(dotAnim, { toValue: 1, delay: index * 60, tension: 80, friction: 8, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[s.calendarDay, { transform: [{ scale: dotAnim }] }]}>
      <Text style={[s.calendarDayLabel, { color: theme.textDim }, isToday && { color: theme.accent }]}>{day}</Text>
      <View style={[s.calendarDot, { backgroundColor: theme.bgInput }, isActive && s.calendarDotActive, isToday && { borderWidth: 2, borderColor: theme.accent }]}>
        {isActive && <Ionicons name="checkmark" size={10} color="#fff" />}
      </View>
    </Animated.View>
  );
}

function StreakCalendar({ streakDays }: { streakDays: number }) {
  const { theme } = useTheme();
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date().getDay();
  const adjustedToday = today === 0 ? 6 : today - 1;
  return (
    <View style={[s.calendarRow, { backgroundColor: `${theme.text}06` }]}>
      {days.map((day, i) => {
        const daysAgo = adjustedToday - i;
        const isActive = daysAgo >= 0 && daysAgo < streakDays;
        return <CalendarDayItem key={i} day={day} index={i} isActive={isActive} isToday={i === adjustedToday} />;
      })}
    </View>
  );
}

function MilestoneTrack({ streakDays }: { streakDays: number }) {
  const { theme } = useTheme();
  const nextMilestone = MILESTONES.find(m => m.days > streakDays) || MILESTONES[MILESTONES.length - 1];
  const prevMilestone = [...MILESTONES].reverse().find(m => m.days <= streakDays);
  const prevDays = prevMilestone ? prevMilestone.days : 0;
  const progressToNext = nextMilestone ? ((streakDays - prevDays) / (nextMilestone.days - prevDays)) * 100 : 100;
  const fillAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fillAnim, { toValue: progressToNext, duration: 1000, useNativeDriver: false }).start(); }, [progressToNext]);
  return (
    <View>
      <View style={{ position: 'relative' }}>
        <View style={[s.milestoneTrackBg, { backgroundColor: theme.bgInput }]}>
          <Animated.View style={[s.milestoneTrackFill, { width: fillAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <View style={s.milestoneDots}>
          {MILESTONES.slice(0, 4).map((m) => {
            const reached = streakDays >= m.days;
            return (
              <View key={m.days} style={s.milestoneItem}>
                <View style={[s.milestoneDot, { backgroundColor: theme.bgInput, borderColor: theme.borderLight }, reached && { backgroundColor: m.color, borderColor: m.color + '60' }]}>
                  <Ionicons name={m.icon as any} size={12} color={reached ? '#fff' : theme.textDim} />
                </View>
                <Text style={[s.milestoneLabel, { color: theme.textDim }, reached && { color: m.color }]}>{m.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
      {nextMilestone && streakDays < nextMilestone.days && (
        <View style={s.nextMilestone}>
          <Ionicons name="flag" size={14} color={nextMilestone.color} />
          <Text style={[s.nextMilestoneText, { color: theme.textMuted }]}>
            <Text style={{ color: nextMilestone.color, fontWeight: '700' }}>{nextMilestone.days - streakDays}</Text> days to {nextMilestone.label}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function StreakSection({ data }: { data: StreakData }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const containerAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(containerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[s.container, { opacity: containerAnim, transform: [{ translateY: containerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      <View style={[s.mainCard, { backgroundColor: theme.bgSecondary, borderColor: `${theme.danger}1e` }]}>
        <View style={[s.mainCardGlow, { backgroundColor: `${theme.danger}0a` }]} />
        <View style={s.flameRow}>
          <AnimatedFlame streakDays={data.streakDays} />
          <View style={{ marginLeft: 16 }}>
            <Text style={[s.streakNumber, { color: theme.text }]}>{data.streakDays}</Text>
            <Text style={[s.streakDaysLabel, { color: theme.textMuted }]}>{t('dash_day_streak')}</Text>
          </View>
        </View>
        <StreakCalendar streakDays={data.streakDays} />
        <MilestoneTrack streakDays={data.streakDays} />
      </View>
      <View style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <View style={[s.statIconBg, { backgroundColor: `${theme.teal}1e` }]}><Ionicons name="restaurant" size={20} color={theme.teal} /></View>
          <Text style={[s.statValue, { color: theme.text }]}>{data.mealsToday}</Text>
          <Text style={[s.statLabel, { color: theme.textDim }]}>{t('dash_meals_today')}</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <View style={[s.statIconBg, { backgroundColor: `${theme.purple}1e` }]}><Ionicons name="checkmark-done" size={20} color={theme.purple} /></View>
          <Text style={[s.statValue, { color: theme.text }]}>{data.routinesCompleted}/{data.routinesTotal}</Text>
          <Text style={[s.statLabel, { color: theme.textDim }]}>{t('dash_routines')}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: { paddingHorizontal: 16, marginTop: 24 },
  mainCard: { borderRadius: 20, padding: 20, borderWidth: 1, overflow: 'hidden' },
  mainCardGlow: { position: 'absolute', top: -50, right: -30, width: 140, height: 140, borderRadius: 70 },
  flameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  flameContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  flameGlowOuter: { position: 'absolute', width: 80, height: 80, borderRadius: 40 },
  flameGlowInner: { position: 'absolute', width: 56, height: 56, borderRadius: 28 },
  streakNumber: { fontSize: 42, fontWeight: '900', lineHeight: 48 },
  streakDaysLabel: { fontSize: 14, fontWeight: '500' },
  calendarRow: { flexDirection: 'row', justifyContent: 'space-around', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, marginBottom: 16 },
  calendarDay: { alignItems: 'center', gap: 6 },
  calendarDayLabel: { fontSize: 11, fontWeight: '600' },
  calendarDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  calendarDotActive: { backgroundColor: '#ff6b6b' },
  milestoneTrackBg: { position: 'absolute', top: 17, left: 20, right: 20, height: 3, borderRadius: 2, overflow: 'hidden' },
  milestoneTrackFill: { height: '100%', backgroundColor: '#ff6b6b', borderRadius: 2 },
  milestoneDots: { flexDirection: 'row', justifyContent: 'space-around' },
  milestoneItem: { alignItems: 'center' },
  milestoneDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  milestoneLabel: { fontSize: 10, fontWeight: '600' },
  nextMilestone: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 6 },
  nextMilestoneText: { fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1 },
  statIconBg: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 4, fontWeight: '500' },
});
