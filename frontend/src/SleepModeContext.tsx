import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback, Animated, Easing, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

interface SleepModeContextType {
  isSleeping: boolean;
  resetTimer: () => void;
}

const SleepModeContext = createContext<SleepModeContextType>({
  isSleeping: false,
  resetTimer: () => {},
});

export const useSleepMode = () => useContext(SleepModeContext);

export function SleepModeProvider({ children, enabled = true }: { children: React.ReactNode; enabled?: boolean }) {
  const [isSleeping, setIsSleeping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Animations ────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(0.4)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── Clock ─────────────────────────────────
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateClock = useCallback(() => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    setCurrentDate(now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
  }, []);

  // ─── Timer Management ──────────────────────
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (!enabled) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsSleeping(true);
    }, INACTIVITY_TIMEOUT_MS);
  }, [enabled, clearTimer]);

  const resetTimer = useCallback(() => {
    if (isSleeping) return; // don't reset while sleeping — wake handles that
    startTimer();
  }, [isSleeping, startTimer]);

  // ─── Sleep Entry Animation ─────────────────
  useEffect(() => {
    if (isSleeping) {
      updateClock();
      // Start clock updates
      clockRef.current = setInterval(updateClock, 10_000);

      // Fade in overlay
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      // Breathing animation loop for the icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(breatheAnim, {
            toValue: 0.8,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breatheAnim, {
            toValue: 0.4,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Pulse animation for the tap hint
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Cleanup when waking
      if (clockRef.current) {
        clearInterval(clockRef.current);
        clockRef.current = null;
      }
      fadeAnim.setValue(0);
      breatheAnim.setValue(0.4);
      pulseAnim.setValue(1);
    }

    return () => {
      if (clockRef.current) {
        clearInterval(clockRef.current);
        clockRef.current = null;
      }
    };
  }, [isSleeping]);

  // ─── Wake Up ───────────────────────────────
  const wakeUp = useCallback(() => {
    // Fade out quickly then reset
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsSleeping(false);
      startTimer();
    });
  }, [fadeAnim, startTimer]);

  // ─── App State: pause timer in background ──
  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        if (!isSleeping) startTimer();
      } else {
        clearTimer();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isSleeping, startTimer, clearTimer]);

  // ─── Initialize timer on mount ─────────────
  useEffect(() => {
    if (enabled) startTimer();
    return () => clearTimer();
  }, [enabled]);

  // ─── Touch Interceptor ─────────────────────
  // Captures every touch on the app to reset the inactivity timer.
  // Returns false so the touch propagates normally to children.
  const onTouchCapture = useCallback(() => {
    resetTimer();
    return false;
  }, [resetTimer]);

  return (
    <SleepModeContext.Provider value={{ isSleeping, resetTimer }}>
      <View
        style={styles.root}
        onStartShouldSetResponderCapture={onTouchCapture}
        onMoveShouldSetResponderCapture={onTouchCapture}
      >
        {children}

        {/* ── Sleep Overlay ── */}
        {isSleeping && (
          <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="auto">
            <TouchableWithoutFeedback onPress={wakeUp}>
              <View style={styles.overlayContent}>
                {/* Breathing moon icon */}
                <Animated.View style={[styles.iconContainer, { opacity: breatheAnim }]}>
                  <Ionicons name="moon" size={48} color="#334" />
                </Animated.View>

                {/* Clock */}
                <Text style={styles.time}>{currentTime}</Text>
                <Text style={styles.date}>{currentDate}</Text>

                {/* Wake hint */}
                <Animated.View style={[styles.hintContainer, { opacity: pulseAnim }]}>
                  <View style={styles.hintPill}>
                    <Ionicons name="finger-print-outline" size={16} color="#445" />
                    <Text style={styles.hintText}>Tap to wake</Text>
                  </View>
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        )}
      </View>
    </SleepModeContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 9999,
    elevation: 9999,
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  time: {
    fontSize: 64,
    fontWeight: '200',
    color: '#223',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  date: {
    fontSize: 15,
    color: '#334',
    marginTop: 8,
    fontWeight: '400',
    letterSpacing: 1,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 80,
  },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a1a2a',
  },
  hintText: {
    color: '#445',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
