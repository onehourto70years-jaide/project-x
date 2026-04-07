/**
 * NutriOS Offline Cache Layer
 *
 * Strategy: network-first with fallback to cache.
 * – On success the response is persisted to AsyncStorage.
 * – On failure (offline / timeout) the last cached copy is returned.
 * – Each entry has a TTL; stale entries are returned but flagged.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'nutrios_cache_';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

// ─── Low-level helpers ───────────────────────────────────

async function getCache<T>(key: string): Promise<{ data: T; stale: boolean } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const stale = Date.now() - entry.timestamp > entry.ttl;
    return { data: entry.data, stale };
  } catch {
    return null;
  }
}

async function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL_MS): Promise<void> {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), ttl };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    console.warn('[cache] write failed:', e);
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (e) {
    console.warn('[cache] clear failed:', e);
  }
}

export async function clearCacheForKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch {}
}

// ─── High-level cached fetch ─────────────────────────────

export interface CachedResult<T> {
  data: T;
  fromCache: boolean;
  stale: boolean;
}

/**
 * Perform a fetch with transparent offline caching.
 *
 * @param cacheKey  unique key for this request
 * @param fetchFn   async function that returns the parsed JSON data
 * @param ttl       cache time-to-live in ms (default 30 min)
 */
export async function cachedFetch<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  ttl: number = DEFAULT_TTL_MS,
): Promise<CachedResult<T>> {
  try {
    // Network-first
    const data = await fetchFn();
    // Persist to cache in background
    setCache(cacheKey, data, ttl).catch(() => {});
    return { data, fromCache: false, stale: false };
  } catch (networkError) {
    // Fallback to cache
    const cached = await getCache<T>(cacheKey);
    if (cached) {
      console.log(`[cache] serving offline data for "${cacheKey}" (stale=${cached.stale})`);
      return { data: cached.data, fromCache: true, stale: cached.stale };
    }
    // No cache available — rethrow
    throw networkError;
  }
}

// ─── Pre-built cache keys ────────────────────────────────

export const CacheKeys = {
  dashboard: 'dashboard',
  mealsToday: 'meals_today',
  waterToday: 'water_today',
  userSettings: 'user_settings',
  favorites: 'favorites',
  recipes: 'recipes',
  badges: 'badges',
  routines: 'routines',
  routinesToday: 'routines_today',
  progressNutrition: (days: number) => `progress_nutrition_${days}`,
  progressWater: (days: number) => `progress_water_${days}`,
  foodSearch: (query: string) => `food_search_${query.toLowerCase().trim()}`,
  molecularProfiles: 'molecular_profiles',
  sequenceResult: (mode: string) => `sequence_result_${mode}`,
  // AI Conversations
  aiCurrentConversation: 'ai_current_conversation',
  aiConversationList: 'ai_conversation_list',
  aiConversation: (id: string) => `ai_conversation_${id}`,
} as const;

// ─── TTL presets (ms) ────────────────────────────────────

export const CacheTTL = {
  SHORT: 5 * 60 * 1000,        // 5 min — dashboard, today data
  MEDIUM: 30 * 60 * 1000,      // 30 min — settings, recipes
  LONG: 2 * 60 * 60 * 1000,    // 2 hours — badges, profiles
  SEARCH: 60 * 60 * 1000,      // 1 hour — food search results
  CONVERSATION: 30 * 24 * 60 * 60 * 1000,  // 30 days — AI conversations
} as const;


// ─── AI Conversation Storage ─────────────────────────────

export interface ConversationMeta {
  id: string;
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

const AI_CONVO_LIST_KEY = CACHE_PREFIX + 'ai_conversation_list';
const AI_CURRENT_ID_KEY = CACHE_PREFIX + 'ai_current_id';

export async function saveConversation(id: string, messages: any[]): Promise<void> {
  try {
    // Save conversation messages
    await AsyncStorage.setItem(CACHE_PREFIX + `ai_conversation_${id}`, JSON.stringify({
      data: messages,
      timestamp: Date.now(),
      ttl: CacheTTL.CONVERSATION,
    }));

    // Update conversation list
    const listRaw = await AsyncStorage.getItem(AI_CONVO_LIST_KEY);
    let list: ConversationMeta[] = listRaw ? JSON.parse(listRaw) : [];
    const firstUser = messages.find(m => m.role === 'user');
    const lastMsg = messages[messages.length - 1];
    const existing = list.findIndex(c => c.id === id);
    const meta: ConversationMeta = {
      id,
      title: firstUser?.content?.slice(0, 50) || 'New Chat',
      preview: lastMsg?.content?.slice(0, 80) || '',
      messageCount: messages.filter(m => m.role !== 'system').length,
      createdAt: existing >= 0 ? list[existing].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (existing >= 0) {
      list[existing] = meta;
    } else {
      list.unshift(meta);
    }
    // Keep only last 50 conversations
    list = list.slice(0, 50);
    await AsyncStorage.setItem(AI_CONVO_LIST_KEY, JSON.stringify(list));
    await AsyncStorage.setItem(AI_CURRENT_ID_KEY, id);
  } catch (e) {
    console.warn('[cache] save conversation failed:', e);
  }
}

export async function loadConversation(id: string): Promise<any[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + `ai_conversation_${id}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return entry.data || null;
  } catch {
    return null;
  }
}

export async function getConversationList(): Promise<ConversationMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(AI_CONVO_LIST_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function getCurrentConversationId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AI_CURRENT_ID_KEY);
  } catch {
    return null;
  }
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + `ai_conversation_${id}`);
    const raw = await AsyncStorage.getItem(AI_CONVO_LIST_KEY);
    if (raw) {
      let list: ConversationMeta[] = JSON.parse(raw);
      list = list.filter(c => c.id !== id);
      await AsyncStorage.setItem(AI_CONVO_LIST_KEY, JSON.stringify(list));
    }
  } catch {}
}
