/**
 * NutriOS API Client with Offline Cache
 *
 * Centralised helper so every screen uses the same caching logic.
 * Import `api` and call `api.get(...)` / `api.post(...)`.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedFetch, CacheKeys, CacheTTL, clearCacheForKey } from './cache';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// ─── Generic fetch wrapper ───────────────────────────────

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('session_token');
}

async function rawFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Public API with caching ─────────────────────────────

export const api = {
  /** GET with automatic offline cache */
  getCached<T>(path: string, cacheKey: string, ttl?: number) {
    return cachedFetch<T>(cacheKey, () => rawFetch<T>(path), ttl);
  },

  /** Plain GET (no cache) */
  get<T>(path: string) {
    return rawFetch<T>(path);
  },

  /** POST / PUT / DELETE (these always go to network, and invalidate related cache) */
  async post<T>(path: string, body?: unknown, invalidateKeys?: string[]) {
    const data = await rawFetch<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (invalidateKeys) {
      await Promise.all(invalidateKeys.map(clearCacheForKey));
    }
    return data;
  },

  async put<T>(path: string, body?: unknown, invalidateKeys?: string[]) {
    const data = await rawFetch<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (invalidateKeys) {
      await Promise.all(invalidateKeys.map(clearCacheForKey));
    }
    return data;
  },

  async del<T>(path: string, invalidateKeys?: string[]) {
    const data = await rawFetch<T>(path, { method: 'DELETE' });
    if (invalidateKeys) {
      await Promise.all(invalidateKeys.map(clearCacheForKey));
    }
    return data;
  },
};

// ─── Convenience wrappers for common calls ───────────────

export const apiCached = {
  dashboard: () =>
    api.getCached('/api/dashboard', CacheKeys.dashboard, CacheTTL.SHORT),

  mealsToday: () =>
    api.getCached('/api/meals/today', CacheKeys.mealsToday, CacheTTL.SHORT),

  waterToday: () =>
    api.getCached('/api/water/today', CacheKeys.waterToday, CacheTTL.SHORT),

  userSettings: () =>
    api.getCached('/api/user/settings', CacheKeys.userSettings, CacheTTL.MEDIUM),

  favorites: () =>
    api.getCached('/api/favorites', CacheKeys.favorites, CacheTTL.MEDIUM),

  recipes: () =>
    api.getCached('/api/recipes', CacheKeys.recipes, CacheTTL.MEDIUM),

  badges: () =>
    api.getCached('/api/badges', CacheKeys.badges, CacheTTL.LONG),

  routines: () =>
    api.getCached('/api/routines', CacheKeys.routines, CacheTTL.MEDIUM),

  routinesToday: () =>
    api.getCached('/api/routines/today', CacheKeys.routinesToday, CacheTTL.SHORT),

  molecularProfiles: () =>
    api.getCached('/api/molecular/profiles', CacheKeys.molecularProfiles, CacheTTL.LONG),

  progressNutrition: (days = 7) =>
    api.getCached(`/api/progress/nutrition?days=${days}`, CacheKeys.progressNutrition(days), CacheTTL.SHORT),

  progressWater: (days = 7) =>
    api.getCached(`/api/progress/water?days=${days}`, CacheKeys.progressWater(days), CacheTTL.SHORT),

  foodSearch: (query: string, pageSize = 10) =>
    api.getCached(
      `/api/foods/search`,
      CacheKeys.foodSearch(query),
      CacheTTL.SEARCH,
    ),
};
