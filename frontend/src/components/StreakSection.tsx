import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StreakData {
  streakDays: number;
  mealsToday: number;
  routinesCompleted: number;
  routinesTotal: number;
}

// Milestone definitions
const MILESTONES = [
  { days: 3, icon: 'flame', label: '3-Day', color: '#ff9f43' },
  { days: 7, icon: 'trophy', label: '1 Week', color: '#ffd93d' },
  { days: 14, icon: 'star', label: '2 Weeks', color: '#00d4ff' },
  { days: 30, icon: 'diamond', label: '1 Month', color: '#a29bfe' },
  { days: 60, icon: 'ribbon', label: '2 Months', color: '#fd79a8' },
  { days: 100, icon: 'planet', label: '100 Days', color: '#00ff88' },
];

function AnimatedFlame({ streakDays }: { streakDays: number }) {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fire pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.95, duration: 600, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.9, duration: 700, useNativeDriver: true }),
      ])
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.8, duration: 1200, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    // Entrance bounce
    Animated.spring(bounceAnim, {
      toValue: 1,
      tension: 50,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, []);

  const flameColor = streakDays >= 30 ? '#ff6b6b' : streakDays >= 7 ? '#ff9f43' : '#ffd93d';
  const flameSize = Math.min(44 + streakDays * 0.5, 60);

  return (
    <Animated.View style={[styles.flameContainer, { transform: [{ scale: bounceAnim }] }]}>
      {/* Outer glow */}
      <Animated.View style={[styles.flameGlowOuter, { opacity: glowAnim, backgroundColor: flameColor + '15' }]} />
      {/* Inner glow */}
      <Animated.View style={[styles.flameGlowInner, { opacity: glowAnim, backgroundColor: flameColor + '25' }]} />
      {/* Flame icon */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons name="flame" size={flameSize} color={flameColor} />
      </Animated.View>
    </Animated.View>
  );
}

function CalendarDayItem({ day, index, isActive, isToday }: { day: string; index: number; isActive: boolean; isToday: boolean }) {
  const dotAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(dotAnim, {
      toValue: 1,
      delay: index * 60,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.calendarDay, { transform: [{ scale: dotAnim }] }]}>
      <Text style={[styles.calendarDayLabel, isToday && styles.calendarDayLabelToday]}>{day}</Text>
      <View style={[
        styles.calendarDot,
        isActive && styles.calendarDotActive,
        isToday && styles.calendarDotToday,
      ]}>
        {isActive && <Ionicons name="checkmark" size={10} color="#fff" />}
      </View>
    </Animated.View>
  );
}

function StreakCalendar({ streakDays }: { streakDays: number }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date().getDay(); // 0=Sun, 1=Mon
  const adjustedToday = today === 0 ? 6 : today - 1; // 0=Mon ... 6=Sun

  return (
    <View style={styles.calendarRow}>
      {days.map((day, i) => {
        const daysAgo = adjustedToday - i;
        const isActive = daysAgo >= 0 && daysAgo < streakDays;
        const isToday = i === adjustedToday;
        return (
          <CalendarDayItem key={i} day={day} index={i} isActive={isActive} isToday={isToday} />
        );
      })}
    </View>
  );
}

function MilestoneTrack({ streakDays }: { streakDays: number }) {
  const nextMilestone = MILESTONES.find(m => m.days > streakDays) || MILESTONES[MILESTONES.length - 1];
  const prevMilestone = [...MILESTONES].reverse().find(m => m.days <= streakDays);
  const prevDays = prevMilestone ? prevMilestone.days : 0;
  const progressToNext = nextMilestone ? ((streakDays - prevDays) / (nextMilestone.days - prevDays)) * 100 : 100;

  const fillAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: progressToNext,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progressToNext]);

  return (
    <View style={styles.milestoneSection}>
      {/* Milestone dots */}
      <View style={styles.milestoneTrack}>
        <View style={styles.milestoneTrackBg}>
          <Animated.View style={[styles.milestoneTrackFill, {
            width: fillAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          }]} />
        </View>
        <View style={styles.milestoneDots}>
          {MILESTONES.slice(0, 4).map((m, i) => {
            const reached = streakDays >= m.days;
            return (
              <View key={m.days} style={styles.milestoneItem}>
                <View style={[
                  styles.milestoneDot,
                  reached ? { backgroundColor: m.color, borderColor: m.color + '60' } : {},
                ]}>
                  <Ionicons name={m.icon as any} size={12} color={reached ? '#fff' : '#444'} />
                </View>
                <Text style={[styles.milestoneLabel, reached && { color: m.color }]}>{m.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Next milestone info */}
      {nextMilestone && streakDays < nextMilestone.days && (
        <View style={styles.nextMilestone}>
          <Ionicons name="flag" size={14} color={nextMilestone.color} />
          <Text style={styles.nextMilestoneText}>
            <Text style={{ color: nextMilestone.color, fontWeight: '700' }}>
              {nextMilestone.days - streakDays}
            </Text> days to {nextMilestone.label}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function StreakSection({ data }: { data: StreakData }) {
  const { t } = useLanguage();
  const containerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(containerAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerAnim, transform: [{ translateY: containerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
      {/* Main streak card */}
      <View style={styles.mainCard}>
        <View style={styles.mainCardGlow} />

        {/* Flame + Count */}
        <View style={styles.flameRow}>
          <AnimatedFlame streakDays={data.streakDays} />
          <View style={styles.streakInfo}>
            <Text style={styles.streakNumber}>{data.streakDays}</Text>
            <Text style={styles.streakDaysLabel}>{t('dash_day_streak')}</Text>
          </View>
        </View>

        {/* Weekly Calendar */}
        <StreakCalendar streakDays={data.streakDays} />

        {/* Milestone Track */}
        <MilestoneTrack streakDays={data.streakDays} />
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(78, 205, 196, 0.12)' }]}>
            <Ionicons name="restaurant" size={20} color="#4ecdc4" />
          </View>
          <Text style={styles.statValue}>{data.mealsToday}</Text>
          <Text style={styles.statLabel}>{t('dash_meals_today')}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBg, { backgroundColor: 'rgba(162, 155, 254, 0.12)' }]}>
            <Ionicons name="checkmark-done" size={20} color="#a29bfe" />
          </View>
          <Text style={styles.statValue}>{data.routinesCompleted}/{data.routinesTotal}</Text>
          <Text style={styles.statLabel}>{t('dash_routines')}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, marginTop: 24 },
  // Main card
  mainCard: {
    backgroundColor: '#0d0d22',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.12)',
    overflow: 'hidden',
  },
  mainCardGlow: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 107, 107, 0.06)',
  },
  // Flame
  flameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  flameContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  flameGlowOuter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  flameGlowInner: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  streakInfo: { marginLeft: 16 },
  streakNumber: { fontSize: 42, fontWeight: '900', color: '#fff', lineHeight: 48 },
  streakDaysLabel: { fontSize: 14, color: '#888', fontWeight: '500' },
  // Calendar
  calendarRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  calendarDay: { alignItems: 'center', gap: 6 },
  calendarDayLabel: { fontSize: 11, color: '#555', fontWeight: '600' },
  calendarDayLabelToday: { color: '#00d4ff' },
  calendarDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a3e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarDotActive: { backgroundColor: '#ff6b6b' },
  calendarDotToday: { borderWidth: 2, borderColor: '#00d4ff' },
  // Milestones
  milestoneSection: {},
  milestoneTrack: { position: 'relative' },
  milestoneTrackBg: {
    position: 'absolute',
    top: 17,
    left: 20,
    right: 20,
    height: 3,
    backgroundColor: '#1a1a3e',
    borderRadius: 2,
    overflow: 'hidden',
  },
  milestoneTrackFill: {
    height: '100%',
    backgroundColor: '#ff6b6b',
    borderRadius: 2,
  },
  milestoneDots: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  milestoneItem: { alignItems: 'center' },
  milestoneDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a3e',
    borderWidth: 2,
    borderColor: '#252540',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  milestoneLabel: { fontSize: 10, color: '#555', fontWeight: '600' },
  nextMilestone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 6,
  },
  nextMilestoneText: { color: '#888', fontSize: 13 },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0d0d22',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  statIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: '#666', marginTop: 4, fontWeight: '500' },
});
