import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface BodyStateData {
  body_state: Record<string, { level: string; score: number; prediction: string }>;
  decisions: Array<{ priority: string; action: string; reason: string; icon: string }>;
  metabolic_note: string;
  synergies: any[];
  conflicts: any[];
}

const LEVEL_COLORS: Record<string, string> = {
  high: '#00ff88', optimal: '#00ff88', stable: '#00ff88', sharp: '#00ff88', satisfied: '#00ff88',
  moderate: '#ffd93d', normal: '#ffd93d', adequate: '#ffd93d', mild: '#ffd93d',
  low: '#ff6b6b', unstable: '#ff6b6b', crash_risk: '#e74c3c', foggy: '#e74c3c', insufficient: '#ff6b6b',
  unknown: '#555',
};

export default function WidgetJaideInsight() {
  const router = useRouter();
  const { theme } = useTheme();
  const [data, setData] = useState<BodyStateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBodyState();
  }, []);

  const fetchBodyState = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/body-state`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('Jaide widget fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.card }]}>
        <ActivityIndicator size="small" color="#00d4ff" />
      </View>
    );
  }

  if (!data || !data.body_state) {
    return (
      <TouchableOpacity style={[styles.container, { backgroundColor: theme.card }]} onPress={() => router.push('/body-state' as any)}>
        <Image source={require('../../../assets/jaide/jaide-cartoon.png')} style={styles.avatar} />
        <View style={styles.content}>
          <Text style={[styles.label, { color: theme.textMuted }]}>JAIDE</Text>
          <Text style={[styles.message, { color: theme.text }]}>Log your first meal to activate body state analysis ✨</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Pick the most important decision
  const topDecision = data.decisions?.[0];
  const energyState = data.body_state?.energy;
  const energyColor = LEVEL_COLORS[energyState?.level || 'unknown'] || '#555';

  return (
    <TouchableOpacity style={[styles.container, { backgroundColor: theme.card }]} onPress={() => router.push('/body-state' as any)} activeOpacity={0.7}>
      {/* Jaide Avatar + Observation */}
      <View style={styles.headerRow}>
        <Image source={require('../../../assets/jaide/jaide-cartoon.png')} style={styles.avatar} />
        <View style={styles.content}>
          <Text style={[styles.label, { color: '#00d4ff' }]}>JAIDE OBSERVES</Text>
          <Text style={[styles.note, { color: theme.text }]} numberOfLines={2}>{data.metabolic_note}</Text>
        </View>
      </View>

      {/* Quick Energy State */}
      <View style={styles.stateRow}>
        <View style={[styles.stateIndicator, { borderColor: energyColor }]}>
          <Text style={styles.stateEmoji}>⚡</Text>
          <Text style={[styles.stateLevel, { color: energyColor }]}>{energyState?.level?.toUpperCase() || 'N/A'}</Text>
        </View>
        {data.synergies.length > 0 && (
          <View style={styles.synergyPill}>
            <Text style={styles.synergyText}>🔗 {data.synergies.length} synerg{data.synergies.length > 1 ? 'ies' : 'y'}</Text>
          </View>
        )}
        {data.conflicts.length > 0 && (
          <View style={styles.conflictPill}>
            <Text style={styles.conflictText}>⚠️ {data.conflicts.length} conflict{data.conflicts.length > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Top Decision */}
      {topDecision && (
        <View style={styles.decisionRow}>
          <Text style={styles.decisionIcon}>{topDecision.icon}</Text>
          <Text style={[styles.decisionText, { color: theme.text }]} numberOfLines={1}>{topDecision.action}</Text>
        </View>
      )}

      {/* CTA */}
      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>View full body state</Text>
        <Ionicons name="chevron-forward" size={14} color="#00d4ff" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, padding: 16, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.3)' },
  content: { flex: 1, marginLeft: 12 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
  message: { fontSize: 13, lineHeight: 18 },
  note: { fontSize: 14, fontWeight: '500', lineHeight: 18 },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stateIndicator: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, gap: 4 },
  stateEmoji: { fontSize: 14 },
  stateLevel: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  synergyPill: { backgroundColor: 'rgba(78, 205, 196, 0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  synergyText: { fontSize: 11, color: '#4ecdc4', fontWeight: '600' },
  conflictPill: { backgroundColor: 'rgba(231, 76, 60, 0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  conflictText: { fontSize: 11, color: '#e74c3c', fontWeight: '600' },
  decisionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 212, 255, 0.06)', borderRadius: 10, padding: 10, gap: 8, marginBottom: 10 },
  decisionIcon: { fontSize: 16 },
  decisionText: { fontSize: 13, fontWeight: '500', flex: 1 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  ctaText: { fontSize: 12, color: '#00d4ff', fontWeight: '600' },
});
