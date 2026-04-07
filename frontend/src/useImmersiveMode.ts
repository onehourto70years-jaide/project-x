/**
 * NutriOS Immersive Mode Hook
 *
 * Enforces true fullscreen immersive mode:
 * - Hides status bar (top) and navigation bar (bottom)
 * - Sticky immersive: bars auto-hide after user swipe
 * - Re-hides on app foregrounding
 * - Works on Android; iOS hides status bar only (no software nav bar)
 */

import { useEffect, useRef } from 'react';
import { Platform, StatusBar, AppState } from 'react-native';

let NavigationBar: typeof import('expo-navigation-bar') | null = null;

// Lazy-load expo-navigation-bar (Android only, avoids web/iOS crashes)
if (Platform.OS === 'android') {
  try {
    NavigationBar = require('expo-navigation-bar');
  } catch {
    // Not available — graceful fallback
  }
}

const AUTO_HIDE_DELAY = 2000; // ms before re-hiding after user swipe

async function enterImmersiveMode() {
  try {
    // Hide status bar on all platforms
    StatusBar.setHidden(true, 'slide');

    if (Platform.OS === 'android' && NavigationBar) {
      // Set behavior: overlay-swipe means bars overlay content when swiped
      // (content doesn't resize), and they auto-hide
      await NavigationBar.setBehaviorAsync('overlay-swipe');
      // Hide the navigation bar
      await NavigationBar.setVisibilityAsync('hidden');
      // Make nav bar area transparent and edge-to-edge
      await NavigationBar.setPositionAsync('absolute');
      await NavigationBar.setBackgroundColorAsync('#00000000');
    }
  } catch (e) {
    // Silently handle — immersive mode is a nice-to-have
    console.warn('[immersive] enter failed:', e);
  }
}

export function useImmersiveMode() {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Enter immersive mode on mount
    enterImmersiveMode();

    // Listen for nav bar visibility changes (Android) — auto re-hide
    let navVisibilityListener: { remove: () => void } | null = null;
    if (Platform.OS === 'android' && NavigationBar) {
      try {
        navVisibilityListener = NavigationBar.addVisibilityListener(({ visibility }) => {
          if (visibility === 'visible') {
            // User swiped to reveal — schedule auto-hide
            if (hideTimer.current) clearTimeout(hideTimer.current);
            hideTimer.current = setTimeout(() => {
              enterImmersiveMode();
            }, AUTO_HIDE_DELAY);
          }
        });
      } catch {
        // Listener not available on this platform
      }
    }

    // Re-enter immersive mode when app comes to foreground
    const appStateListener = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        enterImmersiveMode();
      }
    });

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      navVisibilityListener?.remove();
      appStateListener?.remove();
    };
  }, []);
}
