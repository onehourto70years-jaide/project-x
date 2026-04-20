/**
 * NutriOS Achievement Celebration Overlay
 * Bio-system feedback moment — not a game reward.
 * Molecular particles, pulsing glow, system-style messaging.
 */
import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
  Dimensions, Modal, Platform, Share, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCelebration } from '../CelebrationContext';
import { useTheme } from '../ThemeContext';
import { hapticSuccess } from '../haptics';

const { width: W, height: H } = Dimensions.get('window');
const NUM_PARTICLES = 14;

/* ── Single Molecular Particle ── */
function Particle({ delay, color, size }: { delay: number; color: string; size: number }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  const startX = useMemo(() => Math.random() * W, []);
  const startY = useMemo(() => H * 0.35 + Math.random() * H * 0.3, []);
  const driftX = useMemo(() => (Math.random() - 0.5) * 100, []);
  const driftY = useMemo(() => -(30 + Math.random() * 80), []);
  const dur = useMemo(() => 2200 + Math.random() * 1200, []);

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.6, duration: 350, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 350, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(translateX, { toValue: driftX, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: driftY, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: dur, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.2, duration: dur, useNativeDriver: true }),
      ]),
    ]);
    const looped = Animated.loop(anim);
    looped.start();
    return () => looped.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.particle,
        {
          left: startX, top: startY,
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
        },
      ]}
    />
  );
}

/* ── Main Overlay ── */
export default function CelebrationOverlay() {
  const { isVisible, currentBadge, dismiss, trackAction } = useCelebration();
  const { theme } = useTheme();

  // Animations — ALL hooks MUST be above any conditional return
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.3)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.2)).current;
  const glowOuterAnim = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslateY = useRef(new Animated.Value(30)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const glowRef = useRef<Animated.CompositeAnimation | null>(null);

  // Particles memo — MUST be above early return to respect hook ordering
  const badgeColor = currentBadge?.color || '#00d4ff';
  const particles = useMemo(() =>
    Array.from({ length: NUM_PARTICLES }).map((_, i) => ({
      key: `p-${i}`,
      delay: 150 + i * 130,
      color: i % 3 === 0 ? badgeColor : i % 3 === 1 ? `${badgeColor}88` : (theme?.accent || '#00d4ff'),
      size: 3 + Math.random() * 5,
    })), [badgeColor, theme?.accent]);

  useEffect(() => {
    if (isVisible && currentBadge) {
      try { hapticSuccess(); } catch (_) {}

      // Reset all values
      overlayOpacity.setValue(0);
      badgeScale.setValue(0.3);
      badgeOpacity.setValue(0);
      glowAnim.setValue(0.2);
      glowOuterAnim.setValue(0);
      textOpacity.setValue(0);
      textTranslateY.setValue(20);
      ctaOpacity.setValue(0);
      ctaTranslateY.setValue(30);

      // Main animation sequence
      animRef.current = Animated.sequence([
        // 1. Fade in overlay
        Animated.timing(overlayOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        // 2. Badge appears (timing instead of spring for sequence reliability)
        Animated.parallel([
          Animated.timing(badgeScale, {
            toValue: 1, duration: 500,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }),
          Animated.timing(badgeOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        ]),
        // 3. Text appears
        Animated.parallel([
          Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(textTranslateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        // 4. CTAs appear
        Animated.parallel([
          Animated.timing(ctaOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(ctaTranslateY, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]);
      animRef.current.start();

      // Continuous glow pulse (separate from sequence)
      glowRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(glowAnim, { toValue: 0.7, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glowOuterAnim, { toValue: 0.3, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(glowAnim, { toValue: 0.2, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glowOuterAnim, { toValue: 0.05, duration: 1200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ])
      );
      glowRef.current.start();
    } else {
      // Stop animations when hidden
      animRef.current?.stop();
      glowRef.current?.stop();
    }
    return () => {
      animRef.current?.stop();
      glowRef.current?.stop();
    };
  }, [isVisible, currentBadge]);

  const fadeOutAndDismiss = (action: string) => {
    trackAction(action);
    animRef.current?.stop();
    glowRef.current?.stop();
    Animated.timing(overlayOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => dismiss());
  };

  const handleContinue = () => fadeOutAndDismiss('continued');
  const handleSkip = () => fadeOutAndDismiss('skipped');

  const handleShare = async () => {
    trackAction('shared');
    if (!currentBadge) return;
    try {
      const shareText = `• System Update: ${currentBadge.name}\n• ${currentBadge.systemMessage}\n• ${currentBadge.statLabel}: ${currentBadge.statValue}\n\nOptimized with NutriOS 🧬`;
      await Share.share({ message: shareText, title: `NutriOS — ${currentBadge.name}` });
    } catch (_) { /* user cancelled */ }
  };

  // Early return AFTER all hooks
  if (!currentBadge || !isVisible) return null;

  return (
    <Modal visible={isVisible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        {/* Skip button */}
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Ionicons name="close" size={22} color="rgba(255,255,255,0.4)" />
        </TouchableOpacity>

        {/* Molecular Particles */}
        {particles.map(p => (
          <Particle key={p.key} delay={p.delay} color={p.color} size={p.size} />
        ))}

        {/* Pulsing Glow behind badge — using separate animated values */}
        <Animated.View style={[
          styles.glowRing,
          { opacity: glowAnim, borderColor: badgeColor, shadowColor: badgeColor },
        ]} />
        <Animated.View style={[
          styles.glowRingOuter,
          { opacity: glowOuterAnim, borderColor: badgeColor },
        ]} />

        {/* Badge Icon — "System Unlock" */}
        <Animated.View style={[
          styles.badgeContainer,
          { opacity: badgeOpacity, transform: [{ scale: badgeScale }] },
        ]}>
          <Image source={require('../../assets/jaide/jaide-cartoon.png')} style={styles.jaideAvatar} />
          <View style={[styles.badgeCircle, { borderColor: `${badgeColor}60`, backgroundColor: `${badgeColor}12` }]}>
            <View style={[styles.badgeInner, { backgroundColor: `${badgeColor}20` }]}>
              <Ionicons name={(currentBadge.icon || 'trophy') as any} size={36} color={badgeColor} />
            </View>
          </View>
        </Animated.View>

        {/* System Message */}
        <Animated.View style={[
          styles.textBlock,
          { opacity: textOpacity, transform: [{ translateY: textTranslateY }] },
        ]}>
          <Text style={styles.systemLabel}>JAIDE OBSERVES</Text>
          <Text style={[styles.badgeName, { color: badgeColor }]}>{currentBadge.name}</Text>
          <Text style={styles.systemMessage}>{currentBadge.systemMessage}</Text>
          <Text style={styles.jaideQuote}>"Growth detected. You are becoming more aligned."</Text>
          <View style={[styles.statPill, { backgroundColor: `${badgeColor}14`, borderColor: `${badgeColor}30` }]}>
            <View style={[styles.statDot, { backgroundColor: badgeColor }]} />
            <Text style={[styles.statText, { color: badgeColor }]}>
              {currentBadge.statLabel}: {currentBadge.statValue}
            </Text>
          </View>
        </Animated.View>

        {/* CTAs */}
        <Animated.View style={[
          styles.ctaBlock,
          { opacity: ctaOpacity, transform: [{ translateY: ctaTranslateY }] },
        ]}>
          <TouchableOpacity style={[styles.primaryCta, { backgroundColor: badgeColor }]} onPress={handleContinue} activeOpacity={0.8}>
            <Ionicons name="arrow-forward" size={18} color="#000" />
            <Text style={styles.primaryCtaText}>Continue Optimization</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryCta, { borderColor: `${badgeColor}40` }]} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={16} color={badgeColor} />
            <Text style={[styles.secondaryCtaText, { color: badgeColor }]}>Share Progress</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 4, 18, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
  },
  glowRing: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 10,
  },
  glowRingOuter: {
    position: 'absolute',
    width: 240, height: 240, borderRadius: 120,
    borderWidth: 0.5,
  },
  badgeContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  jaideAvatar: {
    width: 48, height: 48, borderRadius: 24, marginBottom: 12,
    borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.4)',
  },
  badgeCircle: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  badgeInner: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  textBlock: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 40,
  },
  systemLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 10,
  },
  badgeName: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  systemMessage: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  jaideQuote: {
    fontSize: 13,
    color: 'rgba(0, 212, 255, 0.7)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  statDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
  },
  ctaBlock: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingHorizontal: 40,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  secondaryCtaText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
