/**
 * NutriOS — Skeleton / Shimmer placeholders
 *
 * Replaces bare ActivityIndicators with content-shaped placeholders
 * so screens feel instant instead of "loading…".
 *
 * Uses react-native-reanimated for 60 fps opacity pulse.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const { width: SW } = Dimensions.get('window');

/* ──────────────── Base Bone ──────────────── */
interface BoneProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

export function Bone({ width, height, borderRadius = 8, style }: BoneProps) {
  const opacity = useSharedValue(0.25);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.55, { duration: 850, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        {
          width: typeof width === 'string' ? width as any : width,
          height,
          borderRadius,
          backgroundColor: '#1e2140',
        },
        animStyle,
        style,
      ]}
    />
  );
}

/* ──────────────── Composed Skeletons ──────────────── */

/** Row: circle + two text lines */
function ListRow({ idx }: { idx: number }) {
  return (
    <View style={[s.row, { opacity: 1 - idx * 0.08 }]}>
      <Bone width={44} height={44} borderRadius={22} />
      <View style={s.rowText}>
        <Bone width="70%" height={14} />
        <Bone width="45%" height={11} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

/** Card block with title bar + body */
function CardBlock({ w = '100%', h = 100 }: { w?: number | string; h?: number }) {
  return (
    <View style={s.card}>
      <Bone width="55%" height={14} />
      <Bone width={w} height={h} style={{ marginTop: 12 }} borderRadius={12} />
    </View>
  );
}

/* ─── Screen-specific Skeletons ─── */

/** Dashboard: progress rings + quick-add strip + recent meals */
export function SkeletonDashboard() {
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.headerRow}>
        <Bone width={180} height={22} />
        <Bone width={36} height={36} borderRadius={18} />
      </View>

      {/* Score */}
      <View style={[s.center, { marginTop: 16 }]}>
        <Bone width={110} height={110} borderRadius={55} />
        <Bone width={80} height={12} style={{ marginTop: 10 }} />
      </View>

      {/* Progress rings row */}
      <View style={s.ringRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={s.ringItem}>
            <Bone width={72} height={72} borderRadius={36} />
            <Bone width={50} height={10} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>

      {/* Quick-add strip */}
      <Bone width="100%" height={56} borderRadius={14} style={{ marginTop: 20 }} />

      {/* Recent meals */}
      <Bone width={120} height={14} style={{ marginTop: 24 }} />
      {[0, 1, 2].map((i) => (
        <ListRow key={i} idx={i} />
      ))}
    </View>
  );
}

/** Notifications: header + list items */
export function SkeletonNotifications() {
  return (
    <View style={s.container}>
      <Bone width={160} height={20} style={{ marginBottom: 16 }} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ListRow key={i} idx={i} />
      ))}
    </View>
  );
}

/** Search results: search bar + result list */
export function SkeletonSearch() {
  return (
    <View style={s.container}>
      <Bone width="100%" height={48} borderRadius={24} />
      <View style={{ marginTop: 20 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <ListRow key={i} idx={i} />
        ))}
      </View>
    </View>
  );
}

/** AI Insights: score card + insight cards */
export function SkeletonAIInsights() {
  return (
    <View style={s.container}>
      {/* Top score card */}
      <Bone width="100%" height={120} borderRadius={16} />
      {/* Insight cards */}
      <Bone width={140} height={16} style={{ marginTop: 24 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={[s.card, { opacity: 1 - i * 0.12 }]}>
          <View style={s.row}>
            <Bone width={40} height={40} borderRadius={12} />
            <View style={s.rowText}>
              <Bone width="60%" height={14} />
              <Bone width="90%" height={11} style={{ marginTop: 8 }} />
              <Bone width="40%" height={11} style={{ marginTop: 6 }} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Food Details: image area + nutrient grid */
export function SkeletonFoodDetail() {
  return (
    <View style={s.container}>
      {/* Title */}
      <Bone width="75%" height={22} />
      <Bone width="45%" height={14} style={{ marginTop: 8 }} />

      {/* Nutrient cards */}
      <View style={s.gridRow}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={s.gridCell}>
            <Bone width="100%" height={80} borderRadius={12} />
          </View>
        ))}
      </View>

      {/* Element table */}
      <Bone width={130} height={16} style={{ marginTop: 20 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={[s.tableRow, { opacity: 1 - i * 0.1 }]}>
          <Bone width="30%" height={12} />
          <Bone width="50%" height={12} />
        </View>
      ))}

      {/* Allergens section */}
      <Bone width={100} height={16} style={{ marginTop: 20 }} />
      <View style={[s.row, { marginTop: 8 }]}>
        <Bone width={60} height={28} borderRadius={14} />
        <Bone width={75} height={28} borderRadius={14} style={{ marginLeft: 8 }} />
        <Bone width={55} height={28} borderRadius={14} style={{ marginLeft: 8 }} />
      </View>
    </View>
  );
}

/** Reports: comparison cards + chart area */
export function SkeletonReports() {
  return (
    <View style={s.container}>
      <Bone width={200} height={20} />
      {/* Period selector */}
      <View style={[s.row, { marginTop: 16, justifyContent: 'center' }]}>
        <Bone width={100} height={36} borderRadius={18} />
        <Bone width={100} height={36} borderRadius={18} style={{ marginLeft: 12 }} />
      </View>
      {/* Comparison cards */}
      {[0, 1, 2].map((i) => (
        <CardBlock key={i} h={70} />
      ))}
      {/* Export buttons */}
      <View style={[s.row, { marginTop: 20, justifyContent: 'center' }]}>
        <Bone width={140} height={44} borderRadius={12} />
        <Bone width={140} height={44} borderRadius={12} style={{ marginLeft: 12 }} />
      </View>
    </View>
  );
}

/** AI Chat: history bubbles */
export function SkeletonAIChat() {
  return (
    <View style={s.container}>
      <Bone width={140} height={18} style={{ marginBottom: 20 }} />
      {/* Bubbles — alternating left/right */}
      <View style={{ alignItems: 'flex-end' }}>
        <Bone width="65%" height={44} borderRadius={16} />
      </View>
      <View style={{ alignItems: 'flex-start', marginTop: 12 }}>
        <Bone width="80%" height={70} borderRadius={16} />
      </View>
      <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
        <Bone width="55%" height={36} borderRadius={16} />
      </View>
      <View style={{ alignItems: 'flex-start', marginTop: 12 }}>
        <Bone width="75%" height={56} borderRadius={16} />
      </View>
      <View style={{ alignItems: 'flex-end', marginTop: 12 }}>
        <Bone width="60%" height={44} borderRadius={16} />
      </View>
    </View>
  );
}

/** Upgrade: plan cards */
export function SkeletonUpgrade() {
  return (
    <View style={s.container}>
      <View style={s.center}>
        <Bone width={48} height={48} borderRadius={24} />
        <Bone width={180} height={22} style={{ marginTop: 12 }} />
        <Bone width={240} height={14} style={{ marginTop: 8 }} />
      </View>
      {/* Plan cards */}
      {[0, 1].map((i) => (
        <View key={i} style={[s.card, { opacity: 1 - i * 0.15 }]}>
          <Bone width="50%" height={16} />
          <Bone width="30%" height={24} style={{ marginTop: 10 }} />
          <Bone width="100%" height={12} style={{ marginTop: 12 }} />
          <Bone width="80%" height={12} style={{ marginTop: 6 }} />
          <Bone width="100%" height={44} borderRadius={12} style={{ marginTop: 16 }} />
        </View>
      ))}
    </View>
  );
}

/** Routines: routine cards list */
export function SkeletonRoutines() {
  return (
    <View style={s.container}>
      <Bone width={160} height={20} />
      {/* Today strip */}
      <Bone width="100%" height={56} borderRadius={14} style={{ marginTop: 16 }} />
      {/* Routine cards */}
      {[0, 1, 2].map((i) => (
        <View key={i} style={[s.card, { opacity: 1 - i * 0.12 }]}>
          <View style={s.row}>
            <Bone width={40} height={40} borderRadius={12} />
            <View style={s.rowText}>
              <Bone width="60%" height={14} />
              <Bone width="40%" height={11} style={{ marginTop: 8 }} />
            </View>
            <Bone width={60} height={28} borderRadius={14} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ──────────────── Styles ──────────────── */
const s = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: 'transparent' },
  center: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rowText: { flex: 1, marginLeft: 14 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ringRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
  },
  ringItem: { alignItems: 'center' },
  card: {
    backgroundColor: '#12142a',
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  gridCell: { width: '48%', marginBottom: 12 },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a3a',
  },
});
