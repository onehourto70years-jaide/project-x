import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, SafeAreaView, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../src/LanguageContext';
import { SkeletonSearch } from '../../src/components/Skeleton';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface FoodItem {
  fdc_id: number;
  description: string;
  brand_owner?: string;
  data_type?: string;
  food_category?: string;
}

export default function SearchScreen() {
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const searchFoods = async () => {
    if (!query.trim()) return;
    
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/foods/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), page_size: 20 })
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.foods || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFoodPress = (food: FoodItem) => {
    router.push({
      pathname: '/food-details',
      params: { fdc_id: food.fdc_id, food_name: food.description }
    });
  };

  const renderFoodItem = ({ item }: { item: FoodItem }) => (
    <TouchableOpacity style={styles.foodItem} onPress={() => handleFoodPress(item)}>
      <View style={styles.foodIcon}>
        <Ionicons name="nutrition" size={24} color="#00d4ff" />
      </View>
      <View style={styles.foodInfo}>
        <Text style={styles.foodName} numberOfLines={2}>{item.description}</Text>
        {item.brand_owner && (
          <Text style={styles.foodBrand}>{item.brand_owner}</Text>
        )}
        <Text style={styles.foodCategory}>{item.data_type || 'USDA'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search Foods</Text>
        <Text style={styles.subtitle}>Powered by USDA FoodData Central</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a food..."
            placeholderTextColor="#666"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchFoods}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.searchButton} onPress={searchFoods}>
          <Text style={styles.searchButtonText}>{t('nutr_search_btn')}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <SkeletonSearch />
      ) : searched && results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={60} color="#444" />
          <Text style={styles.emptyText}>No foods found</Text>
          <Text style={styles.emptySubtext}>Try a different search term</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderFoodItem}
          keyExtractor={(item) => item.fdc_id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !searched ? (
              <View style={styles.initialState}>
                <View style={styles.suggestionContainer}>
                  <Text style={styles.suggestionTitle}>Popular Searches</Text>
                  {['Chicken breast', 'Salmon', 'Spinach', 'Olive oil', 'Quinoa', 'Eggs'].map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={styles.suggestionItem}
                      onPress={() => { setQuery(item); }}
                    >
                      <Ionicons name="trending-up" size={16} color="#00d4ff" />
                      <Text style={styles.suggestionText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  header: {
    padding: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
    marginLeft: 8,
  },
  searchButton: {
    backgroundColor: '#00d4ff',
    paddingHorizontal: 20,
    borderRadius: 12,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  foodIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  foodBrand: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  foodCategory: {
    fontSize: 11,
    color: '#00d4ff',
    marginTop: 4,
  },
  initialState: {
    padding: 20,
  },
  suggestionContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  suggestionText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 15,
  },
});
