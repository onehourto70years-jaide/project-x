import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MatrixSpeed = 'slow' | 'medium' | 'fast' | 'ultra';
export type MatrixDensity = 'sparse' | 'normal' | 'dense' | 'maximum';
export type MatrixColor = 'green' | 'cyan' | 'amber' | 'purple' | 'blood' | 'gold' | 'auto';

interface MatrixContextType {
  matrixEnabled: boolean;
  setMatrixEnabled: (val: boolean) => void;
  matrixIntensity: 'full' | 'reduced';
  setMatrixIntensity: (val: 'full' | 'reduced') => void;
  matrixSpeed: MatrixSpeed;
  setMatrixSpeed: (val: MatrixSpeed) => void;
  matrixDensity: MatrixDensity;
  setMatrixDensity: (val: MatrixDensity) => void;
  autoActivate: boolean;
  setAutoActivate: (val: boolean) => void;
  adaptiveColor: MatrixColor;
  setAdaptiveColor: (val: MatrixColor) => void;
  priorityElements: Record<string, number>;
  setPriorityElements: (elements: Record<string, number>) => void;
}

const MatrixContext = createContext<MatrixContextType>({
  matrixEnabled: false,
  setMatrixEnabled: () => {},
  matrixIntensity: 'full',
  setMatrixIntensity: () => {},
  matrixSpeed: 'medium',
  setMatrixSpeed: () => {},
  matrixDensity: 'normal',
  setMatrixDensity: () => {},
  autoActivate: false,
  setAutoActivate: () => {},
  adaptiveColor: 'green',
  setAdaptiveColor: () => {},
  priorityElements: {},
  setPriorityElements: () => {},
});

const KEYS = {
  enabled: 'matrix_mode',
  intensity: 'matrix_intensity',
  speed: 'matrix_speed',
  density: 'matrix_density',
  auto: 'matrix_auto_activate',
  color: 'matrix_color',
};

const VALID_SPEEDS: MatrixSpeed[] = ['slow', 'medium', 'fast', 'ultra'];
const VALID_DENSITIES: MatrixDensity[] = ['sparse', 'normal', 'dense', 'maximum'];
const VALID_COLORS: MatrixColor[] = ['green', 'cyan', 'amber', 'purple', 'blood', 'gold', 'auto'];

export function MatrixProvider({ children }: { children: React.ReactNode }) {
  const [matrixEnabled, setMatrixEnabledState] = useState(false);
  const [matrixIntensity, setMatrixIntensityState] = useState<'full' | 'reduced'>('full');
  const [matrixSpeed, setMatrixSpeedState] = useState<MatrixSpeed>('medium');
  const [matrixDensity, setMatrixDensityState] = useState<MatrixDensity>('normal');
  const [autoActivate, setAutoActivateState] = useState(false);
  const [adaptiveColor, setAdaptiveColorState] = useState<MatrixColor>('green');
  const [priorityElements, setPriorityElements] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [enabled, intensity, speed, density, auto, color] = await Promise.all([
          AsyncStorage.getItem(KEYS.enabled),
          AsyncStorage.getItem(KEYS.intensity),
          AsyncStorage.getItem(KEYS.speed),
          AsyncStorage.getItem(KEYS.density),
          AsyncStorage.getItem(KEYS.auto),
          AsyncStorage.getItem(KEYS.color),
        ]);
        if (enabled === 'true') setMatrixEnabledState(true);
        if (intensity === 'reduced') setMatrixIntensityState('reduced');
        if (speed && VALID_SPEEDS.includes(speed as MatrixSpeed)) setMatrixSpeedState(speed as MatrixSpeed);
        if (density && VALID_DENSITIES.includes(density as MatrixDensity)) setMatrixDensityState(density as MatrixDensity);
        if (auto === 'true') setAutoActivateState(true);
        if (color && VALID_COLORS.includes(color as MatrixColor)) setAdaptiveColorState(color as MatrixColor);
      } catch (e) {
        // Ignore storage errors
      }
    };
    load();
  }, []);

  const persist = (key: string, val: string) => AsyncStorage.setItem(key, val);

  const setMatrixEnabled = useCallback((val: boolean) => { setMatrixEnabledState(val); persist(KEYS.enabled, val ? 'true' : 'false'); }, []);
  const setMatrixIntensity = useCallback((val: 'full' | 'reduced') => { setMatrixIntensityState(val); persist(KEYS.intensity, val); }, []);
  const setMatrixSpeed = useCallback((val: MatrixSpeed) => { setMatrixSpeedState(val); persist(KEYS.speed, val); }, []);
  const setMatrixDensity = useCallback((val: MatrixDensity) => { setMatrixDensityState(val); persist(KEYS.density, val); }, []);
  const setAutoActivate = useCallback((val: boolean) => { setAutoActivateState(val); persist(KEYS.auto, val ? 'true' : 'false'); }, []);
  const setAdaptiveColor = useCallback((val: MatrixColor) => { setAdaptiveColorState(val); persist(KEYS.color, val); }, []);

  return (
    <MatrixContext.Provider value={{
      matrixEnabled, setMatrixEnabled,
      matrixIntensity, setMatrixIntensity,
      matrixSpeed, setMatrixSpeed,
      matrixDensity, setMatrixDensity,
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
