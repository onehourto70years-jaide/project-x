import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  glycemicIndex: number;
  glycemicLoad: number;
}

export default function GlycemicCard({ glycemicIndex, glycemicLoad }: Props) {
  if (glycemicIndex <= 0) return null;

  const giColor = glycemicIndex > 70 ? '#ff6b6b' : glycemicIndex > 55 ? '#ffa502' : '#00b894';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>\ud83d\udcca Glycemic Data</Text>
      <View style={styles.grid}>
        <View style={styles.item}>
          <Text style={styles.label}>Glycemic Index</Text>
          <Text style={[styles.value, { color: giColor }]}>{glycemicIndex}</Text>
        </View>
        {glycemicLoad > 0 && (
          <View style={styles.item}>
            <Text style={styles.label}>Glycemic Load</Text>
            <Text style={styles.value}>{glycemicLoad}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  item: { width: '50%', marginBottom: 12 },
  label: { fontSize: 12, color: '#888' },
  value: { fontSize: 16, fontWeight: '600', color: '#fff', marginTop: 2 },
});
