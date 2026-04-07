import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearCacheForKey, CacheKeys, saveConversation, loadConversation, getConversationList, getCurrentConversationId, deleteConversation } from '../src/cache';
import { useLanguage } from '../src/LanguageContext';
import { useTheme } from '../src/ThemeContext';

import type { ConversationMeta } from '../src/cache';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
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

const generateId = () => `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "Hey! I'm your NutriOS AI Coach 🧬\n\nI can help you with:\n• Personalized meal suggestions based on your nutrient gaps\n• Food synergies for your health goals\n• Cooking tips for maximum nutrient retention\n• Elemental composition insights\n\nWhat would you like to know?",
  timestamp: new Date().toISOString(),
};

export default function AIChatScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(generateId());
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<ConversationMeta[]>([]);
  const [isOffline, setIsOffline] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Load last conversation on mount
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    loadLastConversation();
  }, []);

  const loadLastConversation = async () => {
    try {
      const lastId = await getCurrentConversationId();
      if (lastId) {
        const msgs = await loadConversation(lastId);
        if (msgs && msgs.length > 1) {
          setConversationId(lastId);
          setMessages(msgs);
          return;
        }
      }
      // No saved conversation — start fresh
      setMessages([WELCOME_MSG]);
    } catch {
      setMessages([WELCOME_MSG]);
    }
  };

  // Auto-save conversation after each message change
  useEffect(() => {
    if (messages.length > 1) {
      saveConversation(conversationId, messages).catch(() => {});
    }
  }, [messages, conversationId]);

  // Check connectivity
  useEffect(() => {
    const checkOnline = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/`, { method: 'GET' });
        setIsOffline(!res.ok);
      } catch {
        setIsOffline(true);
      }
    };
    checkOnline();
    const interval = setInterval(checkOnline, 30000);
    return () => clearInterval(interval);
  }, []);

  const startNewConversation = async () => {
    // Save current if it has content
    if (messages.length > 1) {
      await saveConversation(conversationId, messages);
    }
    const newId = generateId();
    setConversationId(newId);
    setMessages([WELCOME_MSG]);
    setShowHistory(false);
  };

  const loadConversationById = async (id: string) => {
    setLoadingHistory(true);
    try {
      const msgs = await loadConversation(id);
      if (msgs) {
        setConversationId(id);
        setMessages(msgs);
      }
    } catch {
      Alert.alert('Error', 'Failed to load conversation');
    } finally {
      setLoadingHistory(false);
      setShowHistory(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    Alert.alert(
      t('common_delete') || 'Delete',
      t('ai_delete_convo') || 'Delete this conversation?',
      [
        { text: t('common_cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common_delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteConversation(id);
            setHistoryList(prev => prev.filter(c => c.id !== id));
            if (id === conversationId) {
              startNewConversation();
            }
          },
        },
      ]
    );
  };

  const openHistory = async () => {
    const list = await getConversationList();
    setHistoryList(list);
    setShowHistory(true);
  };

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msgText,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    if (isOffline) {
      setMessages(prev => [...prev, {
        id: `offline-${Date.now()}`,
        role: 'assistant',
        content: t('ai_offline_msg') || "You're offline. Your message has been saved. I'll respond when you're back online!",
        timestamp: new Date().toISOString(),
      }]);
      setLoading(false);
      return;
    }

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
          timestamp: new Date().toISOString(),
          actions: actionsExecuted,
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: "Sorry, I encountered an error. Please try again.",
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (error) {
      setIsOffline(true);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: t('ai_offline_msg') || "Connection lost. Your conversation is saved locally and will sync when you're back online.",
        timestamp: new Date().toISOString(),
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
      icon = 'restaurant'; color = '#6c5ce7';
      label = `Logged: ${action.food_name} (${action.portion_grams}g, ${action.meal_type})`;
    } else if (action.type === 'log_water') {
      icon = 'water'; color = '#00b4d8';
      label = `Logged: ${action.amount_ml}ml water`;
    } else if (action.type === 'update_settings') {
      icon = 'settings'; color = '#00cec9';
      const keys = Object.keys(action.updated || {});
      label = `Updated: ${keys.map(k => k.replace(/_/g, ' ')).join(', ')}`;
    }
    return (
      <View key={`action-${index}`} style={[styles.actionCard, { borderLeftColor: color }]}>
        <Ionicons name={icon as any} size={18} color={color} />
        <Text style={[styles.actionText, { color: theme.textMuted }]}>{label}</Text>
        <Ionicons name="checkmark-circle" size={16} color="#2ecc71" />
      </View>
    );
  };

  const formatRelativeTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'now';
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d`;
      return d.toLocaleDateString();
    } catch { return ''; }
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user';
    return (
      <View key={msg.id} style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={[styles.aiAvatar, { backgroundColor: theme.accent + '22' }]}>
            <Ionicons name="flask" size={16} color={theme.accent} />
          </View>
        )}
        <View style={{ flex: 1, maxWidth: '80%' }}>
          <View style={[styles.msgBubble, isUser ? styles.msgBubbleUser : [styles.msgBubbleAi, { backgroundColor: theme.bgCard, borderColor: theme.border }]]}>
            <Text style={[styles.msgText, isUser && styles.msgTextUser, !isUser && { color: theme.text }]}>{msg.content}</Text>
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.bgCard }]}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: theme.accent + '22' }]}>
            <Ionicons name="flask" size={20} color={theme.accent} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{t('ai_coach')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {isOffline && (
                <View style={styles.offlineDot} />
              )}
              <Text style={[styles.headerStatus, { color: theme.textDim }]}>
                {isOffline ? (t('ai_offline') || 'Offline — cached mode') : loading ? t('ai_thinking') : t('ai_status')}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={openHistory} style={[styles.historyBtn, { backgroundColor: theme.bgCard }]}>
          <Ionicons name="time-outline" size={20} color={theme.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={startNewConversation} style={[styles.newChatBtn, { backgroundColor: theme.bgCard }]}>
          <Ionicons name="add" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      {/* Offline Banner */}
      {isOffline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={14} color="#ffd93d" />
          <Text style={styles.offlineBannerText}>{t('ai_offline_banner') || 'Viewing cached conversation. New messages will be sent when online.'}</Text>
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView ref={scrollRef} style={styles.chatArea} contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim }}>
            {messages.map(renderMessage)}
            {loading && (
              <View style={styles.msgRow}>
                <View style={[styles.aiAvatar, { backgroundColor: theme.accent + '22' }]}>
                  <Ionicons name="flask" size={16} color={theme.accent} />
                </View>
                <View style={[styles.msgBubble, styles.msgBubbleAi, styles.typingBubble, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                  <View style={styles.typingDots}>
                    <TypingDot delay={0} color={theme.accent} />
                    <TypingDot delay={200} color={theme.accent} />
                    <TypingDot delay={400} color={theme.accent} />
                  </View>
                </View>
              </View>
            )}

            {/* Quick Prompts */}
            {messages.length <= 1 && !loading && (
              <View style={styles.quickPromptsSection}>
                <Text style={[styles.quickPromptsTitle, { color: theme.textDim }]}>{t('ai_try_asking')}</Text>
                {QUICK_PROMPTS.map((p, i) => (
                  <TouchableOpacity key={i} style={[styles.quickPromptCard, { backgroundColor: theme.bgCard, borderColor: theme.border }]} onPress={() => sendMessage(p.text)}>
                    <Ionicons name={p.icon as any} size={18} color={theme.accent} />
                    <Text style={[styles.quickPromptText, { color: theme.textMuted }]}>{p.text}</Text>
                    <Ionicons name="arrow-forward" size={14} color={theme.textDim} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Input Area */}
        <View style={[styles.inputArea, { borderTopColor: theme.border, backgroundColor: theme.bg }]}>
          <View style={[styles.inputContainer, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
            <TextInput style={[styles.input, { color: theme.text }]} value={input} onChangeText={setInput}
              placeholder={t('ai_placeholder')}
              placeholderTextColor={theme.textDim} multiline maxLength={500}
              onSubmitEditing={() => sendMessage()} returnKeyType="send" />
            <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && [styles.sendBtnDisabled, { backgroundColor: theme.bgCard }]]}
              onPress={() => sendMessage()} disabled={!input.trim() || loading}>
              <Ionicons name="send" size={20} color={input.trim() && !loading ? '#fff' : theme.textDim} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Conversation History Modal */}
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={[styles.historyOverlay]}>
          <View style={[styles.historyModal, { backgroundColor: theme.bgCard }]}>
            <View style={[styles.historyHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.historyTitle, { color: theme.text }]}>{t('ai_history') || 'Chat History'}</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <Ionicons name="close" size={24} color={theme.textDim} />
              </TouchableOpacity>
            </View>

            {loadingHistory ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.accent} />
              </View>
            ) : (
              <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
                {/* New Chat Button */}
                <TouchableOpacity style={[styles.newChatCard, { borderColor: theme.accent }]} onPress={startNewConversation}>
                  <Ionicons name="add-circle" size={22} color={theme.accent} />
                  <Text style={[styles.newChatText, { color: theme.accent }]}>{t('ai_new_chat') || 'Start New Chat'}</Text>
                </TouchableOpacity>

                {historyList.length === 0 ? (
                  <View style={styles.emptyHistory}>
                    <Ionicons name="chatbubbles-outline" size={48} color={theme.textDim} />
                    <Text style={[styles.emptyHistoryText, { color: theme.textDim }]}>{t('ai_no_history') || 'No saved conversations yet'}</Text>
                  </View>
                ) : (
                  historyList.map((convo) => (
                    <View
                      key={convo.id}
                      style={[styles.historyItem, { backgroundColor: theme.bg, borderColor: theme.border }, convo.id === conversationId && { borderColor: theme.accent }]}
                    >
                      <TouchableOpacity
                        style={styles.historyItemContent}
                        onPress={() => loadConversationById(convo.id)}
                        activeOpacity={0.6}
                      >
                        <View style={styles.historyItemHeader}>
                          <Text style={[styles.historyItemTitle, { color: theme.text }]} numberOfLines={1}>{convo.title}</Text>
                          {convo.id === conversationId && (
                            <View style={[styles.activeBadge, { backgroundColor: theme.accent + '22' }]}>
                              <Text style={[styles.activeBadgeText, { color: theme.accent }]}>Active</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.historyItemPreview, { color: theme.textMuted }]} numberOfLines={2}>{convo.preview}</Text>
                        <View style={styles.historyItemMeta}>
                          <Text style={[styles.historyItemDate, { color: theme.textDim }]}>{formatRelativeTime(convo.updatedAt)}</Text>
                          <Text style={[styles.historyItemCount, { color: theme.textDim }]}>{convo.messageCount} msgs</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteConvoBtn}
                        onPress={() => handleDeleteConversation(convo.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ff6b6b" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TypingDot({ delay, color }: { delay: number; color: string }) {
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
  return <Animated.View style={[styles.dot, { opacity: anim, backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 12 },
  headerIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerStatus: { fontSize: 11, marginTop: 1 },
  historyBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  newChatBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  offlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff6b6b' },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'rgba(255,217,61,0.1)', gap: 8 },
  offlineBannerText: { color: '#ffd93d', fontSize: 12, flex: 1 },
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 20 },
  msgRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  msgBubble: { maxWidth: '78%', borderRadius: 18, padding: 14 },
  msgBubbleUser: { backgroundColor: '#00d4ff', borderBottomRightRadius: 4 },
  msgBubbleAi: { borderBottomLeftRadius: 4, borderWidth: 1 },
  msgText: { fontSize: 14, lineHeight: 21 },
  msgTextUser: { color: '#fff' },
  typingBubble: { paddingVertical: 16, paddingHorizontal: 20 },
  typingDots: { flexDirection: 'row' },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 3 },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,212,255,0.08)', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8, gap: 8, borderLeftWidth: 3 },
  actionText: { fontSize: 13, flex: 1 },
  quickPromptsSection: { marginTop: 16 },
  quickPromptsTitle: { fontSize: 13, marginBottom: 10, fontWeight: '500' },
  quickPromptCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1 },
  quickPromptText: { flex: 1, fontSize: 14, marginLeft: 12 },
  inputArea: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, borderWidth: 1, paddingLeft: 16, paddingRight: 4 },
  input: { flex: 1, fontSize: 15, paddingVertical: 12, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  sendBtnDisabled: { },

  // History Modal
  historyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  historyModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 30 },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  historyTitle: { fontSize: 18, fontWeight: '700' },
  historyList: { padding: 16 },
  center: { padding: 40, alignItems: 'center' },
  newChatCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', paddingVertical: 16, marginBottom: 16, gap: 10 },
  newChatText: { fontSize: 15, fontWeight: '600' },
  emptyHistory: { alignItems: 'center', paddingVertical: 40 },
  emptyHistoryText: { marginTop: 12, fontSize: 14 },
  historyItem: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10, alignItems: 'center' },
  historyItemContent: { flex: 1 },
  historyItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  historyItemTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  activeBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeText: { fontSize: 10, fontWeight: '700' },
  historyItemPreview: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  historyItemMeta: { flexDirection: 'row', gap: 12, marginTop: 6 },
  historyItemDate: { fontSize: 11 },
  historyItemCount: { fontSize: 11 },
  deleteConvoBtn: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
});
