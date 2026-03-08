import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Property } from '@/lib/types';
import { Colors, Shadows } from '@/constants/colors';

interface PropertyCardProps {
  property: Property;
  isTenantView?: boolean;
  paidCount?: number;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function PropertyCard({ property, isTenantView = false, paidCount, onPress, onEdit, onDelete }: PropertyCardProps) {
  const iconColor = isTenantView ? Colors.statusConfirmed : Colors.primary;
  const iconName = isTenantView ? 'home-account' : 'home-city';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, { backgroundColor: isTenantView ? '#DCFCE7' : Colors.primarySoft }]}>
        <MaterialCommunityIcons name={iconName as any} size={22} color={iconColor} />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{property.name}</Text>
        <Text style={styles.address} numberOfLines={1}>
          {property.address}, {property.city}
        </Text>
        {!isTenantView && (
          <Text style={styles.meta}>
            {property.total_units} unit{property.total_units !== 1 ? 's' : ''}
            {paidCount !== undefined ? ` · ${paidCount}/${property.total_units} paid` : ''}
          </Text>
        )}
        {isTenantView && (
          <View style={styles.tenantBadge}>
            <Text style={styles.tenantBadgeText}>TENANT</Text>
          </View>
        )}
      </View>

      {/* Edit / Delete actions (owner only) */}
      {(onEdit || onDelete) && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity onPress={onEdit} hitSlop={6} style={styles.actionBtn}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity onPress={onDelete} hitSlop={6} style={styles.actionBtn}>
              <MaterialCommunityIcons name="delete-outline" size={18} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textDisabled} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  address: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  meta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  tenantBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.statusConfirmedSoft,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
  },
  tenantBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.statusConfirmed,
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
