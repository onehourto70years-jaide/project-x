import React, { useRef, useEffect } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  size: number; strokeWidth: number; progress: number;
  colors: string[]; label: string; value: string; unit: string; icon: string;
}

export default function ProgressRing({ size, strokeWidth, progress, colors, label, value, unit, icon }: Props) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  useEffect(() => {
    Animated.timing(animatedValue, { toValue: clampedProgress, duration: 1200, useNativeDriver: false }).start();
  }, [clampedProgress]);

  const strokeDashoffset = circumference - (circumference * clampedProgress) / 100;
  const gradientId = `grad-${label.replace(/\s/g, '')}`;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors[0]} />
              <Stop offset="100%" stopColor={colors[1] || colors[0]} />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none" />
          <Circle cx={size / 2} cy={size / 2} r={radius} stroke={`url(#${gradientId})`} strokeWidth={strokeWidth} fill="none"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
            rotation="-90" origin={`${size / 2}, ${size / 2}`} />
        </Svg>
        <View style={{ alignItems: 'center' }}>
          <Ionicons name={icon as any} size={size > 100 ? 22 : 16} color={colors[0]} />
          <Text style={[s.val, { fontSize: size > 100 ? 20 : 14 }]}>{value}</Text>
          <Text style={[s.unit, { fontSize: size > 100 ? 11 : 9 }]}>{unit}</Text>
        </View>
      </View>
      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  val: { fontWeight: 'bold', color: '#fff', marginTop: 2 },
  unit: { color: '#666' },
  label: { color: '#888', fontSize: 11, marginTop: 6, fontWeight: '500' },
});
