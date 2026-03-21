import { ReactNode } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/lib/theme-context';

interface ChartSectionCardProps {
  title: string;
  icon: string;
  children: ReactNode;
  style?: ViewStyle;
}

export function ChartSectionCard({ title, icon, children, style }: ChartSectionCardProps) {
  const { colors } = useTheme();

  return (
    <GlassCard variant="default" style={style ? [styles.card, style] : styles.card}>
      <View style={styles.heading}>
        <MaterialCommunityIcons
          name={icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={20}
          color={colors.primary}
        />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {children}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
});
