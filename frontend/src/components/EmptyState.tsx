import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EmptyStateProps {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  onCta?: () => void;
  small?: boolean;
}

export default function EmptyState({ icon, iconColor = '#00d4ff', title, subtitle, ctaLabel, onCta, small = false }: EmptyStateProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[
      styles.container,
      small && styles.containerSmall,
      { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
    ]}>
      <View style={[styles.iconCircle, { backgroundColor: iconColor + '10', borderColor: iconColor + '20' }]}>
        <Ionicons name={icon as any} size={small ? 32 : 44} color={iconColor} />
      </View>
      <Text style={[styles.title, small && styles.titleSmall]}>{title}</Text>
      <Text style={[styles.subtitle, small && styles.subtitleSmall]}>{subtitle}</Text>
      {ctaLabel && onCta && (
        <TouchableOpacity style={[styles.ctaBtn, { backgroundColor: iconColor + '15', borderColor: iconColor + '30' }]} onPress={onCta} activeOpacity={0.7}>
          <Ionicons name="add-circle" size={18} color={iconColor} />
          <Text style={[styles.ctaText, { color: iconColor }]}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  containerSmall: {
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  titleSmall: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 280,
  },
  subtitleSmall: {
    fontSize: 12,
    marginBottom: 16,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
