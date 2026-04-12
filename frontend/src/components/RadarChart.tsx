/**
 * RadarChart — Custom SVG Radar/Spider Chart for NutriOS
 * Supports: color-coded zones, interactive touch points, theme-aware
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Polygon, Line, Circle, G, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface NutrientPoint {
  key: string;
  name: string;
  pct_rda: number;
  status: string;
  color: string;
  daily_avg: number;
  rda: number;
  unit: string;
  ul: number | null;
  key_role: string;
  group: string;
}

interface RadarChartProps {
  data: NutrientPoint[];
  size?: number;
  onPointPress?: (point: NutrientPoint) => void;
  theme: any;
}

const LEVELS = [25, 50, 75, 100]; // Percentage grid lines

export default function RadarChart({ data, size, onPointPress, theme }: RadarChartProps) {
  const chartSize = size || Math.min(SCREEN_WIDTH - 48, 340);
  const center = chartSize / 2;
  const radius = center - 40; // Leave room for labels
  const numAxes = data.length;

  if (numAxes < 3) return null;

  const angleStep = (2 * Math.PI) / numAxes;
  const startAngle = -Math.PI / 2; // Start from top

  // Get x,y for a point at given angle and distance from center
  const getPoint = (index: number, value: number) => {
    const angle = startAngle + index * angleStep;
    const clampedValue = Math.min(value, 150); // Cap at 150% for display
    const dist = (clampedValue / 100) * radius;
    return {
      x: center + dist * Math.cos(angle),
      y: center + dist * Math.sin(angle),
    };
  };

  // Build grid polygons
  const gridPolygons = LEVELS.map(level => {
    const points = Array.from({ length: numAxes }, (_, i) => {
      const p = getPoint(i, level);
      return `${p.x},${p.y}`;
    }).join(' ');
    return points;
  });

  // Build data polygon
  const dataPoints = data.map((d, i) => getPoint(i, d.pct_rda));
  const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Label positions (slightly outside the chart)
  const labelPoints = data.map((_, i) => {
    const angle = startAngle + i * angleStep;
    const dist = radius + 28;
    return {
      x: center + dist * Math.cos(angle),
      y: center + dist * Math.sin(angle),
    };
  });

  // Get short name for label (max 6 chars)
  const shortName = (name: string) => {
    const shorts: Record<string, string> = {
      'Vitamin A': 'Vit A', 'Vitamin C': 'Vit C', 'Vitamin D': 'Vit D',
      'Vitamin E': 'Vit E', 'Vitamin K': 'Vit K', 'Vitamin B6': 'B6',
      'Vitamin B12': 'B12', 'Thiamin (B1)': 'B1', 'Riboflavin (B2)': 'B2',
      'Niacin (B3)': 'B3', 'Folate (B9)': 'B9', 'Calcium': 'Ca',
      'Iron': 'Fe', 'Magnesium': 'Mg', 'Zinc': 'Zn', 'Potassium': 'K',
      'Sodium': 'Na', 'Phosphorus': 'P', 'Selenium': 'Se', 'Copper': 'Cu',
      'Manganese': 'Mn', 'Fiber': 'Fiber',
    };
    return shorts[name] || name.slice(0, 5);
  };

  return (
    <View style={styles.container}>
      <Svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`}>
        {/* Grid levels */}
        {gridPolygons.map((points, i) => (
          <Polygon
            key={`grid-${i}`}
            points={points}
            fill="none"
            stroke={theme.borderLight || '#222'}
            strokeWidth={i === 3 ? 1.5 : 0.5} // 100% line is bolder
            strokeDasharray={i === 3 ? '' : '4,4'}
            opacity={i === 3 ? 0.6 : 0.3}
          />
        ))}

        {/* Axis lines */}
        {data.map((_, i) => {
          const end = getPoint(i, 100);
          return (
            <Line
              key={`axis-${i}`}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke={theme.borderLight || '#333'}
              strokeWidth={0.5}
              opacity={0.3}
            />
          );
        })}

        {/* Data polygon fill */}
        <Polygon
          points={dataPolygon}
          fill={theme.accent || '#00d4ff'}
          fillOpacity={0.12}
          stroke={theme.accent || '#00d4ff'}
          strokeWidth={2}
          strokeOpacity={0.6}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => (
          <Circle
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            r={5}
            fill={data[i].color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}

        {/* Axis labels */}
        {labelPoints.map((p, i) => (
          <SvgText
            key={`label-${i}`}
            x={p.x}
            y={p.y}
            fontSize={9}
            fontWeight="600"
            fill={data[i].color}
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {shortName(data[i].name)}
          </SvgText>
        ))}
      </Svg>

      {/* Touchable overlay points */}
      {dataPoints.map((p, i) => (
        <TouchableOpacity
          key={`touch-${i}`}
          style={[
            styles.touchPoint,
            {
              left: p.x - 16,
              top: p.y - 16,
            },
          ]}
          onPress={() => onPointPress?.(data[i])}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#34c759' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Optimal</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ffd60a' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Low</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ff453a' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Deficient</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#bf5af2' }]} />
          <Text style={[styles.legendText, { color: theme.textMuted }]}>Excess</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', position: 'relative' },
  touchPoint: { position: 'absolute', width: 32, height: 32, borderRadius: 16 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '500' },
});
