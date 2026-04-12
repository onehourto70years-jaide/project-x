import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

/* ── Badge Category Mapping ── */
const BADGE_CATEGORIES: Record<string, string> = {
  first_meal: 'nutrition',
  meal_streak_3: 'consistency',
  meal_streak_7: 'consistency',
  meal_streak_30: 'consistency',
  hydration_hero: 'hydration',
  protein_pro: 'protein',
  element_explorer: 'exploration',
  recipe_creator: 'recipe',
  routine_master: 'routine',
  century_meals: 'nutrition',
};

/* ── System Messages by Category ── */
const SYSTEM_MESSAGES: Record<string, string[]> = {
  nutrition: [
    'Nutrient intake aligned with targets.',
    'System efficiency increased.',
    'Caloric balance stabilized.',
    'Fuel protocol optimized.',
    'Nutritional baseline established.',
  ],
  hydration: [
    'Hydration levels stabilized.',
    'Fluid balance optimized.',
    'H\u2082O protocol synced.',
    'Cellular hydration adequate.',
    'Water intake rhythm established.',
  ],
  protein: [
    'Protein synthesis targets met.',
    'Amino acid profile optimized.',
    'Muscle recovery protocol active.',
    'Growth signal nutrients aligned.',
    'Protein intake consistently optimal.',
  ],
  consistency: [
    'Consistency protocol active.',
    'You are becoming consistent.',
    'Pattern recognition confirmed.',
    'Behavioral rhythm calibrated.',
    'System stability increasing.',
  ],
  exploration: [
    'Nutrient diversity expanding.',
    'New molecular profiles detected.',
    'Nutritional spectrum widening.',
    'Element diversity upgraded.',
    'Dietary range optimization complete.',
  ],
  recipe: [
    'Custom fuel formula created.',
    'Meal optimization template saved.',
    'Personalized nutrition blueprint stored.',
    'Recipe intelligence initialized.',
  ],
  routine: [
    'Routine integration complete.',
    'System rhythm calibrated.',
    'Daily protocol synchronized.',
    'Behavioral pattern locked in.',
  ],
  default: [
    'System update applied.',
    'Progress registered.',
    'Optimization level increased.',
    'Internal metrics improving.',
  ],
};

/* ── Dynamic stat labels by category ── */
const STAT_LABELS: Record<string, string[]> = {
  hydration: ['Hydration streak', 'Days hydrated', 'Water goal hit'],
  nutrition: ['Meals tracked', 'Nutrient coverage', 'Days optimized'],
  protein: ['Protein targets met', 'Protein consistency', 'Avg daily protein'],
  consistency: ['Current streak', 'Total days tracked', 'Consistency score'],
  exploration: ['Unique foods tried', 'Nutrient diversity', 'Food variety'],
  recipe: ['Recipes created', 'Meals optimized', 'Custom formulas'],
  routine: ['Routines completed', 'Active days', 'Completion rate'],
  default: ['Progress level', 'Days active', 'Milestones reached'],
};

export interface CelebrationBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  systemMessage: string;
  statLabel: string;
  statValue: string;
}

interface CelebrationContextType {
  isVisible: boolean;
  currentBadge: CelebrationBadge | null;
  triggerCelebration: (badge: {
    id: string; name: string; description: string;
    icon: string; color: string;
  }, stats?: Record<string, number>) => void;
  dismiss: () => void;
  trackAction: (action: string) => void;
}

const CelebrationContext = createContext<CelebrationContextType | null>(null);

export const useCelebration = () => {
  const ctx = useContext(CelebrationContext);
  if (!ctx) throw new Error('useCelebration must be used within CelebrationProvider');
  return ctx;
};

/* ── Helpers ── */
const pickRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

const getStatForBadge = (category: string, stats: Record<string, number>): { label: string; value: string } => {
  const labels = STAT_LABELS[category] || STAT_LABELS.default;
  switch (category) {
    case 'hydration': return { label: labels[0], value: `${stats.water_goals_met || 0} days` };
    case 'nutrition': return { label: labels[0], value: `${stats.meals_logged || 0} meals` };
    case 'protein': return { label: labels[0], value: `${stats.protein_goals_met || 0} days` };
    case 'consistency': return { label: labels[0], value: `${stats.streak || 0} days` };
    case 'exploration': return { label: labels[0], value: `${stats.unique_foods || 0} foods` };
    case 'recipe': return { label: labels[0], value: `${stats.recipes_created || 0}` };
    case 'routine': return { label: labels[0], value: `${stats.routines_completed_days || 0} days` };
    default: return { label: 'Progress', value: `${stats.meals_logged || 0}` };
  }
};

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentBadge, setCurrentBadge] = useState<CelebrationBadge | null>(null);
  const startTimeRef = useRef(0);

  const triggerCelebration = useCallback((badge: {
    id: string; name: string; description: string;
    icon: string; color: string;
  }, stats: Record<string, number> = {}) => {
    const category = BADGE_CATEGORIES[badge.id] || 'default';
    const messages = SYSTEM_MESSAGES[category] || SYSTEM_MESSAGES.default;
    const systemMessage = pickRandom(messages);
    const stat = getStatForBadge(category, stats);

    setCurrentBadge({
      ...badge,
      category,
      systemMessage,
      statLabel: stat.label,
      statValue: stat.value,
    });
    startTimeRef.current = Date.now();
    setIsVisible(true);
  }, []);

  const trackAction = useCallback(async (action: string) => {
    if (!currentBadge) return;
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const duration = Date.now() - startTimeRef.current;
      await fetch(`${BACKEND_URL}/api/analytics/celebration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          badge_id: currentBadge.id,
          badge_name: currentBadge.name,
          action,
          duration_ms: duration,
        }),
      });
    } catch (e) {
      // Silent fail — analytics should never block UX
    }
  }, [currentBadge]);

  const dismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => setCurrentBadge(null), 400); // cleanup after fade-out
  }, []);

  return (
    <CelebrationContext.Provider value={{ isVisible, currentBadge, triggerCelebration, dismiss, trackAction }}>
      {children}
    </CelebrationContext.Provider>
  );
}
