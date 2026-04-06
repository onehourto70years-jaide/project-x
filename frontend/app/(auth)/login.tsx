import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../src/LanguageContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  const handleGoogleLogin = async () => {
    try {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = Linking.createURL('/callback');
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
      
      if (Platform.OS === 'web') {
        window.location.href = authUrl;
      } else {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
        
        if (result.type === 'success' && result.url) {
          const url = new URL(result.url);
          const sessionId = url.hash.split('session_id=')[1]?.split('&')[0];
          
          if (sessionId) {
            router.replace({ pathname: '/(auth)/callback', params: { session_id: sessionId } });
          }
        }
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Branding */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="flask" size={60} color="#00d4ff" />
          </View>
          <Text style={styles.title}>NutriOS</Text>
          <Text style={styles.subtitle}>{t('login_subtitle')}</Text>
        </View>

        {/* Features */}
        <View style={styles.featuresSection}>
          <View style={styles.featureItem}>
            <Ionicons name="analytics" size={24} color="#00d4ff" />
            <Text style={styles.featureText}>{t('login_feature_1')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="nutrition" size={24} color="#00ff88" />
            <Text style={styles.featureText}>{t('login_feature_2')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="flame" size={24} color="#ff6b6b" />
            <Text style={styles.featureText}>{t('login_feature_3')}</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="bulb" size={24} color="#ffd93d" />
            <Text style={styles.featureText}>{t('login_feature_4')}</Text>
          </View>
        </View>

        {/* Login Button */}
        <View style={styles.loginSection}>
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <Ionicons name="logo-google" size={24} color="#fff" />
            <Text style={styles.googleButtonText}>{t('login_google')}</Text>
          </TouchableOpacity>
          
          <Text style={styles.disclaimer}>
            {t('login_disclaimer')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 60,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
  },
  featuresSection: {
    paddingHorizontal: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
  },
  featureText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 16,
  },
  loginSection: {
    paddingBottom: 40,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  disclaimer: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
