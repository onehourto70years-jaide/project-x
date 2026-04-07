import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, TouchableWithoutFeedback,
  Modal, TouchableOpacity, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── All periodic table elements ──
const ALL_ELEMENTS = [
  'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne',
  'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca',
  'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Se',
  'Br', 'Mo', 'I', 'Ba', 'W', 'Au', 'Hg', 'Pb',
];

// Biologically important elements (weighted more heavily)
const BIO_ELEMENTS = ['H', 'C', 'N', 'O', 'Na', 'Mg', 'P', 'S', 'Cl', 'K', 'Ca', 'Fe', 'Zn', 'Se', 'Cu', 'Mn', 'I', 'Co'];

// Element data for tap interaction
const ELEMENT_INFO: Record<string, { name: string; number: number; role: string; sources: string[] }> = {
  H:  { name: 'Hydrogen',   number: 1,  role: 'Hydration & pH balance', sources: ['Water', 'All organic foods'] },
  He: { name: 'Helium',     number: 2,  role: 'Inert gas in atmosphere', sources: [] },
  Li: { name: 'Lithium',    number: 3,  role: 'Mood stabilization', sources: ['Grains', 'Vegetables'] },
  Be: { name: 'Beryllium',  number: 4,  role: 'Trace element', sources: [] },
  B:  { name: 'Boron',      number: 5,  role: 'Bone health support', sources: ['Fruits', 'Nuts'] },
  C:  { name: 'Carbon',     number: 6,  role: 'Energy backbone of all organic molecules', sources: ['All organic foods'] },
  N:  { name: 'Nitrogen',   number: 7,  role: 'Protein synthesis & DNA', sources: ['Meat', 'Legumes', 'Dairy'] },
  O:  { name: 'Oxygen',     number: 8,  role: 'Cellular respiration & energy', sources: ['Water', 'Fruits', 'Vegetables'] },
  F:  { name: 'Fluorine',   number: 9,  role: 'Dental health & enamel', sources: ['Water', 'Tea', 'Fish'] },
  Na: { name: 'Sodium',     number: 11, role: 'Nerve impulses & fluid balance', sources: ['Salt', 'Processed foods'] },
  Mg: { name: 'Magnesium',  number: 12, role: 'Muscle/nerve function, 300+ enzymes', sources: ['Nuts', 'Seeds', 'Dark chocolate'] },
  Al: { name: 'Aluminum',   number: 13, role: 'No known biological role', sources: [] },
  Si: { name: 'Silicon',    number: 14, role: 'Connective tissue strength', sources: ['Grains', 'Beer'] },
  P:  { name: 'Phosphorus', number: 15, role: 'Bone structure & ATP energy', sources: ['Meat', 'Dairy', 'Nuts'] },
  S:  { name: 'Sulfur',     number: 16, role: 'Enzyme function & detoxification', sources: ['Eggs', 'Garlic', 'Onions'] },
  Cl: { name: 'Chlorine',   number: 17, role: 'Stomach acid & digestion', sources: ['Salt', 'Seaweed'] },
  K:  { name: 'Potassium',  number: 19, role: 'Heart rhythm & fluid balance', sources: ['Bananas', 'Potatoes', 'Avocados'] },
  Ca: { name: 'Calcium',    number: 20, role: 'Bone density & nerve signaling', sources: ['Dairy', 'Leafy greens'] },
  Ti: { name: 'Titanium',   number: 22, role: 'Used in medical implants', sources: [] },
  V:  { name: 'Vanadium',   number: 23, role: 'May aid insulin function', sources: ['Mushrooms', 'Shellfish'] },
  Cr: { name: 'Chromium',   number: 24, role: 'Glucose metabolism support', sources: ['Broccoli', 'Grapes'] },
  Mn: { name: 'Manganese',  number: 25, role: 'Antioxidant enzyme cofactor', sources: ['Whole grains', 'Nuts'] },
  Fe: { name: 'Iron',       number: 26, role: 'Oxygen transport in blood', sources: ['Red meat', 'Spinach', 'Lentils'] },
  Co: { name: 'Cobalt',     number: 27, role: 'Vitamin B12 component', sources: ['Meat', 'Fish', 'Dairy'] },
  Ni: { name: 'Nickel',     number: 28, role: 'Trace element in enzymes', sources: ['Chocolate', 'Nuts'] },
  Cu: { name: 'Copper',     number: 29, role: 'Iron metabolism & connective tissue', sources: ['Liver', 'Shellfish', 'Seeds'] },
  Zn: { name: 'Zinc',       number: 30, role: 'Immune function & wound healing', sources: ['Oysters', 'Beef', 'Pumpkin seeds'] },
  Se: { name: 'Selenium',   number: 34, role: 'Thyroid function & antioxidant', sources: ['Brazil nuts', 'Fish', 'Eggs'] },
  I:  { name: 'Iodine',     number: 53, role: 'Thyroid hormone production', sources: ['Seaweed', 'Fish', 'Iodized salt'] },
  Au: { name: 'Gold',       number: 79, role: 'Used in medical treatments', sources: [] },
};

// ── Color themes (expanded) ──
const COLOR_THEMES = {
  green:  { head: '#00ff41', trail: '#00cc33', dim: '#004d14', glow: 'rgba(0, 255, 65, 0.6)' },
  cyan:   { head: '#00f5ff', trail: '#00bcd4', dim: '#004d57', glow: 'rgba(0, 245, 255, 0.6)' },
  amber:  { head: '#ffb300', trail: '#ff8f00', dim: '#4d3600', glow: 'rgba(255, 179, 0, 0.6)' },
  purple: { head: '#bf5af2', trail: '#9b59b6', dim: '#3d1f5c', glow: 'rgba(191, 90, 242, 0.6)' },
  blood:  { head: '#ff3b30', trail: '#cc2d25', dim: '#4d110d', glow: 'rgba(255, 59, 48, 0.6)' },
  gold:   { head: '#ffd700', trail: '#daa520', dim: '#4d4000', glow: 'rgba(255, 215, 0, 0.6)' },
  auto:   { head: '#00ff41', trail: '#00cc33', dim: '#004d14', glow: 'rgba(0, 255, 65, 0.6)' },
};

// ── Speed multipliers (base duration range in ms) ──
const SPEED_CONFIG = {
  slow:   { min: 8000, max: 14000, delayMax: 7000 },
  medium: { min: 4000, max: 8000,  delayMax: 5000 },
  fast:   { min: 2000, max: 5000,  delayMax: 3000 },
  ultra:  { min: 1000, max: 3000,  delayMax: 1500 },
};

// ── Density → number of columns ──
const DENSITY_CONFIG = {
  sparse:  8,
  normal:  14,
  dense:   18,
  maximum: 24,
};

// ── Single falling stream column ──
interface StreamProps {
  columnIndex: number;
  totalColumns: number;
  colorTheme: keyof typeof COLOR_THEMES;
  intensity: 'full' | 'reduced';
  speed: keyof typeof SPEED_CONFIG;
  elementPool: string[];
  onElementTap: (symbol: string, x: number, y: number) => void;
}

function MatrixStream({ columnIndex, totalColumns, colorTheme, intensity, speed: speedKey, elementPool, onElementTap }: StreamProps) {
  const columnWidth = SCREEN_WIDTH / totalColumns;
  const xPos = columnIndex * columnWidth;
  const speedCfg = SPEED_CONFIG[speedKey] || SPEED_CONFIG.medium;

  // Random stream properties
  const streamLength = useMemo(() => Math.floor(Math.random() * 4) + 4, []); // 4-7 symbols
  const speed = useMemo(() =>
    Math.random() * (speedCfg.max - speedCfg.min) + speedCfg.min,
  [speedCfg]);
  const delay = useMemo(() => Math.random() * speedCfg.delayMax, [speedCfg]);
  const fontSize = useMemo(() => Math.floor(Math.random() * 6) + 12, []); // 12-17px

  // Generate random elements for this stream
  const symbols = useMemo(() => {
    const result: string[] = [];
    for (let i = 0; i < streamLength; i++) {
      result.push(elementPool[Math.floor(Math.random() * elementPool.length)]);
    }
    return result;
  }, [streamLength, elementPool]);

  const streamHeight = streamLength * (fontSize + 4);
  const translateY = useRef(new Animated.Value(-streamHeight - 50)).current;
  const colors = COLOR_THEMES[colorTheme] || COLOR_THEMES.green;

  // Regenerate symbols when stream resets
  const [currentSymbols, setCurrentSymbols] = useState(symbols);

  const startAnimation = useCallback(() => {
    translateY.setValue(-streamHeight - 50);
    // Randomize symbols each cycle
    const newSymbols: string[] = [];
    for (let i = 0; i < streamLength; i++) {
      newSymbols.push(elementPool[Math.floor(Math.random() * elementPool.length)]);
    }
    setCurrentSymbols(newSymbols);

    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT + 50,
      duration: speed + Math.random() * 1500,
      useNativeDriver: true,
      delay: Math.random() * 800,
    }).start(() => {
      startAnimation(); // Loop
    });
  }, [speed, streamLength, elementPool, streamHeight]);

  useEffect(() => {
    const timer = setTimeout(startAnimation, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.stream,
        {
          left: xPos + (columnWidth - fontSize) / 2,
          transform: [{ translateY }],
        },
      ]}
    >
      {currentSymbols.map((sym, i) => {
        const isHead = i === currentSymbols.length - 1;
        const isFresh = i >= currentSymbols.length - 2;
        const opacity = isHead ? 1 : isFresh ? 0.8 : Math.max(0.1, 0.6 - (currentSymbols.length - 1 - i) * 0.12);
        const color = isHead ? colors.head : isFresh ? colors.trail : colors.dim;
        const shadow = isHead ? colors.glow : 'transparent';

        return (
          <TouchableWithoutFeedback key={`${i}-${sym}`} onPress={() => onElementTap(sym, xPos, 0)}>
            <Text
              style={[
                styles.symbol,
                {
                  fontSize,
                  color,
                  opacity,
                  textShadowColor: shadow,
                  textShadowRadius: isHead ? 12 : isFresh ? 6 : 0,
                  fontWeight: isHead ? '900' : isFresh ? '700' : '400',
                },
              ]}
            >
              {sym}
            </Text>
          </TouchableWithoutFeedback>
        );
      })}
    </Animated.View>
  );
}

// ── Element Info Modal ──
function ElementInfoModal({ symbol, visible, onClose, colorTheme }: {
  symbol: string | null; visible: boolean; onClose: () => void; colorTheme: keyof typeof COLOR_THEMES;
}) {
  const info = symbol ? ELEMENT_INFO[symbol] : null;
  const colors = COLOR_THEMES[colorTheme] || COLOR_THEMES.green;

  if (!info || !symbol) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.infoCard}>
          {/* Glow header */}
          <View style={[styles.infoHeaderGlow, { backgroundColor: colors.head + '08' }]} />

          <View style={styles.infoHeader}>
            <View style={[styles.infoSymbolBox, { borderColor: colors.head + '40' }]}>
              <Text style={[styles.infoNumber, { color: colors.trail }]}>{info.number}</Text>
              <Text style={[styles.infoSymbol, { color: colors.head, textShadowColor: colors.glow, textShadowRadius: 15 }]}>
                {symbol}
              </Text>
            </View>
            <View style={styles.infoHeaderText}>
              <Text style={styles.infoName}>{info.name}</Text>
              <Text style={styles.infoRole}>{info.role}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.infoCloseBtn}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Food sources */}
          {info.sources.length > 0 && (
            <View style={styles.infoSection}>
              <Text style={[styles.infoSectionTitle, { color: colors.trail }]}>
                <Ionicons name="restaurant" size={13} color={colors.trail} /> Food Sources
              </Text>
              <View style={styles.infoChipsRow}>
                {info.sources.map((src, i) => (
                  <View key={i} style={[styles.infoChip, { borderColor: colors.head + '20' }]}>
                    <Text style={[styles.infoChipText, { color: colors.trail }]}>{src}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Matrix decoration */}
          <View style={styles.infoMatrixDecor}>
            {['H', 'C', 'N', 'O', 'Fe', 'Ca', 'Mg', 'K'].map((el, i) => (
              <Text key={i} style={[styles.infoDecorChar, { color: colors.dim, opacity: 0.3 + (i % 3) * 0.15 }]}>
                {el}
              </Text>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main Matrix Rain Background ──
interface MatrixRainProps {
  colorTheme?: keyof typeof COLOR_THEMES;
  intensity?: 'full' | 'reduced';
  speed?: keyof typeof SPEED_CONFIG;
  density?: keyof typeof DENSITY_CONFIG;
  priorityElements?: Record<string, number>;
  overlay?: boolean;
}

export default function MatrixRainBackground({
  colorTheme = 'green',
  intensity = 'full',
  speed = 'medium',
  density = 'normal',
  priorityElements = {},
  overlay = true,
}: MatrixRainProps) {
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const numColumns = DENSITY_CONFIG[density] || DENSITY_CONFIG.normal;

  // Build weighted element pool based on priority
  const elementPool = useMemo(() => {
    const pool: string[] = [...BIO_ELEMENTS];

    // Add priority elements extra times (deficient elements appear more)
    Object.entries(priorityElements).forEach(([element, weight]) => {
      if (weight > 0) {
        const extraCount = Math.min(Math.floor(weight * 5), 10);
        for (let i = 0; i < extraCount; i++) {
          pool.push(element);
        }
      }
    });

    // Add some rare/decorative elements for visual diversity
    pool.push(...['Au', 'Ti', 'Li', 'Si', 'V', 'Cr']);

    return pool;
  }, [priorityElements]);

  const handleElementTap = useCallback((symbol: string, x: number, y: number) => {
    if (ELEMENT_INFO[symbol]) {
      setSelectedElement(symbol);
    }
  }, []);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Rain columns */}
      {Array.from({ length: numColumns }).map((_, i) => (
        <MatrixStream
          key={`col-${i}`}
          columnIndex={i}
          totalColumns={numColumns}
          colorTheme={colorTheme}
          intensity={intensity}
          speed={speed}
          elementPool={elementPool}
          onElementTap={handleElementTap}
        />
      ))}

      {/* Dark overlay for readability */}
      {overlay && <View style={styles.overlay} pointerEvents="none" />}

      {/* Element Info Modal */}
      <ElementInfoModal
        symbol={selectedElement}
        visible={!!selectedElement}
        onClose={() => setSelectedElement(null)}
        colorTheme={colorTheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    overflow: 'hidden',
    zIndex: 0,
  },
  stream: {
    position: 'absolute',
    top: 0,
    alignItems: 'center',
  },
  symbol: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    textAlign: 'center',
    lineHeight: 20,
    textShadowOffset: { width: 0, height: 0 },
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  infoCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#080810',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 65, 0.15)',
    overflow: 'hidden',
  },
  infoHeaderGlow: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoSymbolBox: {
    width: 64,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoNumber: {
    fontSize: 10,
    fontWeight: '600',
    position: 'absolute',
    top: 6,
    left: 8,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  infoSymbol: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    textShadowOffset: { width: 0, height: 0 },
  },
  infoHeaderText: {
    flex: 1,
    marginLeft: 16,
  },
  infoName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  infoRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    lineHeight: 18,
  },
  infoCloseBtn: {
    padding: 4,
  },
  infoSection: {
    marginTop: 8,
  },
  infoSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  infoChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 255, 65, 0.04)',
    borderWidth: 1,
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoMatrixDecor: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  infoDecorChar: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 11,
    fontWeight: '600',
  },
});
