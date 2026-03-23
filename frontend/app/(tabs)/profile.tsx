import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: signOut }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{user?.name?.charAt(0) || 'U'}</Text>
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statsCard}>
            <Ionicons name="calendar" size={24} color="#00d4ff" />
            <Text style={styles.statsValue}>0</Text>
            <Text style={styles.statsLabel}>Days Logged</Text>
          </View>
          <View style={styles.statsCard}>
            <Ionicons name="restaurant" size={24} color="#4ecdc4" />
            <Text style={styles.statsValue}>0</Text>
            <Text style={styles.statsLabel}>Foods Tracked</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>App Information</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(0, 212, 255, 0.1)' }]}>
              <Ionicons name="information-circle" size={20} color="#00d4ff" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>About NutriMolecule</Text>
              <Text style={styles.menuSubtext}>Molecular Nutrition Engine v1.0</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(78, 205, 196, 0.1)' }]}>
              <Ionicons name="server" size={20} color="#4ecdc4" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>Data Sources</Text>
              <Text style={styles.menuSubtext}>USDA FoodData Central</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(255, 217, 61, 0.1)' }]}>
              <Ionicons name="sparkles" size={20} color="#ffd93d" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>AI Engine</Text>
              <Text style={styles.menuSubtext}>Google Gemini 3 Flash</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Legal Section */}
        <View style={styles.menuSection}>
          <Text style={styles.menuTitle}>Legal & Privacy</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(162, 155, 254, 0.1)' }]}>
              <Ionicons name="document-text" size={20} color="#a29bfe" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>Privacy Policy</Text>
              <Text style={styles.menuSubtext}>GDPR Compliant</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(253, 121, 168, 0.1)' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#fd79a8" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuLabel}>Terms of Service</Text>
              <Text style={styles.menuSubtext}>Usage guidelines</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Ionicons name="information-circle-outline" size={16} color="#666" />
          <Text style={styles.disclaimerText}>
            This app provides nutritional information for educational purposes only. 
            It is not intended as medical advice. Consult a healthcare professional 
            for personalized dietary guidance.
          </Text>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#ff6b6b" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Version */}
        <Text style={styles.version}>NutriMolecule v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#00d4ff',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00d4ff',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00d4ff',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
  },
  statsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  statsLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  menuSection: {
    marginBottom: 24,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#fff',
  },
  menuSubtext: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  disclaimer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 217, 61, 0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#888',
    lineHeight: 18,
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  logoutText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  version: {
    textAlign: 'center',
    color: '#444',
    fontSize: 12,
  },
});
