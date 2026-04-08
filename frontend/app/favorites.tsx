import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../src/LanguageContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Favorite {
  id: string;
  fdc_id: number;
  food_name: string;
  default_portion_grams: number;
  default_cooking_method: string;
}

interface RecentFood {
  fdc_id?: number;
  food_name: string;
  portion_grams: number;
  cooking_method: string;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'favorites' | 'recent'>('favorites');

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;

      const [favRes, recRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/favorites`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/api/foods/recent?limit=20`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (favRes.ok) setFavorites((await favRes.json()).favorites || []);
      if (recRes.ok) setRecentFoods((await recRes.json()).recent_foods || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const removeFavorite = async (fdcId: number) => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (!token) return;
      await fetch(`${BACKEND_URL}/api/favorites/${fdcId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      setFavorites(prev => prev.filter(f => f.fdc_id !== fdcId));
    } catch (error) {
      Alert.alert('Error', 'Failed to remove favorite');
    }
  };

  const handleFoodPress = (food: Favorite | RecentFood) => {
    if ('fdc_id' in food && food.fdc_id) {
      router.push({ pathname: '/food-details', params: { fdc_id: food.fdc_id, food_name: food.food_name } });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}
          accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('fav_title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, activeTab === 'favorites' && styles.tabActive]} onPress={() => setActiveTab('favorites')}>
          <Ionicons name="star" size={18} color={activeTab === 'favorites' ? '#ffd93d' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]}>Favorites</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'recent' && styles.tabActive]} onPress={() => setActiveTab('recent')}>
          <Ionicons name="time" size={18} color={activeTab === 'recent' ? '#00d4ff' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'recent' && styles.tabTextActive]}>Recent</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#00d4ff" />}>
        {activeTab === 'favorites' && (
          favorites.length > 0 ? (
            favorites.map((fav) => (
              <TouchableOpacity key={fav.id} style={styles.foodCard} onPress={() => handleFoodPress(fav)}>
                <View style={styles.foodIcon}>
                  <Ionicons name="star" size={20} color="#ffd93d" />
                </View>
                <View style={styles.foodInfo}>
                  <Text style={styles.foodName} numberOfLines={1}>{fav.food_name}</Text>
                  <Text style={styles.foodMeta}>{fav.default_portion_grams}g • {fav.default_cooking_method}</Text>
                </View>
                <TouchableOpacity onPress={() => removeFavorite(fav.fdc_id)} style={styles.removeBtn}>
                  <Ionicons name="close-circle" size={24} color="#ff6b6b" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>{t('fav_no_favorites')}</Text>
              <Text style={styles.emptySubtext}>Add foods to favorites for quick access</Text>
            </View>
          )
        )}

        {activeTab === 'recent' && (
          recentFoods.length > 0 ? (
            recentFoods.map((food, index) => (
              <TouchableOpacity key={index} style={styles.foodCard} onPress={() => handleFoodPress(food)}>
                <View style={[styles.foodIcon, { backgroundColor: 'rgba(0, 212, 255, 0.1)' }]}>
                  <Ionicons name="time" size={20} color="#00d4ff" />
                </View>
                <View style={styles.foodInfo}>
                  <Text style={styles.foodName} numberOfLines={1}>{food.food_name}</Text>
                  <Text style={styles.foodMeta}>{food.portion_grams}g • {food.cooking_method}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color="#444" />
              <Text style={styles.emptyText}>No recent foods</Text>
              <Text style={styles.emptySubtext}>Foods you log will appear here</Text>
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, backgroundColor: '#1a1a2e', marginHorizontal: 4 },
  tabActive: { backgroundColor: 'rgba(255, 217, 61, 0.15)' },
  tabText: { color: '#666', marginLeft: 8, fontWeight: '500' },
  tabTextActive: { color: '#ffd93d' },
  scrollContent: { padding: 16, paddingTop: 0, paddingBottom: 40 },
  foodCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a2e', padding: 16, borderRadius: 12, marginBottom: 10 },
  foodIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 217, 61, 0.1)', justifyContent: 'center', alignItems: 'center' },
  foodInfo: { flex: 1, marginLeft: 12 },
  foodName: { fontSize: 15, fontWeight: '500', color: '#fff' },
  foodMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  removeBtn: { padding: 4 },
  emptyState: { alignItems: 'center', padding: 60 },
  emptyText: { color: '#fff', fontSize: 16, marginTop: 16 },
  emptySubtext: { color: '#666', fontSize: 13, marginTop: 8 },
});
