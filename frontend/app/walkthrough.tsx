import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Dimensions, Animated, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/ThemeContext';
import { hapticLight, hapticSuccess } from '../src/haptics';

const { width: SW, height: SH } = Dimensions.get('window');

interface WalkthroughStep {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgGlow: string;
  title: string;
  subtitle: string;
  description: string;
  tip: string;
}

const STEPS: WalkthroughStep[] = [
  {
    icon: 'grid',
    iconColor: '#00d4ff',
    bgGlow: 'rgba(0, 212, 255, 0.12)',
    title: 'Dashboard',
    subtitle: 'Il tuo centro di controllo',
    description: 'La Home mostra il tuo punteggio salute, macro giornalieri, streak e insight AI di JAIDE — tutto in un colpo d\'occhio.',
    tip: 'Premi a lungo su un widget per personalizzare la dashboard.',
  },
  {
    icon: 'nutrition',
    iconColor: '#00ff88',
    bgGlow: 'rgba(0, 255, 136, 0.12)',
    title: 'Nutrizione',
    subtitle: 'Cerca & analizza',
    description: 'Cerca qualsiasi alimento e scopri la sua composizione molecolare completa: 72+ nutrienti, elementi, fitochimici e indice glicemico.',
    tip: 'Usa la fotocamera per analizzare il tuo piatto con l\'AI.',
  },
  {
    icon: 'water',
    iconColor: '#00b4d8',
    bgGlow: 'rgba(0, 180, 216, 0.12)',
    title: 'Idratazione',
    subtitle: 'Monitora ogni sorso',
    description: 'Il sistema di Hydration Intelligence calcola il tuo fabbisogno idrico giornaliero in base a peso, attività e qualità del sonno.',
    tip: 'Aggiungi velocemente acqua con i pulsanti rapidi.',
  },
  {
    icon: 'calendar',
    iconColor: '#a29bfe',
    bgGlow: 'rgba(162, 155, 254, 0.12)',
    title: 'Routine',
    subtitle: 'Abitudini salutari',
    description: 'Crea e monitora routine quotidiane: sonno, esercizio, meditazione e integratori. Il sistema adattivo impara dai tuoi pattern.',
    tip: 'Attiva le notifiche per non dimenticare le routine.',
  },
  {
    icon: 'sparkles',
    iconColor: '#ffd93d',
    bgGlow: 'rgba(255, 217, 61, 0.12)',
    title: 'JAIDE',
    subtitle: 'La tua guida AI celestiale',
    description: 'JAIDE osserva i tuoi dati e ti offre insight personalizzati, celebra i tuoi traguardi e ti guida verso decisioni alimentari migliori.',
    tip: 'Chatta con JAIDE nella sezione AI per consigli personalizzati.',
  },
  {
    icon: 'flask',
    iconColor: '#ff6b6b',
    bgGlow: 'rgba(255, 107, 107, 0.12)',
    title: 'Motore Molecolare',
    subtitle: 'Oltre i macronutrienti',
    description: 'NutriOS va oltre calorie e proteine: analizza la composizione elementale atomica del cibo, sinergie e conflitti tra nutrienti.',
    tip: 'Esplora il Body State per vedere come il cibo influenza il tuo corpo.',
  },
];

export default function WalkthroughScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    iconScale.setValue(0.5);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    animateIn();
    // Glow pulsing loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    animateIn();
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / STEPS.length,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const handleNext = () => {
    hapticLight();
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = async () => {
    hapticLight();
    await AsyncStorage.setItem('walkthrough_completed', 'true');
    router.replace('/(tabs)');
  };

  const handleComplete = async () => {
    hapticSuccess();
    await AsyncStorage.setItem('walkthrough_completed', 'true');
    router.replace('/(tabs)');
  };

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.stepCounter, { color: theme.textMuted }]}>
            {currentStep + 1} / {STEPS.length}
          </Text>
        </View>
        {!isLast && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: theme.textMuted }]}>Salta</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: theme.bgInput }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: step.iconColor,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              backgroundColor: step.bgGlow,
              opacity: glowAnim.interpolate({
                inputRange: [0.4, 1],
                outputRange: [0.6, 1],
              }),
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          <View style={[styles.iconInner, { backgroundColor: step.bgGlow }]}>
            <Ionicons name={step.icon} size={56} color={step.iconColor} />
          </View>
        </Animated.View>

        {/* Text */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={[styles.title, { color: theme.text }]}>{step.title}</Text>
          <Text style={[styles.subtitle, { color: step.iconColor }]}>{step.subtitle}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {step.description}
          </Text>

          {/* Tip Card */}
          <View style={[styles.tipCard, { backgroundColor: theme.bgCard, borderColor: step.iconColor + '30' }]}>
            <Ionicons name="bulb" size={18} color={step.iconColor} />
            <Text style={[styles.tipText, { color: theme.textSecondary }]}>{step.tip}</Text>
          </View>
        </Animated.View>
      </View>

      {/* Step Dots */}
      <View style={styles.dotsRow}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === currentStep ? step.iconColor : theme.bgInput,
                width: i === currentStep ? 24 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* Bottom Actions */}
      <View style={[styles.bottomBar, { backgroundColor: theme.bg }]}>
        {currentStep > 0 && (
          <TouchableOpacity
            onPress={() => { hapticLight(); setCurrentStep(currentStep - 1); }}
            style={[styles.backBtn, { backgroundColor: theme.bgCard }]}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleNext}
          style={[
            styles.nextBtn,
            { backgroundColor: step.iconColor },
            currentStep === 0 && { flex: 1 },
          ]}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>
            {isLast ? 'Inizia a usare NutriOS' : 'Avanti'}
          </Text>
          <Ionicons
            name={isLast ? 'rocket' : 'arrow-forward'}
            size={20}
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  stepCounter: { fontSize: 14, fontWeight: '600' },
  skipBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingLeft: 12 },
  skipText: { fontSize: 14, fontWeight: '500', marginRight: 2 },

  // Progress
  progressTrack: { height: 3, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },

  // Content
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },

  // Icon
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  iconInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Text
  textContainer: { alignItems: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 24, textAlign: 'center', marginBottom: 24 },

  // Tip
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    width: '100%',
  },
  tipText: { fontSize: 13, lineHeight: 19, flex: 1 },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  dot: { height: 8, borderRadius: 4 },

  // Bottom
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    paddingTop: 12,
    gap: 12,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    height: 56,
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
