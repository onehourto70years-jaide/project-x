import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  nutrients: Record<string, number>;
  retentionApplied: boolean;
  cookingMethod: string;
  formatNumber: (n: number) => string;
}

export default function MacroCard({ nutrients, retentionApplied, cookingMethod, formatNumber }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Macronutrients</Text>
      <View style={styles.grid}>
        <View style={styles.item}>
          <Text style={styles.value}>{formatNumber(nutrients.energy_kcal)}</Text>
          <Text style={styles.label}>kcal</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.value}>{formatNumber(nutrients.protein_g)}</Text>
          <Text style={styles.label}>Protein (g)</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.value}>{formatNumber(nutrients.carbohydrate_g)}</Text>
          <Text style={styles.label}>Carbs (g)</Text>
        </View>
        <View style={styles.item}>
          <Text style={styles.value}>{formatNumber(nutrients.fat_g)}</Text>
          <Text style={styles.label}>Fat (g)</Text>
        </View>
      </View>
      {retentionApplied && (
        <Text style={styles.note}>* Nutrients adjusted for {cookingMethod} cooking retention</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 16 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { alignItems: 'center' },
  value: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  label: { fontSize: 11, color: '#888', marginTop: 4 },
  note: { fontSize: 11, color: '#ffd93d', marginTop: 12, fontStyle: 'italic' },
});
