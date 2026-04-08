import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../ThemeContext';

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

interface ElementData { symbol: string; amount: number; color: string; effects: string[]; }

function MiniRing({ size, progress, color, trackColor }: { size: number; progress: number; color: string; trackColor: string }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const strokeDashoffset = circumference - (circumference * clampedProgress) / 100;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={3} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={3} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation="-90" origin={`${size / 2}, ${size / 2}`} />
    </Svg>
  );
}

function ElementCard({ element, index, onPress }: { element: ElementData; index: number; onPress: () => void }) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const details = ELEMENT_DETAILS[element.symbol] || { dailyTarget: 1 };
  const pct = details.dailyTarget > 0 ? Math.min((element.amount / details.dailyTarget) * 100, 100) : 0;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, delay: index * 80, tension: 50, friction: 8, useNativeDriver: true }).start();
    if (element.amount > 0) { Animated.loop(Animated.sequence([Animated.timing(glowAnim, { toValue: 0.7, duration: 2000, useNativeDriver: true }), Animated.timing(glowAnim, { toValue: 0.3, duration: 2000, useNativeDriver: true })])).start(); }
  }, [element.amount]);
  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity style={[s.elementCard, { backgroundColor: theme.bgSecondary, borderColor: element.color + '30' }]} onPress={onPress} activeOpacity={0.7}>
        <Animated.View style={[s.elementGlow, { backgroundColor: element.color + '12', opacity: glowAnim }]} />
        <View style={s.ringContainer}>
          <MiniRing size={52} progress={pct} color={element.color} trackColor={theme.border} />
          <View style={s.symbolOverlay}><Text style={[s.elementSymbol, { color: element.color }]}>{element.symbol}</Text></View>
        </View>
        <Text style={[s.elementAmount, { color: theme.textSecondary }]}>{element.amount < 0.01 ? element.amount.toFixed(4) : element.amount < 1 ? element.amount.toFixed(3) : element.amount.toFixed(1)}<Text style={{ fontSize: 9, color: theme.textDim }}>g</Text></Text>
        <View style={[s.pctBadge, { backgroundColor: element.color + '15' }]}><Text style={[s.pctText, { color: element.color }]}>{pct >= 100 ? '100%' : `${Math.round(pct)}%`}</Text></View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AnimatedElements({ elements, colors, effects }: { elements: Record<string, number>; colors: Record<string, string>; effects: Record<string, string[]>; }) {
  const { theme } = useTheme();
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(); }, []);
  const elementList: ElementData[] = ['C', 'H', 'O', 'N', 'S', 'Ca', 'Fe', 'Mg', 'K', 'Zn'].map(el => ({ symbol: el, amount: elements[el] || 0, color: colors[el] || '#888', effects: effects[el] || [] }));
  const activeElements = elementList.filter(e => e.amount > 0);
  const sortedElements = [...activeElements, ...elementList.filter(e => e.amount === 0)];
  const selectedDetails = selectedElement ? ELEMENT_DETAILS[selectedElement] : null;
  const selectedData = selectedElement ? elementList.find(e => e.symbol === selectedElement) : null;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={s.headerRow}>
        <View style={s.activeIndicator}>
          <View style={[s.activeDot, { backgroundColor: activeElements.length > 0 ? theme.success : theme.textDim }]} />
          <Text style={[s.activeText, { color: theme.textDim }]}>{activeElements.length} / {elementList.length} active</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gridScroll} decelerationRate="fast" snapToInterval={94}>
        {sortedElements.map((el, i) => <ElementCard key={el.symbol} element={el} index={i} onPress={() => setSelectedElement(el.symbol)} />)}
      </ScrollView>
      <Modal visible={!!selectedElement} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setSelectedElement(null)}>
          <View style={[s.detailCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
            {selectedDetails && selectedData && (
              <>
                <View style={s.detailHeader}>
                  <View style={[s.detailSymbolCircle, { borderColor: selectedData.color + '50', backgroundColor: selectedData.color + '10' }]}>
                    <Text style={[s.detailSymbol, { color: selectedData.color }]}>{selectedElement}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[s.detailName, { color: theme.text }]}>{selectedDetails.name}</Text>
                    <Text style={[{ fontSize: 12, color: theme.textMuted, marginTop: 4, lineHeight: 18 }]}>{selectedDetails.role}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedElement(null)}><Ionicons name="close-circle" size={28} color={theme.textDim} /></TouchableOpacity>
                </View>
                <View style={s.detailStats}>
                  <View style={s.detailStatItem}><Text style={[s.detailStatLabel, { color: theme.textDim }]}>Current</Text><Text style={[s.detailStatValue, { color: selectedData.color }]}>{selectedData.amount < 1 ? selectedData.amount.toFixed(3) : selectedData.amount.toFixed(1)}g</Text></View>
                  <View style={[s.detailStatDivider, { backgroundColor: theme.bgInput }]} />
                  <View style={s.detailStatItem}><Text style={[s.detailStatLabel, { color: theme.textDim }]}>Daily Target</Text><Text style={[s.detailStatValue, { color: theme.text }]}>{selectedDetails.dailyTarget}g</Text></View>
                  <View style={[s.detailStatDivider, { backgroundColor: theme.bgInput }]} />
                  <View style={s.detailStatItem}><Text style={[s.detailStatLabel, { color: theme.textDim }]}>Progress</Text><Text style={[s.detailStatValue, { color: selectedData.color }]}>{Math.min(Math.round((selectedData.amount / selectedDetails.dailyTarget) * 100), 100)}%</Text></View>
                </View>
                <View style={[s.detailProgressTrack, { backgroundColor: theme.bgInput }]}>
                  <View style={[s.detailProgressFill, { width: `${Math.min((selectedData.amount / selectedDetails.dailyTarget) * 100, 100)}%`, backgroundColor: selectedData.color }]} />
                </View>
                {selectedData.effects.length > 0 && (
                  <View style={{ marginTop: 8, marginBottom: 8 }}>
                    <Text style={[{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 10 }]}><Ionicons name="flash" size={14} color={theme.warning} /> Effects</Text>
                    {selectedData.effects.map((effect, i) => (<View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}><View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: selectedData.color, marginRight: 10 }} /><Text style={{ color: theme.textSecondary, fontSize: 13 }}>{effect}</Text></View>))}
                  </View>
                )}
                <View style={{ marginTop: 8 }}>
                  <Text style={[{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 10 }]}><Ionicons name="restaurant" size={14} color={theme.teal} /> Top Sources</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {selectedDetails.sources.map((src, i) => (<View key={i} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: theme.bgInput, borderWidth: 1, borderColor: selectedData.color + '30' }}><Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '500' }}>{src}</Text></View>))}
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

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, marginBottom: 10 },
  activeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeText: { fontSize: 12, fontWeight: '500' },
  gridScroll: { paddingHorizontal: 16, paddingBottom: 4 },
  elementCard: { width: 84, height: 120, borderRadius: 16, borderWidth: 1, marginRight: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', paddingVertical: 8 },
  elementGlow: { position: 'absolute', top: -30, width: 80, height: 80, borderRadius: 40 },
  ringContainer: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  symbolOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  elementSymbol: { fontSize: 20, fontWeight: '900' },
  elementAmount: { fontSize: 10, marginTop: 4 },
  pctBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4 },
  pctText: { fontSize: 9, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  detailCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 24, borderWidth: 1 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  detailSymbolCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  detailSymbol: { fontSize: 24, fontWeight: '900' },
  detailName: { fontSize: 20, fontWeight: '800' },
  detailStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  detailStatItem: { alignItems: 'center' },
  detailStatLabel: { fontSize: 11, marginBottom: 4 },
  detailStatValue: { fontSize: 18, fontWeight: '800' },
  detailStatDivider: { width: 1 },
  detailProgressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 20 },
  detailProgressFill: { height: '100%', borderRadius: 3 },
});
