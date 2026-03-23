import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a2e',
          borderTopColor: '#2a2a4e',
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#00d4ff',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: ({ color, size }) => <Ionicons name="nutrition" size={size} color={color} /> }} />
      <Tabs.Screen name="water" options={{ title: 'Water', tabBarIcon: ({ color, size }) => <Ionicons name="water" size={size} color={color} /> }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} /> }} />
      {/* Hidden tab screens - exist as routes but not visible in tab bar */}
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="track" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
