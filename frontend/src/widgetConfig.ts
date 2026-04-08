import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WidgetItem {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}

const KEY = 'nutrios_widget_layout';

export const DEFAULT_WIDGETS: WidgetItem[] = [
  { id: 'health_score', label: 'Health Score & Rings', icon: 'shield-checkmark', enabled: true },
  { id: 'quick_actions', label: 'Quick Actions', icon: 'flash', enabled: true },
  { id: 'nutrient_gaps', label: 'Nutrient Gaps', icon: 'pulse', enabled: true },
  { id: 'elements', label: 'Elemental Composition', icon: 'flask', enabled: true },
  { id: 'streak', label: 'Streak & Badges', icon: 'trophy', enabled: true },
  { id: 'macros', label: 'Macro Breakdown', icon: 'pie-chart', enabled: true },
  { id: 'recent_meals', label: 'Recent Meals', icon: 'restaurant', enabled: true },
  { id: 'ai_insights', label: 'AI Insights', icon: 'sparkles', enabled: true },
  { id: 'quick_nav', label: 'Quick Navigation', icon: 'grid', enabled: true },
  { id: 'share_social', label: 'Share & Social', icon: 'share-social', enabled: true },
];

export async function loadWidgetLayout(): Promise<WidgetItem[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved: WidgetItem[] = JSON.parse(raw);
      const ids = new Set(saved.map(w => w.id));
      const merged = [...saved];
      DEFAULT_WIDGETS.forEach(d => { if (!ids.has(d.id)) merged.push({ ...d }); });
      return merged;
    }
  } catch {}
  return DEFAULT_WIDGETS.map(w => ({ ...w }));
}

export async function saveWidgetLayout(widgets: WidgetItem[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(widgets));
}
