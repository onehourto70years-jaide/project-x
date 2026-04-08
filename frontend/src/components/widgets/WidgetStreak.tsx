import React from 'react';
import StreakSection from '../StreakSection';

interface Props { dashboard: any; }

export default function WidgetStreak({ dashboard }: Props) {
  return (
    <StreakSection data={{
      streakDays: dashboard?.routines?.streak_days || 0,
      mealsToday: dashboard?.nutrition?.meals_count || 0,
      routinesCompleted: dashboard?.routines?.completed || 0,
      routinesTotal: dashboard?.routines?.total || 0,
    }} />
  );
}
