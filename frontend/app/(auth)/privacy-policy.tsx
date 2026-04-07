import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../../src/LanguageContext';

const POLICY_SECTIONS = [
  {
    title: '1. Introduction',
    body: 'Nutri OS uses and protects user data. The App provides food tracking, water tracking, and daily routine management features.\n\nBy using the App, users agree to the collection and use of information in accordance with this policy.',
  },
  {
    title: '2. Data We Collect',
    body: 'Personal Information\n• Email address\n• Account credentials (encrypted)\n\nUsage Data\n• Food intake logs\n• Water intake logs\n• Routine and schedule data\n• App interactions (e.g., features used)\n\nDevice Information\n• Device type\n• Operating system\n• App version',
  },
  {
    title: '3. How We Use Data',
    body: 'We use collected data to:\n• Provide and maintain app functionality\n• Generate personalized insights (e.g., hydration, nutrition patterns)\n• Improve user experience\n• Send reminders and notifications (if enabled)\n• Provide customer support',
  },
  {
    title: '4. Data Storage & Security',
    body: '• All data is transmitted using secure HTTPS protocols\n• Sensitive data is encrypted at rest where applicable\n• Passwords are securely hashed\n• Access to data is restricted to authorized systems only',
  },
  {
    title: '5. Data Sharing',
    body: 'We do NOT sell user data.\n\nWe may share data only with:\n• Service providers (e.g., cloud hosting, analytics)\n• Payment processors (if applicable)\n• Legal authorities if required by law',
  },
  {
    title: '6. User Rights (GDPR)',
    body: 'Users have the right to:\n• Access their data\n• Request correction\n• Request deletion of their account and data\n• Withdraw consent at any time\n\nRequests can be made via: onehourto70years@gmail.com',
  },
  {
    title: '7. Data Retention',
    body: 'We retain user data only as long as necessary to provide services.\n\nIf a user deletes their account:\n• All personal data is deleted within a reasonable timeframe',
  },
  {
    title: '8. Notifications',
    body: 'Users can enable or disable notifications at any time within the app or device settings.',
  },
  {
    title: "9. Children's Privacy",
    body: 'The App is not intended for children under 13 (or applicable local age). We do not knowingly collect data from children.',
  },
  {
    title: '10. Changes to This Policy',
    body: 'We may update this Privacy Policy. Users will be notified of significant changes.',
  },
  {
    title: '11. Contact',
    body: 'For questions or requests:\nEmail: onehourto70years@gmail.com',
  },
  {
    title: '12. Disclaimer',
    body: 'This app provides general wellness insights and does NOT provide medical advice.',
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
    if (isNearBottom && !scrolledToEnd) {
      setScrolledToEnd(true);
    }
  };

  const handleAgree = async () => {
    await AsyncStorage.setItem('privacy_policy_accepted', 'true');
    await AsyncStorage.setItem('privacy_policy_accepted_date', new Date().toISOString());
    router.replace('/(auth)/login');
  };

  const handleDecline = () => {
    // They can't use the app if they decline — just stay on this screen
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={28} color="#00d4ff" />
          </View>
          <Text style={styles.headerTitle}>{t('privacy_title')}</Text>
          <Text style={styles.headerSubtitle}>{t('privacy_read')}</Text>
        </View>

        {/* Policy Content */}
        <View style={styles.policyContainer}>
          <ScrollView
            style={styles.policyScroll}
            contentContainerStyle={styles.policyContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
          >
            <View style={styles.lastUpdated}>
              <Ionicons name="time-outline" size={14} color="#666" />
              <Text style={styles.lastUpdatedText}>Last updated: March 2026</Text>
            </View>

            {POLICY_SECTIONS.map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}

            <View style={styles.endSpacer} />
          </ScrollView>

          {/* Scroll indicator */}
          {!scrolledToEnd && (
            <View style={styles.scrollHint}>
              <Ionicons name="chevron-down" size={18} color="#00d4ff" />
              <Text style={styles.scrollHintText}>Scroll to read full policy</Text>
            </View>
          )}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline}>
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.agreeBtn, !scrolledToEnd && styles.agreeBtnDisabled]}
            onPress={handleAgree}
            disabled={!scrolledToEnd}
          >
            <Ionicons name="checkmark-circle" size={20} color={scrolledToEnd ? '#fff' : '#555'} />
            <Text style={[styles.agreeBtnText, !scrolledToEnd && styles.agreeBtnTextDisabled]}>
              {t('privacy_agree')}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  content: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  headerIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0, 212, 255, 0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.2)' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: '#888', marginTop: 4 },
  policyContainer: { flex: 1, position: 'relative' },
  policyScroll: { flex: 1 },
  policyContent: { padding: 20, paddingBottom: 40 },
  lastUpdated: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  lastUpdatedText: { color: '#666', fontSize: 12, marginLeft: 6 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#00d4ff', marginBottom: 8 },
  sectionBody: { fontSize: 14, color: '#bbb', lineHeight: 22 },
  endSpacer: { height: 20 },
  scrollHint: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, backgroundColor: 'rgba(8, 8, 24, 0.9)' },
  scrollHintText: { color: '#00d4ff', fontSize: 12, marginLeft: 4, fontWeight: '500' },
  bottomBar: { flexDirection: 'row', padding: 16, paddingBottom: Platform.OS === 'ios' ? 30 : 16, borderTopWidth: 1, borderTopColor: '#1a1a3e', backgroundColor: '#080818' },
  declineBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, backgroundColor: 'rgba(255, 107, 107, 0.1)', marginRight: 8 },
  declineBtnText: { color: '#ff6b6b', fontSize: 16, fontWeight: '600' },
  agreeBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, backgroundColor: '#00d4ff', marginLeft: 8 },
  agreeBtnDisabled: { backgroundColor: '#1a1a3e' },
  agreeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  agreeBtnTextDisabled: { color: '#555' },
});
