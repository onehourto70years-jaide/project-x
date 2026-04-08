import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  widgetName?: string;
}
interface State {
  hasError: boolean;
  hidden: boolean;
}

/**
 * Catches JS errors inside any child widget and shows a
 * graceful fallback instead of crashing the entire dashboard.
 */
export default class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, hidden: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`[WidgetErrorBoundary] "${this.props.widgetName}" crashed:`, error.message);
  }

  retry = () => this.setState({ hasError: false });
  hide = () => this.setState({ hidden: true });

  render() {
    if (this.state.hidden) return null;

    if (this.state.hasError) {
      return (
        <View style={s.card}>
          <Ionicons name="alert-circle" size={22} color="#ff6b6b" />
          <View style={s.info}>
            <Text style={s.title}>
              {this.props.widgetName || 'Widget'} couldn't load
            </Text>
            <Text style={s.sub}>This won't affect the rest of your dashboard</Text>
          </View>
          <TouchableOpacity style={s.retryBtn} onPress={this.retry}>
            <Ionicons name="refresh" size={16} color="#00d4ff" />
          </TouchableOpacity>
          <TouchableOpacity style={s.hideBtn} onPress={this.hide}>
            <Ionicons name="close" size={16} color="#555" />
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,107,107,0.06)',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.12)',
    gap: 10,
  },
  info: { flex: 1 },
  title: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  sub: { color: '#555', fontSize: 11, marginTop: 2 },
  retryBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,212,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  hideBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.04)',
    justifyContent: 'center', alignItems: 'center',
  },
});
