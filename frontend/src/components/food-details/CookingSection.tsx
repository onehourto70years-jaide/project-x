import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CookingRecommendations {
  recommended_method: string;
  method_rankings: Array<{ method: string; avg_retention: number }>;
  safety_requirements?: { fahrenheit: number; celsius: number; description: string };
  tips: string[];
}

interface Props {
  recommendations: CookingRecommendations;
}

export default function CookingSection({ recommendations }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Cooking Recommendations</Text>

      {recommendations.safety_requirements && (
        <View style={styles.safetyAlert}>
          <Ionicons name="thermometer" size={20} color="#ff6b6b" />
          <View style={styles.safetyInfo}>
            <Text style={styles.safetyTitle}>Safe Minimum Temperature</Text>
            <Text style={styles.safetyTemp}>
              {recommendations.safety_requirements.fahrenheit}\u00b0F / {recommendations.safety_requirements.celsius}\u00b0C
            </Text>
            <Text style={styles.safetyDesc}>{recommendations.safety_requirements.description}</Text>
          </View>
        </View>
      )}

      <Text style={styles.methodTitle}>Best Methods for Nutrient Retention</Text>
      {recommendations.method_rankings.map((method, i) => (
        <View key={method.method} style={styles.methodRank}>
          <Text style={styles.rankNumber}>#{i + 1}</Text>
          <Text style={styles.rankMethod}>{method.method}</Text>
          <View style={styles.retentionBar}>
            <View style={[styles.retentionFill, { width: `${method.avg_retention}%` }]} />
          </View>
          <Text style={styles.retentionPct}>{method.avg_retention}%</Text>
        </View>
      ))}

      {recommendations.tips?.length > 0 && (
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>Tips</Text>
          {recommendations.tips.map((tip, i) => (
            <Text key={i} style={styles.tipText}>• {tip}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 16 },
  safetyAlert: { flexDirection: 'row', backgroundColor: 'rgba(255, 107, 107, 0.1)', padding: 12, borderRadius: 8, marginBottom: 16 },
  safetyInfo: { marginLeft: 12, flex: 1 },
  safetyTitle: { color: '#ff6b6b', fontWeight: '600', fontSize: 13 },
  safetyTemp: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  safetyDesc: { color: '#888', fontSize: 11, marginTop: 4 },
  methodTitle: { color: '#888', fontSize: 12, marginBottom: 12 },
  methodRank: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rankNumber: { color: '#00d4ff', fontWeight: 'bold', width: 24 },
  rankMethod: { color: '#fff', width: 70, fontSize: 13 },
  retentionBar: { flex: 1, height: 6, backgroundColor: '#2a2a4e', borderRadius: 3, marginHorizontal: 8 },
  retentionFill: { height: 6, backgroundColor: '#4ecdc4', borderRadius: 3 },
  retentionPct: { color: '#4ecdc4', fontSize: 12, width: 40, textAlign: 'right' },
  tipsSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#2a2a4e' },
  tipsTitle: { color: '#ffd93d', fontWeight: '600', marginBottom: 8 },
  tipText: { color: '#aaa', fontSize: 12, lineHeight: 20 },
});
