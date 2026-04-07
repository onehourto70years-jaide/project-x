import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useTheme } from '../../src/ThemeContext';
import { useLanguage } from '../../src/LanguageContext';
import { useMatrix } from '../../src/MatrixContext';

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { matrixEnabled } = useMatrix();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: matrixEnabled ? 'rgba(0, 0, 0, 0.85)' : theme.tabBar,
          borderTopColor: matrixEnabled ? 'rgba(0, 255, 65, 0.1)' : theme.tabBarBorder,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
        },
        tabBarActiveTintColor: matrixEnabled ? '#00ff41' : theme.accent,
        tabBarInactiveTintColor: matrixEnabled ? '#004d14' : theme.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        sceneStyle: matrixEnabled ? { backgroundColor: 'transparent' } : undefined,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tab_home'), tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="nutrition" options={{ title: t('tab_nutrition'), tabBarIcon: ({ color, size }) => <Ionicons name="nutrition" size={size} color={color} /> }} />
      <Tabs.Screen name="water" options={{ title: t('tab_water'), tabBarIcon: ({ color, size }) => <Ionicons name="water" size={size} color={color} /> }} />
      <Tabs.Screen name="routines" options={{ title: t('tab_routines'), tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: t('tab_more'), tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} /> }} />
      {/* Hidden tab screens */}
      <Tabs.Screen name="ai" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="track" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
