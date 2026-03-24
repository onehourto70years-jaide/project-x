import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const themes = {
  dark: {
    name: 'dark',
    bg: '#080818',
    bgSecondary: '#0d0d22',
    bgCard: '#12122a',
    bgInput: '#1a1a3e',
    border: 'rgba(255,255,255,0.04)',
    borderLight: '#1a1a3e',
    text: '#fff',
    textSecondary: '#ccc',
    textMuted: '#888',
    textDim: '#555',
    accent: '#00d4ff',
    accentGlow: 'rgba(0, 212, 255, 0.15)',
    danger: '#ff6b6b',
    success: '#00ff88',
    warning: '#ffd93d',
    purple: '#a29bfe',
    teal: '#4ecdc4',
    pink: '#fd79a8',
    orange: '#ff9f43',
    tabBar: '#0d0d22',
    tabBarBorder: '#1a1a3e',
    statusBar: 'light',
  },
  light: {
    name: 'light',
    bg: '#f5f6fa',
    bgSecondary: '#ffffff',
    bgCard: '#ffffff',
    bgInput: '#f0f1f5',
    border: 'rgba(0,0,0,0.06)',
    borderLight: '#e8e9ed',
    text: '#1a1a2e',
    textSecondary: '#444',
    textMuted: '#777',
    textDim: '#aaa',
    accent: '#0088cc',
    accentGlow: 'rgba(0, 136, 204, 0.1)',
    danger: '#e74c3c',
    success: '#27ae60',
    warning: '#f39c12',
    purple: '#7c6cf0',
    teal: '#2ecc71',
    pink: '#e84393',
    orange: '#e67e22',
    tabBar: '#ffffff',
    tabBarBorder: '#e8e9ed',
    statusBar: 'dark',
  },
};

export type ThemeColors = typeof themes.dark;

interface ThemeContextType {
  theme: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: themes.dark,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((val) => {
      if (val === 'light') setIsDark(false);
    });
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    AsyncStorage.setItem('theme_mode', newIsDark ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? themes.dark : themes.light, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
