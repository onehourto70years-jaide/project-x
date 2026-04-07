import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image, Animated, TouchableOpacity } from 'react-native';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { useLanguage } from '../src/LanguageContext';
import { SUPPORTED_LOCALES, Locale } from '../src/i18n';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Index() {
  const { user, isLoading } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const [policyAccepted, setPolicyAccepted] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [languageSelected, setLanguageSelected] = useState<boolean | null>(null);
  const [selectedLang, setSelectedLang] = useState<Locale>(locale);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [splashDone, setSplashDone] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];

  // Show splash for 2.5 seconds
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => {
        setSplashDone(true);
      });
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

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
    return (
      <View style={styles.splashContainer}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <Image
            source={require('../assets/jaide-logo.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>
    );
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
    backgroundColor: '#080818',
  },
  splashLogo: {
    width: 220,
    height: 220,
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
