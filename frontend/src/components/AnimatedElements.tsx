import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ElementData {
  symbol: string;
  amount: number;
  color: string;
  effects: string[];
  name?: string;
  dailyTarget?: number;
}

const ELEMENT_DETAILS: Record<string, { name: string; role: string; sources: string[]; dailyTarget: number }> = {
  C: { name: 'Carbon', role: 'Energy backbone of all organic molecules', sources: ['Carbohydrates', 'Proteins', 'Fats'], dailyTarget: 300 },
  H: { name: 'Hydrogen', role: 'Essential for hydration and pH balance', sources: ['Water', 'All organic foods'], dailyTarget: 40 },
  O: { name: 'Oxygen', role: 'Cellular respiration and energy production', sources: ['Water', 'Fruits', 'Vegetables'], dailyTarget: 200 },
  N: { name: 'Nitrogen', role: 'Protein synthesis and DNA building', sources: ['Meat', 'Legumes', 'Dairy'], dailyTarget: 16 },
  S: { name: 'Sulfur', role: 'Enzyme function and detoxification', sources: ['Eggs', 'Garlic', 'Onions'], dailyTarget: 1 },
  Ca: { name: 'Calcium', role: 'Bone density and nerve signaling', sources: ['Dairy', 'Leafy greens', 'Fortified foods'], dailyTarget: 1 },
  Fe: { name: 'Iron', role: 'Oxygen transport in blood', sources: ['Red meat', 'Spinach', 'Lentils'], dailyTarget: 0.018 },
  Mg: { name: 'Magnesium', role: 'Muscle and nerve function', sources: ['Nuts', 'Seeds', 'Dark chocolate'], dailyTarget: 0.4 },
  K: { name: 'Potassium', role: 'Heart rhythm and fluid balance', sources: ['Bananas', 'Potatoes', 'Avocados'], dailyTarget: 4.7 },
  Zn: { name: 'Zinc', role: 'Immune function and wound healing', sources: ['Oysters', 'Beef', 'Pumpkin seeds'], dailyTarget: 0.011 },
};

// Mini ring for element card
function MiniRing({ size, progress, color }: { size: number; progress: number; color: string }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference - (circumference * clampedProgress) / 100;

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={3} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={3} fill="none"
        strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
        rotation="-90" origin={`${size / 2}, ${size / 2}`} />
    </Svg>
  );
}

function ElementCard({ element, index, onPress }: { element: ElementData; index: number; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const details = ELEMENT_DETAILS[element.symbol] || { dailyTarget: 1 };
  const pct = details.dailyTarget > 0 ? Math.min((element.amount / details.dailyTarget) * 100, 100) : 0;

  useEffect(() => {
    // Staggered entrance animation
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay: index * 80,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Continuous subtle glow
    if (element.amount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 0.7, duration: 2000, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [element.amount]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.elementCard, { borderColor: element.color + '30' }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Glow background */}
        <Animated.View style={[styles.elementGlow, { backgroundColor: element.color + '12', opacity: glowAnim }]} />
        
        {/* Mini progress ring behind symbol */}
        <View style={styles.ringContainer}>
          <MiniRing size={52} progress={pct} color={element.color} />
          <View style={styles.symbolOverlay}>
            <Text style={[styles.elementSymbol, { color: element.color }]}>{element.symbol}</Text>
          </View>
        </View>
        
        {/* Amount */}
        <Text style={styles.elementAmount}>
          {element.amount < 0.01 ? element.amount.toFixed(4) : element.amount < 1 ? element.amount.toFixed(3) : element.amount.toFixed(1)}
          <Text style={styles.elementUnit}>g</Text>
        </Text>
        
        {/* Percentage indicator */}
        <View style={[styles.pctBadge, { backgroundColor: element.color + '15' }]}>
          <Text style={[styles.pctText, { color: element.color }]}>
            {pct >= 100 ? '100%' : `${Math.round(pct)}%`}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AnimatedElements({ elements, colors, effects }: {
  elements: Record<string, number>;
  colors: Record<string, string>;
  effects: Record<string, string[]>;
}) {
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const elementList: ElementData[] = ['C', 'H', 'O', 'N', 'S', 'Ca', 'Fe', 'Mg', 'K', 'Zn'].map(el => ({
    symbol: el,
    amount: elements[el] || 0,
    color: colors[el] || '#888',
    effects: effects[el] || [],
  }));

  const activeElements = elementList.filter(e => e.amount > 0);
  const inactiveElements = elementList.filter(e => e.amount === 0);
  const sortedElements = [...activeElements, ...inactiveElements];

  const selectedDetails = selectedElement ? ELEMENT_DETAILS[selectedElement] : null;
  const selectedData = selectedElement ? elementList.find(e => e.symbol === selectedElement) : null;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      {/* Active element count */}
      <View style={styles.headerRow}>
        <View style={styles.activeIndicator}>
          <View style={[styles.activeDot, { backgroundColor: activeElements.length > 0 ? '#00ff88' : '#666' }]} />
          <Text style={styles.activeText}>
            {activeElements.length} / {elementList.length} active
          </Text>
        </View>
      </View>

      {/* Element Grid */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.gridScroll}
        decelerationRate="fast"
        snapToInterval={94}
      >
        {sortedElements.map((el, i) => (
          <ElementCard
            key={el.symbol}
            element={el}
            index={i}
            onPress={() => setSelectedElement(el.symbol)}
          />
        ))}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selectedElement} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedElement(null)}
        >
          <View style={styles.detailCard}>
            {selectedDetails && selectedData && (
              <>
                <View style={styles.detailHeader}>
                  <View style={[styles.detailSymbolCircle, { borderColor: selectedData.color + '50', backgroundColor: selectedData.color + '10' }]}>
                    <Text style={[styles.detailSymbol, { color: selectedData.color }]}>{selectedElement}</Text>
                  </View>
                  <View style={styles.detailHeaderInfo}>
                    <Text style={styles.detailName}>{selectedDetails.name}</Text>
                    <Text style={styles.detailRole}>{selectedDetails.role}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedElement(null)}>
                    <Ionicons name="close-circle" size={28} color="#444" />
                  </TouchableOpacity>
                </View>

                {/* Amount & Progress */}
                <View style={styles.detailStats}>
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatLabel}>Current</Text>
                    <Text style={[styles.detailStatValue, { color: selectedData.color }]}>
                      {selectedData.amount < 1 ? selectedData.amount.toFixed(3) : selectedData.amount.toFixed(1)}g
                    </Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatLabel}>Daily Target</Text>
                    <Text style={styles.detailStatValue}>{selectedDetails.dailyTarget}g</Text>
                  </View>
                  <View style={styles.detailStatDivider} />
                  <View style={styles.detailStatItem}>
                    <Text style={styles.detailStatLabel}>Progress</Text>
                    <Text style={[styles.detailStatValue, { color: selectedData.color }]}>
                      {Math.min(Math.round((selectedData.amount / selectedDetails.dailyTarget) * 100), 100)}%
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.detailProgressTrack}>
                  <View style={[styles.detailProgressFill, {
                    width: `${Math.min((selectedData.amount / selectedDetails.dailyTarget) * 100, 100)}%`,
                    backgroundColor: selectedData.color,
                  }]} />
                </View>

                {/* Effects */}
                {selectedData.effects.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>
                      <Ionicons name="flash" size={14} color="#ffd93d" /> Effects
                    </Text>
                    {selectedData.effects.map((effect, i) => (
                      <View key={i} style={styles.effectRow}>
                        <View style={[styles.effectDot, { backgroundColor: selectedData.color }]} />
                        <Text style={styles.effectText}>{effect}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Food Sources */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>
                    <Ionicons name="restaurant" size={14} color="#4ecdc4" /> Top Sources
                  </Text>
                  <View style={styles.sourcesRow}>
                    {selectedDetails.sources.map((src, i) => (
                      <View key={i} style={[styles.sourceChip, { borderColor: selectedData.color + '30' }]}>
                        <Text style={styles.sourceText}>{src}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, marginBottom: 10 },
  activeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeText: { color: '#666', fontSize: 12, fontWeight: '500' },
  gridScroll: { paddingHorizontal: 16, paddingBottom: 4 },
  // Element Card
  elementCard: {
    width: 84,
    height: 120,
    borderRadius: 16,
    backgroundColor: '#0d0d22',
    borderWidth: 1,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingVertical: 8,
  },
  elementGlow: {
    position: 'absolute',
    top: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  ringContainer: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  symbolOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  elementSymbol: { fontSize: 20, fontWeight: '900' },
  elementAmount: { fontSize: 10, color: '#aaa', marginTop: 4 },
  elementUnit: { fontSize: 9, color: '#666' },
  pctBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  pctText: { fontSize: 9, fontWeight: '700' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  detailCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#12122a',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  detailSymbolCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailSymbol: { fontSize: 24, fontWeight: '900' },
  detailHeaderInfo: { flex: 1, marginLeft: 14 },
  detailName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  detailRole: { fontSize: 12, color: '#888', marginTop: 4, lineHeight: 18 },
  // Stats
  detailStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  detailStatItem: { alignItems: 'center' },
  detailStatLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
  detailStatValue: { fontSize: 18, fontWeight: '800', color: '#fff' },
  detailStatDivider: { width: 1, backgroundColor: '#1a1a3e' },
  // Progress
  detailProgressTrack: {
    height: 6,
    backgroundColor: '#1a1a3e',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  detailProgressFill: { height: '100%', borderRadius: 3 },
  // Sections
  detailSection: { marginTop: 8, marginBottom: 8 },
  detailSectionTitle: { fontSize: 14, fontWeight: '600', color: '#ccc', marginBottom: 10 },
  effectRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  effectDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 10 },
  effectText: { color: '#aaa', fontSize: 13 },
  sourcesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sourceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1a1a3e',
    borderWidth: 1,
  },
  sourceText: { color: '#ccc', fontSize: 12, fontWeight: '500' },
});
