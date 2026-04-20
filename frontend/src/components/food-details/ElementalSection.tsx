import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ELEMENT_COLORS: Record<string, string> = {
  'C': '#444', 'H': '#00d4ff', 'O': '#ff6b6b', 'N': '#4ecdc4', 'S': '#ffd93d',
  'Fe': '#ff6b6b', 'Ca': '#74b9ff', 'K': '#ffd93d', 'Mg': '#4ecdc4', 'Zn': '#a29bfe',
  'P': '#fd79a8', 'Na': '#fdcb6e', 'Cu': '#e17055', 'Mn': '#00b894', 'Se': '#6c5ce7',
};

interface Props {
  elements: {
    mass_grams: Record<string, number>;
    millimoles: Record<string, number>;
    confidence: string;
  };
  biologicalEffects: Record<string, string[]>;
  formatNumber: (n: number) => string;
  elementsTitle: string;
}

export default function ElementalSection({ elements, biologicalEffects, formatNumber, elementsTitle }: Props) {
  const getColor = (el: string) => ELEMENT_COLORS[el] || '#666';

  return (
    <>
      {/* Elemental Composition */}
      <View style={styles.card}>
        <Text style={styles.title}>{elementsTitle}</Text>
        <Text style={styles.confidence}>Confidence: {elements.confidence}</Text>
        <View style={styles.grid}>
          {Object.entries(elements.mass_grams)
            .filter(([_, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([element, mass]) => (
              <View key={element} style={styles.item}>
                <View style={[styles.badge, { backgroundColor: getColor(element) }]}>
                  <Text style={styles.symbol}>{element}</Text>
                </View>
                <Text style={styles.mass}>{formatNumber(mass)}g</Text>
                <Text style={styles.moles}>{formatNumber(elements.millimoles[element])} mmol</Text>
              </View>
            ))}
        </View>
      </View>

      {/* Biological Effects */}
      {Object.keys(biologicalEffects).length > 0 && (
        <View style={styles.card}>
          <Text style={styles.title}>Biological Effects</Text>
          {Object.entries(biologicalEffects).slice(0, 5).map(([element, effects]) => (
            <View key={element} style={styles.effectItem}>
              <View style={[styles.effectBadge, { backgroundColor: getColor(element) }]}>
                <Text style={styles.effectSymbol}>{element}</Text>
              </View>
              <View style={styles.effectsList}>
                {effects.map((effect, i) => (
                  <Text key={i} style={styles.effectText}>• {effect}</Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 16 },
  confidence: { color: '#4ecdc4', fontSize: 11, marginTop: -8, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  item: { width: '18%', alignItems: 'center', marginBottom: 16 },
  badge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  symbol: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  mass: { fontSize: 11, color: '#fff' },
  moles: { fontSize: 9, color: '#888' },
  effectItem: { flexDirection: 'row', marginBottom: 16 },
  effectBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  effectSymbol: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
  effectsList: { flex: 1 },
  effectText: { color: '#aaa', fontSize: 12, lineHeight: 18 },
});
