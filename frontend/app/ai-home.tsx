import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCacheForKey, CacheKeys } from '../src/cache';
import { useLanguage } from '../src/LanguageContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  actions?: ActionResult[];
}

interface ActionResult {
  type: string;
  success: boolean;
  food_name?: string;
  portion_grams?: number;
  meal_type?: string;
  amount_ml?: number;
  updated?: Record<string, any>;
  error?: string;
}

const QUICK_PROMPTS = [
  { text: "Log 2 boiled eggs for breakfast", icon: "restaurant" },
  { text: "Log 500ml of water", icon: "water" },
  { text: "I just had a banana as a snack", icon: "nutrition" },
  { text: "Set my water goal to 3 liters", icon: "settings" },
  { text: "What should I eat for dinner?", icon: "restaurant" },
  { text: "What foods boost immunity?", icon: "shield-checkmark" },
];

export default function AIChatScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // Welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: "Hey! I'm your NutriOS AI Coach 🧬\n\nI can help you with:\n• Personalized meal suggestions based on your nutrient gaps\n• Food synergies for your health goals\n• Cooking tips for maximum nutrient retention\n• Elemental composition insights\n\nWhat would you like to know?",
      timestamp: new Date()
    }]);
  }, []);

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msgText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const token = await AsyncStorage.getItem('session_token');
      
      // Get user's current nutrition context
      let nutritionContext = '';
      if (token) {
        try {
          const dashRes = await fetch(`${BACKEND_URL}/api/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (dashRes.ok) {
            const dash = await dashRes.json();
            const n = dash.nutrition || {};
            const h = dash.hydration || {};
            nutritionContext = `\nUser's today data: Calories ${Math.round(n.calories?.current || 0)}/${n.calories?.goal || 2000} kcal, Protein ${Math.round(n.protein?.current || 0)}/${n.protein?.goal || 50}g, Water ${h.current_ml || 0}/${h.goal_ml || 2500}ml, Meals logged: ${n.meals_count || 0}. Deficiencies: ${(n.deficiencies || []).join(', ') || 'none detected'}.`;
          }
        } catch (e) { /* ignore context fetch errors */ }
      }

      // Build conversation history for AI
      const conversationHistory = messages
        .filter(m => m.role !== 'system')
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'User' : 'NutriOS Coach'}: ${m.content}`)
        .join('\n');

      const res = await fetch(`${BACKEND_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: msgText,
          conversation_history: conversationHistory,
          nutrition_context: nutritionContext
        })
      });

      if (res.ok) {
        const data = await res.json();
        const actionsExecuted: ActionResult[] = data.actions || [];

        // Invalidate caches if actions were performed
        if (actionsExecuted.length > 0) {
          const keysToInvalidate: string[] = [CacheKeys.dashboard];
          for (const action of actionsExecuted) {
            if (action.type === 'log_meal') keysToInvalidate.push(CacheKeys.mealsToday);
            if (action.type === 'log_water') keysToInvalidate.push(CacheKeys.waterToday);
            if (action.type === 'update_settings') keysToInvalidate.push(CacheKeys.userSettings);
          }
          await Promise.all(keysToInvalidate.map(k => clearCacheForKey(k)));
        }

        const aiMsg: Message = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: data.response || "I couldn't process that. Please try again.",
          timestamp: new Date(),
          actions: actionsExecuted,
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: "Connection error. Please check your network and try again.",
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    }
  };

  const renderActionCard = (action: ActionResult, index: number) => {
    if (!action.success) return null;
    let icon = 'checkmark-circle';
    let color = '#00d4ff';
    let label = '';

    if (action.type === 'log_meal') {
      icon = 'restaurant';
      color = '#6c5ce7';
      label = `Logged: ${action.food_name} (${action.portion_grams}g, ${action.meal_type})`;
    } else if (action.type === 'log_water') {
      icon = 'water';
      color = '#00b4d8';
      label = `Logged: ${action.amount_ml}ml water`;
    } else if (action.type === 'update_settings') {
      icon = 'settings';
      color = '#00cec9';
      const keys = Object.keys(action.updated || {});
      label = `Updated: ${keys.map(k => k.replace(/_/g, ' ')).join(', ')}`;
    }

    return (
      <View key={`action-${index}`} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,212,255,0.08)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8, gap: 8, borderLeftWidth: 3, borderLeftColor: color }}>
        <Ionicons name={icon as any} size={18} color={color} />
        <Text style={{ color: '#ccc', fontSize: 13, flex: 1 }}>{label}</Text>
        <Ionicons name="checkmark-circle" size={16} color="#2ecc71" />
      </View>
    );
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    return (
      <View key={msg.id} style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="flask" size={16} color="#00d4ff" />
          </View>
        )}
        <View style={{ flex: 1, maxWidth: '80%' }}>
          <View style={[styles.msgBubble, isUser ? styles.msgBubbleUser : styles.msgBubbleAi]}>
            <Text style={[styles.msgText, isUser && styles.msgTextUser]}>{msg.content}</Text>
          </View>
          {!isUser && msg.actions && msg.actions.length > 0 && (
            <View style={{ marginLeft: 4 }}>
              {msg.actions.map((a, i) => renderActionCard(a, i))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerIcon}>
            <Ionicons name="flask" size={20} color="#00d4ff" />
          </View>
          <View>
            <Text style={styles.headerTitle}>{t('ai_coach')}</Text>
            <Text style={styles.headerStatus}>
              {loading ? t('ai_thinking') : t('ai_status')}
            </Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            {messages.map(renderMessage)}
            {loading && (
              <View style={styles.msgRow}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="flask" size={16} color="#00d4ff" />
                </View>
                <View style={[styles.msgBubble, styles.msgBubbleAi, styles.typingBubble]}>
                  <View style={styles.typingDots}>
                    <TypingDot delay={0} />
                    <TypingDot delay={200} />
                    <TypingDot delay={400} />
                  </View>
                </View>
              </View>
            )}

            {/* Quick Prompts (only when no conversation yet) */}
            {messages.length <= 1 && !loading && (
              <View style={styles.quickPromptsSection}>
                <Text style={styles.quickPromptsTitle}>{t('ai_try_asking')}</Text>
                {QUICK_PROMPTS.map((p, i) => (
                  <TouchableOpacity key={i} style={styles.quickPromptCard} onPress={() => sendMessage(p.text)}>
                    <Ionicons name={p.icon as any} size={18} color="#00d4ff" />
                    <Text style={styles.quickPromptText}>{p.text}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#444" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputArea}>
          <View style={styles.inputContainer}>
            <TextInput style={styles.input} value={input} onChangeText={setInput}
              placeholder={t('ai_placeholder')}
              placeholderTextColor="#555" multiline maxLength={500}
              onSubmitEditing={() => sendMessage()} returnKeyType="send" />
            <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
              onPress={() => sendMessage()} disabled={!input.trim() || loading}>
              <Ionicons name="send" size={20} color={input.trim() && !loading ? '#fff' : '#444'} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);
  return <Animated.View style={[styles.dot, { opacity: anim }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a3e' },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1a1a3e', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0, 212, 255, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerStatus: { color: '#666', fontSize: 11, marginTop: 1 },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 20 },
  msgRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0, 212, 255, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  msgBubble: { maxWidth: '78%', borderRadius: 18, padding: 14 },
  msgBubbleUser: { backgroundColor: '#00d4ff', borderBottomRightRadius: 4 },
  msgBubbleAi: { backgroundColor: '#12122a', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.1)' },
  msgText: { color: '#ddd', fontSize: 14, lineHeight: 21 },
  msgTextUser: { color: '#fff' },
  typingBubble: { paddingVertical: 16, paddingHorizontal: 20 },
  typingDots: { flexDirection: 'row' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00d4ff', marginHorizontal: 3 },
  quickPromptsSection: { marginTop: 16 },
  quickPromptsTitle: { color: '#666', fontSize: 13, marginBottom: 10, fontWeight: '500' },
  quickPromptCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#12122a', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.08)' },
  quickPromptText: { flex: 1, color: '#ccc', fontSize: 14, marginLeft: 12 },
  inputArea: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1a1a3e', backgroundColor: '#080818' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#12122a', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.15)', paddingLeft: 16, paddingRight: 4 },
  input: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  sendBtnDisabled: { backgroundColor: '#1a1a3e' },
});
