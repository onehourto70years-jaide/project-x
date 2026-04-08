import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../LanguageContext';
import AnimatedElements from '../AnimatedElements';

const ELEMENT_COLORS: Record<string, string> = { C: '#00d4ff', H: '#00ff88', O: '#ff6b6b', N: '#a29bfe', S: '#ffd93d', Ca: '#4ecdc4', Fe: '#ff9f43', Mg: '#fd79a8', K: '#6c5ce7', Zn: '#e17055' };
const ELEMENT_EFFECTS: Record<string, string[]> = { C: ['Energy metabolism'], H: ['Cell hydration'], O: ['Cellular respiration'], N: ['Protein synthesis'], S: ['Protein structure'], Ca: ['Bone health'], Fe: ['Oxygen transport'], Mg: ['Enzyme activation'], K: ['Heart rhythm'], Zn: ['Immune function'] };

interface Props { elements: any; onViewCharts: () => void; }

export default function WidgetElements({ elements, onViewCharts }: Props) {
  const { t } = useLanguage();
  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <Text style={s.title}><Ionicons name="flask" size={16} color="#00d4ff" /> {t('dash_elemental')}</Text>
        <TouchableOpacity onPress={onViewCharts} accessibilityRole="link" accessibilityLabel={t('dash_see_charts')}>
          <Text style={s.seeAll}>{t('dash_see_charts')}</Text>
        </TouchableOpacity>
      </View>
      <AnimatedElements elements={elements || {}} colors={ELEMENT_COLORS} effects={ELEMENT_EFFECTS} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '700', color: '#fff' },
  seeAll: { color: '#00d4ff', fontSize: 13, fontWeight: '500' },
});
