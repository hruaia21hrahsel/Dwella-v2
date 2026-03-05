import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Property } from '@/lib/types';
import { Colors, Shadows } from '@/constants/colors';

interface PropertyCardProps {
  property: Property;
  isTenantView?: boolean;
  paidCount?: number;
  onPress?: () => void;
}

export function PropertyCard({ property, isTenantView = false, paidCount, onPress }: PropertyCardProps) {
  const iconGradient: [string, string] = isTenantView
    ? ['#F0FDF4', '#DCFCE7']
    : [Colors.primarySoft, '#DDD6FE'];
  const iconColor = isTenantView ? Colors.statusConfirmed : Colors.primary;
  const iconName = isTenantView ? 'home-account' : 'home-city';

  const progressFraction = paidCount !== undefined && property.total_units > 0
    ? paidCount / property.total_units
    : 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <LinearGradient colors={iconGradient} style={styles.iconContainer}>
        <MaterialCommunityIcons name={iconName as any} size={28} color={iconColor} />
      </LinearGradient>

      <View style={styles.info}>
        <Text variant="titleMedium" style={styles.name} numberOfLines={1}>
          {property.name}
        </Text>
        <Text variant="bodySmall" style={styles.address} numberOfLines={1}>
          {property.address}, {property.city}
        </Text>

        {!isTenantView && (
          <>
            <View style={styles.metaRow}>
              <Text variant="bodySmall" style={styles.meta}>
                {property.total_units} unit{property.total_units !== 1 ? 's' : ''}
              </Text>
              {paidCount !== undefined && (
                <Text variant="bodySmall" style={styles.meta}>
                  · {paidCount}/{property.total_units} paid
                </Text>
              )}
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
            </View>
          </>
        )}

        {isTenantView && (
          <View style={styles.tenantBadge}>
            <Text style={styles.tenantBadgeText}>TENANT</Text>
          </View>
        )}
      </View>

      <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 12,
    ...Shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  address: {
    color: Colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  meta: {
    color: Colors.textSecondary,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.statusConfirmed,
    borderRadius: 2,
  },
  tenantBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.statusConfirmedSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  tenantBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.statusConfirmed,
    letterSpacing: 0.5,
  },
});
