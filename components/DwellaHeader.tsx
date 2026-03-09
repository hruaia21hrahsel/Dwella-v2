import { ReactNode } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Line, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme-context';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';
import { NotificationsHeaderButton } from '@/components/NotificationsHeaderButton';

const SCREEN_W = Dimensions.get('window').width;

interface Props {
  right?: ReactNode;
  showNotifications?: boolean;
}

export function DwellaHeader({ right, showNotifications = true }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const defaultRight = showNotifications
    ? <NotificationsHeaderButton dark />
    : <View style={{ width: 56 }} />;

  // Decoration zone: strictly between the two 56px buttons
  const W = SCREEN_W - 112;

  return (
    <LinearGradient
      colors={[colors.surface, colors.primarySoft]}
      start={{ x: 0.35, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.header, { paddingTop: insets.top, height: 60 + insets.top, shadowColor: colors.primary }]}
    >
      {/* Property map decoration — kept within [56, SCREEN_W-56] to avoid both buttons */}
      <View style={{ position: 'absolute', bottom: 0, left: 56, right: 56, height: 60 }}>
        <Svg width={W} height={60}>
          {/* Cadastral grid lines */}
          {[0.18, 0.34, 0.52, 0.70].map((x, i) => (
            <Line key={`v${i}`} x1={W * x} y1={0} x2={W * x} y2={60}
              stroke={colors.primary} strokeOpacity={0.10} strokeWidth={0.8} strokeDasharray="2,5" />
          ))}
          <Line x1={0} y1={20} x2={W} y2={20}
            stroke={colors.primary} strokeOpacity={0.08} strokeWidth={0.8} strokeDasharray="2,5" />
          <Line x1={0} y1={40} x2={W} y2={40}
            stroke={colors.primary} strokeOpacity={0.08} strokeWidth={0.8} strokeDasharray="2,5" />

          {/* Property lot blocks */}
          <Rect x={W * 0.01} y={2}  width={W * 0.16} height={17} rx={1} fill={colors.primary} fillOpacity={0.07} />
          <Rect x={W * 0.01} y={21} width={W * 0.16} height={17} rx={1} fill={colors.primary} fillOpacity={0.07} />
          <Rect x={W * 0.19} y={2}  width={W * 0.16} height={37} rx={1} fill={colors.primary} fillOpacity={0.07} />
          <Rect x={W * 0.19} y={41} width={W * 0.16} height={17} rx={1} fill={colors.primary} fillOpacity={0.05} />
          <Rect x={W * 0.37} y={2}  width={W * 0.16} height={17} rx={1} fill={colors.primary} fillOpacity={0.05} />

          {/* Pin 1 — large */}
          <Circle cx={W * 0.62} cy={33} r={9} fill={colors.primary} fillOpacity={0.18} />
          <Circle cx={W * 0.62} cy={33} r={4} fill={colors.primary} fillOpacity={0.35} />
          <Path d={`M${W * 0.62 - 6},38 L${W * 0.62},53 L${W * 0.62 + 6},38 Z`}
            fill={colors.primary} fillOpacity={0.18} />

          {/* Pin 2 — medium */}
          <Circle cx={W * 0.84} cy={27} r={7} fill={colors.primary} fillOpacity={0.13} />
          <Circle cx={W * 0.84} cy={27} r={3} fill={colors.primary} fillOpacity={0.26} />
          <Path d={`M${W * 0.84 - 4.5},32 L${W * 0.84},44 L${W * 0.84 + 4.5},32 Z`}
            fill={colors.primary} fillOpacity={0.13} />
        </Svg>
      </View>

      <ProfileHeaderButton dark />
      <View style={{ flex: 1, alignItems: 'center' }}>
        <DwellaHeaderTitle dark />
      </View>
      {right ?? defaultRight}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 3,
  },
});
