import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface NutrientItem {
  key: string;
  label: string;
  unit?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  items: NutrientItem[];
  nutrients: Record<string, number>;
  formatNumber: (n: number) => string;
}

export default function NutrientGrid({ title, subtitle, items, nutrients, formatNumber }: Props) {
  const filtered = items.filter(i => (nutrients[i.key] || 0) > 0);
  if (filtered.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      <View style={styles.grid}>
        {filtered.map(item => (
          <View key={item.key} style={styles.item}>
            <Text style={styles.label}>{item.label}</Text>
            <Text style={styles.value}>
              {formatNumber(nutrients[item.key])} {item.unit || 'mg'}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 16 },
  subtitle: { fontSize: 10, color: '#999', marginBottom: 8, marginTop: -12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { width: '50%', marginBottom: 12 },
  label: { fontSize: 12, color: '#888' },
  value: { fontSize: 16, fontWeight: '600', color: '#fff', marginTop: 2 },
});
