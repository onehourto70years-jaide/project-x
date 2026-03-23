import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Recommendation {
  food: string;
  key_nutrients: string[];
  key_elements: string[];
  health_benefit: string;
  best_cooking: string;
  synergistic_foods: string[];
}

const GOALS = [
  { id: 'muscle_gain', label: 'Muscle Gain', icon: 'barbell', color: '#ff6b6b', description: 'Build lean muscle mass' },
  { id: 'immune_system', label: 'Immune Boost', icon: 'shield-checkmark', color: '#4ecdc4', description: 'Strengthen immunity' },
  { id: 'brain_health', label: 'Brain Health', icon: 'bulb', color: '#ffd93d', description: 'Improve cognitive function' },
  { id: 'gut_microbiome', label: 'Gut Health', icon: 'leaf', color: '#00d4ff', description: 'Support digestive health' },
  { id: 'energy', label: 'Energy Boost', icon: 'flash', color: '#a29bfe', description: 'Increase energy levels' },
  { id: 'inflammation', label: 'Anti-Inflammatory', icon: 'heart', color: '#fd79a8', description: 'Reduce inflammation' },
];

export default function AIScreen() {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiModel, setAiModel] = useState<string>('');

  const getRecommendations = async (goal: string) => {
    setSelectedGoal(goal);
    setLoading(true);
    setRecommendations([]);

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          current_foods: [],
          dietary_restrictions: []
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
        setAiModel(data.ai_model || 'gemini-3-flash');
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGoalInfo = (goalId: string) => GOALS.find(g => g.id === goalId);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>AI Nutrition Guide</Text>
          <Text style={styles.subtitle}>Personalized food combinations powered by AI</Text>
        </View>

        {/* Goal Selection */}
        <View style={styles.goalsSection}>
          <Text style={styles.sectionTitle}>Select Your Goal</Text>
          <View style={styles.goalsGrid}>
            {GOALS.map((goal) => (
              <TouchableOpacity
                key={goal.id}
                style={[
                  styles.goalCard,
                  selectedGoal === goal.id && { borderColor: goal.color, borderWidth: 2 }
                ]}
                onPress={() => getRecommendations(goal.id)}
              >
                <View style={[styles.goalIcon, { backgroundColor: goal.color + '20' }]}>
                  <Ionicons name={goal.icon as any} size={24} color={goal.color} />
                </View>
                <Text style={styles.goalLabel}>{goal.label}</Text>
                <Text style={styles.goalDescription}>{goal.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00d4ff" />
            <Text style={styles.loadingText}>Analyzing molecular synergies...</Text>
          </View>
        )}

        {/* Recommendations */}
        {!loading && recommendations.length > 0 && (
          <View style={styles.recommendationsSection}>
            <View style={styles.recHeader}>
              <Text style={styles.sectionTitle}>Recommended Foods</Text>
              <View style={styles.aiBadge}>
                <Ionicons name="sparkles" size={12} color="#ffd93d" />
                <Text style={styles.aiText}>AI: {aiModel}</Text>
              </View>
            </View>

            {recommendations.map((rec, index) => (
              <View key={index} style={styles.recCard}>
                <View style={styles.recHeader2}>
                  <View style={styles.recNumber}>
                    <Text style={styles.recNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.recFood}>{rec.food}</Text>
                </View>

                <Text style={styles.recBenefit}>{rec.health_benefit}</Text>

                {/* Key Nutrients */}
                <View style={styles.recSection}>
                  <Text style={styles.recLabel}>Key Nutrients</Text>
                  <View style={styles.tagsRow}>
                    {rec.key_nutrients.map((nutrient, i) => (
                      <View key={i} style={styles.nutrientTag}>
                        <Text style={styles.tagText}>{nutrient}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Key Elements */}
                <View style={styles.recSection}>
                  <Text style={styles.recLabel}>Key Elements</Text>
                  <View style={styles.tagsRow}>
                    {rec.key_elements.map((element, i) => (
                      <View key={i} style={[styles.elementTag, { backgroundColor: getElementColor(element) }]}>
                        <Text style={styles.elementText}>{element}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Cooking & Synergies */}
                <View style={styles.recFooter}>
                  <View style={styles.cookingBadge}>
                    <Ionicons name="flame" size={14} color="#ff6b6b" />
                    <Text style={styles.cookingText}>Best: {rec.best_cooking}</Text>
                  </View>
                  <View style={styles.synergyBadge}>
                    <Ionicons name="git-merge" size={14} color="#4ecdc4" />
                    <Text style={styles.synergyText}>Combine: {rec.synergistic_foods.join(', ')}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepCard}>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumText}>1</Text></View>
              <Text style={styles.stepText}>Select your health goal</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumText}>2</Text></View>
              <Text style={styles.stepText}>AI analyzes molecular synergies</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumText}>3</Text></View>
              <Text style={styles.stepText}>Get personalized food combinations</Text>
            </View>
            <View style={styles.step}>
              <View style={styles.stepNumber}><Text style={styles.stepNumText}>4</Text></View>
              <Text style={styles.stepText}>Track and optimize your nutrition</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getElementColor = (element: string) => {
  const colors: Record<string, string> = {
    'C': '#444', 'H': '#00d4ff', 'O': '#ff6b6b', 'N': '#4ecdc4', 'S': '#ffd93d',
    'Fe': '#ff6b6b', 'Ca': '#74b9ff', 'K': '#ffd93d', 'Mg': '#4ecdc4', 'Zn': '#a29bfe',
    'P': '#fd79a8', 'Na': '#fdcb6e'
  };
  return colors[element] || '#666';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 24,
    marginTop: 8,
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
  goalsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  goalCard: {
    width: '48%',
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  goalDescription: {
    fontSize: 11,
    color: '#888',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
  },
  recommendationsSection: {
    marginBottom: 24,
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 217, 61, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiText: {
    color: '#ffd93d',
    fontSize: 11,
    marginLeft: 4,
  },
  recCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  recHeader2: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  recNumberText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  recFood: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  recBenefit: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 16,
  },
  recSection: {
    marginBottom: 12,
  },
  recLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  nutrientTag: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
  },
  tagText: {
    color: '#00d4ff',
    fontSize: 12,
  },
  elementTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 6,
  },
  elementText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  recFooter: {
    marginTop: 8,
  },
  cookingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cookingText: {
    color: '#ff6b6b',
    fontSize: 12,
    marginLeft: 6,
  },
  synergyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  synergyText: {
    color: '#4ecdc4',
    fontSize: 12,
    marginLeft: 6,
  },
  howItWorks: {
    marginTop: 8,
  },
  stepCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 16,
    padding: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumText: {
    color: '#00d4ff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepText: {
    color: '#aaa',
    fontSize: 14,
  },
});
