import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { GlassCard } from '@/components/GlassCard';
import { useTheme } from '@/lib/theme-context';

interface KpiCardProps {
  label: string;
  value: string;
  valueColor?: string;
  icon?: string;
}

export function KpiCard({ label, value, valueColor, icon }: KpiCardProps) {
  const { colors } = useTheme();

  return (
    <GlassCard variant="default" style={styles.card}>
      <View style={styles.content}>
        {icon ? (
          <MaterialCommunityIcons
            name={icon as ComponentProps<typeof MaterialCommunityIcons>['name']}
            size={20}
            color={colors.primary}
            style={styles.icon}
          />
        ) : null}
        <Text style={[styles.value, { color: valueColor ?? colors.textPrimary }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={[styles.label, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    minHeight: 88,
  },
  content: {
    flex: 1,
  },
  icon: {
    marginBottom: 4,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
  },
});
