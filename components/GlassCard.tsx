import { ReactNode } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme-context';

interface GlassCardProps {
  variant?: 'default' | 'elevated' | 'hero';
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export function GlassCard({ variant = 'default', children, style }: GlassCardProps) {
  const { colors, gradients, shadows, isDark } = useTheme();

  const shadow = variant === 'hero' ? shadows.hero : variant === 'elevated' ? shadows.md : shadows.sm;
  const bg = variant === 'hero'
    ? (isDark ? colors.surfaceElevated : colors.surface)
    : (isDark ? colors.surface : colors.glassBg);
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <View style={[styles.card, shadow, { backgroundColor: bg, borderColor }, style]}>
      <LinearGradient
        colors={gradients.glassOverlay}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
