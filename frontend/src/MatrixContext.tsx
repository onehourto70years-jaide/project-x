import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MatrixContextType {
  matrixEnabled: boolean;
  setMatrixEnabled: (val: boolean) => void;
  matrixIntensity: 'full' | 'reduced';
  setMatrixIntensity: (val: 'full' | 'reduced') => void;
  autoActivate: boolean;
  setAutoActivate: (val: boolean) => void;
  adaptiveColor: 'green' | 'cyan' | 'amber' | 'auto';
  setAdaptiveColor: (val: 'green' | 'cyan' | 'amber' | 'auto') => void;
  priorityElements: Record<string, number>;
  setPriorityElements: (elements: Record<string, number>) => void;
}

const MatrixContext = createContext<MatrixContextType>({
  matrixEnabled: false,
  setMatrixEnabled: () => {},
  matrixIntensity: 'full',
  setMatrixIntensity: () => {},
  autoActivate: false,
  setAutoActivate: () => {},
  adaptiveColor: 'green',
  setAdaptiveColor: () => {},
  priorityElements: {},
  setPriorityElements: () => {},
});

const MATRIX_STORAGE_KEY = 'matrix_mode';
const MATRIX_INTENSITY_KEY = 'matrix_intensity';
const MATRIX_AUTO_KEY = 'matrix_auto_activate';
const MATRIX_COLOR_KEY = 'matrix_color';

export function MatrixProvider({ children }: { children: React.ReactNode }) {
  const [matrixEnabled, setMatrixEnabledState] = useState(false);
  const [matrixIntensity, setMatrixIntensityState] = useState<'full' | 'reduced'>('full');
  const [autoActivate, setAutoActivateState] = useState(false);
  const [adaptiveColor, setAdaptiveColorState] = useState<'green' | 'cyan' | 'amber' | 'auto'>('green');
  const [priorityElements, setPriorityElements] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [enabled, intensity, auto, color] = await Promise.all([
          AsyncStorage.getItem(MATRIX_STORAGE_KEY),
          AsyncStorage.getItem(MATRIX_INTENSITY_KEY),
          AsyncStorage.getItem(MATRIX_AUTO_KEY),
          AsyncStorage.getItem(MATRIX_COLOR_KEY),
        ]);
        if (enabled === 'true') setMatrixEnabledState(true);
        if (intensity === 'reduced') setMatrixIntensityState('reduced');
        if (auto === 'true') setAutoActivateState(true);
        if (color && ['green', 'cyan', 'amber', 'auto'].includes(color)) {
          setAdaptiveColorState(color as any);
        }
      } catch (e) {
        // Ignore storage errors
      }
    };
    load();
  }, []);

  const setMatrixEnabled = useCallback((val: boolean) => {
    setMatrixEnabledState(val);
    AsyncStorage.setItem(MATRIX_STORAGE_KEY, val ? 'true' : 'false');
  }, []);

  const setMatrixIntensity = useCallback((val: 'full' | 'reduced') => {
    setMatrixIntensityState(val);
    AsyncStorage.setItem(MATRIX_INTENSITY_KEY, val);
  }, []);

  const setAutoActivate = useCallback((val: boolean) => {
    setAutoActivateState(val);
    AsyncStorage.setItem(MATRIX_AUTO_KEY, val ? 'true' : 'false');
  }, []);

  const setAdaptiveColor = useCallback((val: 'green' | 'cyan' | 'amber' | 'auto') => {
    setAdaptiveColorState(val);
    AsyncStorage.setItem(MATRIX_COLOR_KEY, val);
  }, []);

  return (
    <MatrixContext.Provider value={{
      matrixEnabled, setMatrixEnabled,
      matrixIntensity, setMatrixIntensity,
      autoActivate, setAutoActivate,
      adaptiveColor, setAdaptiveColor,
      priorityElements, setPriorityElements,
    }}>
      {children}
    </MatrixContext.Provider>
  );
}

export function useMatrix() {
  return useContext(MatrixContext);
}
