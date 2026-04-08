import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors, themes } from '../ThemeContext';

interface Props {
  children: ReactNode;
  widgetName?: string;
}
interface State {
  hasError: boolean;
  hidden: boolean;
}

function ThemedErrorCard({ widgetName, onRetry, onHide }: { widgetName: string; onRetry: () => void; onHide: () => void }) {
  const { theme } = useTheme();
  return (
    <View style={[s.card, { backgroundColor: `${theme.danger}0a`, borderColor: `${theme.danger}1e` }]}>
      <Ionicons name="alert-circle" size={22} color={theme.danger} />
      <View style={s.info}>
        <Text style={[s.title, { color: theme.textSecondary }]}>{widgetName || 'Widget'} couldn't load</Text>
        <Text style={[s.sub, { color: theme.textDim }]}>This won't affect the rest of your dashboard</Text>
      </View>
      <TouchableOpacity style={[s.retryBtn, { backgroundColor: `${theme.accent}18` }]} onPress={onRetry}>
        <Ionicons name="refresh" size={16} color={theme.accent} />
      </TouchableOpacity>
      <TouchableOpacity style={[s.hideBtn, { backgroundColor: theme.border }]} onPress={onHide}>
        <Ionicons name="close" size={16} color={theme.textDim} />
      </TouchableOpacity>
    </View>
  );
}

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
      return <ThemedErrorCard widgetName={this.props.widgetName || 'Widget'} onRetry={this.retry} onHide={this.hide} />;
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, marginHorizontal: 16, marginTop: 10, padding: 14, borderWidth: 1, gap: 10 },
  info: { flex: 1 },
  title: { fontSize: 13, fontWeight: '600' },
  sub: { fontSize: 11, marginTop: 2 },
  retryBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  hideBtn: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
});
