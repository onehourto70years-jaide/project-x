import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from './_layout';
import { useLanguage } from '../src/LanguageContext';
import { SUPPORTED_LOCALES, Locale } from '../src/i18n';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const { width: SW, height: SH } = Dimensions.get('window');

// ── Molecular Splash Elements ──
const SPLASH_ELEMENTS = [
  { symbol: 'H', x: 0.15, y: 0.25, size: 28, delay: 200 },
  { symbol: 'C', x: 0.75, y: 0.2, size: 24, delay: 400 },
  { symbol: 'O', x: 0.85, y: 0.55, size: 26, delay: 300 },
  { symbol: 'N', x: 0.1, y: 0.6, size: 22, delay: 500 },
  { symbol: 'Fe', x: 0.25, y: 0.78, size: 20, delay: 600 },
  { symbol: 'Ca', x: 0.7, y: 0.75, size: 20, delay: 700 },
  { symbol: 'Mg', x: 0.5, y: 0.18, size: 18, delay: 800 },
  { symbol: 'K', x: 0.9, y: 0.35, size: 18, delay: 450 },
  { symbol: 'Zn', x: 0.08, y: 0.42, size: 16, delay: 550 },
  { symbol: 'Na', x: 0.6, y: 0.82, size: 16, delay: 650 },
  { symbol: 'P', x: 0.38, y: 0.88, size: 17, delay: 350 },
  { symbol: 'S', x: 0.82, y: 0.12, size: 17, delay: 750 },
];

function SplashElement({ symbol, x, y, size, delay }: { symbol: string; x: number; y: number; size: number; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.25, duration: 600, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
      ]),
    ]).start(() => {
      // Gentle float animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.12, duration: 2000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <Animated.Text style={{
      position: 'absolute',
      left: x * SW,
      top: y * SH,
      fontSize: size,
      fontWeight: '700',
      color: '#00d4ff',
      opacity,
      transform: [{ scale }],
      fontFamily: 'monospace',
    }}>
      {symbol}
    </Animated.Text>
  );
}

function NutriOSSplash({ onFinish }: { onFinish: () => void }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const lineWidth = useRef(new Animated.Value(0)).current;
  const exitOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide the native splash now that our branded splash is rendering
    SplashScreen.hideAsync().catch(() => {});

    // Staggered entrance: elements → logo → tagline → line → exit
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      ]),
      Animated.delay(200),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(lineWidth, { toValue: 1, duration: 600, useNativeDriver: false }),
      Animated.delay(800),
      Animated.timing(exitOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.splashContainer, { opacity: exitOpacity }]}>
      {/* Floating elements */}
      {SPLASH_ELEMENTS.map((el, i) => (
        <SplashElement key={i} {...el} />
      ))}

      {/* Center content */}
      <View style={styles.splashCenter}>
        {/* Logo icon */}
        <Animated.View style={[styles.splashLogoCircle, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <Ionicons name="flask" size={48} color="#00d4ff" />
        </Animated.View>

        {/* App name */}
        <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
          <Text style={styles.splashTitle}>Nutri<Text style={styles.splashTitleAccent}>OS</Text></Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.Text style={[styles.splashTagline, { opacity: taglineOpacity }]}>
          Your Nutrition Operating System
        </Animated.Text>

        {/* Animated line */}
        <View style={styles.splashLineTrack}>
          <Animated.View style={[styles.splashLineFill, {
            width: lineWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
      </View>

      {/* Version */}
      <Animated.Text style={[styles.splashVersion, { opacity: taglineOpacity }]}>v1.0</Animated.Text>
    </Animated.View>
  );
}

export default function Index() {
  const { user, isLoading } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const [policyAccepted, setPolicyAccepted] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [languageSelected, setLanguageSelected] = useState<boolean | null>(null);
  const [selectedLang, setSelectedLang] = useState<Locale>(locale);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('language_selected'),
      AsyncStorage.getItem('privacy_policy_accepted'),
      AsyncStorage.getItem('onboarding_completed'),
    ]).then(([langVal, policyVal, onboardingVal]) => {
      setLanguageSelected(langVal === 'true');
      setPolicyAccepted(policyVal === 'true');
      setOnboardingDone(onboardingVal === 'true');
    });
  }, []);

  // Check payment/trial status once user is logged in
  useEffect(() => {
    if (!user) {
      setHasAccess(null);
      return;
    }
    const checkAccess = async () => {
      try {
        const token = await AsyncStorage.getItem('session_token');
        if (!token) { setHasAccess(false); return; }
        const res = await fetch(`${BACKEND_URL}/api/payments/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setHasAccess(data.has_access);
        } else {
          setHasAccess(true);
        }
      } catch (e) {
        setHasAccess(true);
      }
    };
    checkAccess();
  }, [user]);

  const handleLanguageContinue = async () => {
    await setLocale(selectedLang);
    await AsyncStorage.setItem('language_selected', 'true');
    setLanguageSelected(true);
  };

  // Show splash screen first
  if (!splashDone) {
    return <NutriOSSplash onFinish={() => setSplashDone(true)} />;
  }

  // Still checking
  if (languageSelected === null || policyAccepted === null || onboardingDone === null || isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00d4ff" />
      </View>
    );
  }

  // ── LANGUAGE SELECTION (inline — no navigation needed) ──
  if (!languageSelected) {
    return (
      <View style={styles.langContainer}>
        <View style={styles.langContent}>
          <View style={styles.langIconWrap}>
            <View style={styles.langIconCircle}>
              <Ionicons name="language" size={40} color="#00d4ff" />
            </View>
          </View>
          <Text style={styles.langTitle}>{t('lang_title')}</Text>
          <Text style={styles.langSubtitle}>Scegli · Elige · Choisissez</Text>

          <View style={styles.langList}>
            {SUPPORTED_LOCALES.map((lang) => {
              const isActive = selectedLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOption, isActive && styles.langOptionActive]}
                  onPress={() => {
                    setSelectedLang(lang.code);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.langFlag}>{lang.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.langLabel, isActive && styles.langLabelActive]}>{lang.nativeName}</Text>
                    <Text style={styles.langSub}>{lang.label}</Text>
                  </View>
                  {isActive && (
                    <View style={styles.langCheck}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.langNote}>{t('lang_subtitle')}</Text>

          <TouchableOpacity style={styles.langContinueBtn} onPress={handleLanguageContinue} activeOpacity={0.8}>
            <Text style={styles.langContinueText}>{t('lang_continue')}</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!policyAccepted) {
    return <Redirect href="/(auth)/privacy-policy" />;
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  // Onboarding check — after auth, before payment gate
  if (!onboardingDone) {
    return <Redirect href="/onboarding" />;
  }

  if (hasAccess === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00d4ff" />
      </View>
    );
  }

  if (!hasAccess) {
    return <Redirect href="/upgrade" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#080818',
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#040410',
  },
  splashCenter: {
    alignItems: 'center',
    zIndex: 10,
  },
  splashLogoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  splashTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 2,
  },
  splashTitleAccent: {
    color: '#00d4ff',
  },
  splashTagline: {
    fontSize: 14,
    color: '#556',
    marginTop: 8,
    letterSpacing: 1,
    fontWeight: '500',
  },
  splashLineTrack: {
    width: 120,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 1,
    marginTop: 20,
    overflow: 'hidden',
  },
  splashLineFill: {
    height: '100%',
    backgroundColor: '#00d4ff',
    borderRadius: 1,
  },
  splashVersion: {
    position: 'absolute',
    bottom: 40,
    color: '#333',
    fontSize: 12,
    fontWeight: '500',
  },
  // Language selection
  langContainer: {
    flex: 1,
    backgroundColor: '#080818',
  },
  langContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  langIconWrap: {
    alignItems: 'center',
    marginBottom: 24,
  },
  langIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,212,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(0,212,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  langSubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  langList: {
    gap: 10,
    marginBottom: 20,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 14,
  },
  langOptionActive: {
    borderColor: '#00d4ff',
    backgroundColor: 'rgba(0,212,255,0.06)',
  },
  langFlag: {
    fontSize: 32,
  },
  langLabel: {
    color: '#ccc',
    fontSize: 17,
    fontWeight: '700',
  },
  langLabelActive: {
    color: '#fff',
  },
  langSub: {
    color: '#666',
    fontSize: 13,
    marginTop: 2,
  },
  langCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#00d4ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langNote: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
  },
  langContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00d4ff',
    borderRadius: 16,
    paddingVertical: 16,
  },
  langContinueText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
