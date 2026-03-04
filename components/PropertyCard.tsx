import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Property } from '@/lib/types';
import { Colors } from '@/constants/colors';

interface PropertyCardProps {
  property: Property;
  isTenantView?: boolean;
  paidCount?: number;
  onPress?: () => void;
}

export function PropertyCard({ property, isTenantView = false, paidCount, onPress }: PropertyCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name={isTenantView ? 'home-account' : 'home-city'}
          size={28}
          color={Colors.primary}
        />
      </View>

      <View style={styles.info}>
        <Text variant="titleMedium" style={styles.name} numberOfLines={1}>
          {property.name}
        </Text>
        <Text variant="bodySmall" style={styles.address} numberOfLines={1}>
          {property.address}, {property.city}
        </Text>

        {!isTenantView && (
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
        )}

        {isTenantView && (
          <Text variant="bodySmall" style={styles.tenantBadge}>Tenant</Text>
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
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary + '15',
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
  tenantBadge: {
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
});
