import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Property } from '@/lib/types';
import { Colors, Shadows } from '@/constants/colors';
import { formatCurrency } from '@/lib/utils';

export interface TenantSummary {
  id: string;
  tenant_name: string;
  flat_no: string;
  monthly_rent: number;
  invite_status: 'pending' | 'accepted';
}

interface PropertyCardProps {
  property: Property;
  isTenantView?: boolean;
  paidCount?: number;
  tenants?: TenantSummary[];
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onTenantPress?: (tenantId: string) => void;
}

export function PropertyCard({ property, isTenantView = false, paidCount, tenants, onPress, onEdit, onDelete, onTenantPress }: PropertyCardProps) {
  const iconColor = isTenantView ? Colors.statusConfirmed : Colors.primary;
  const iconName = isTenantView ? 'home-account' : 'home-city';

  return (
    <View style={styles.card}>
      {/* Header row */}
      <TouchableOpacity style={styles.headerRow} onPress={onPress} activeOpacity={0.7}>
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
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(); }} hitSlop={6} style={styles.actionBtn}>
                <MaterialCommunityIcons name="pencil-outline" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDelete(); }} hitSlop={6} style={styles.actionBtn}>
                <MaterialCommunityIcons name="delete-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textDisabled} />
      </TouchableOpacity>

      {/* Tenant list */}
      {tenants && tenants.length > 0 && (
        <View style={styles.tenantList}>
          {tenants.map((t) => {
            const isPending = t.invite_status === 'pending';
            return (
              <TouchableOpacity
                key={t.id}
                style={styles.tenantRow}
                onPress={() => onTenantPress?.(t.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.tenantIcon, { backgroundColor: isPending ? Colors.statusPartialSoft : Colors.statusConfirmedSoft }]}>
                  <MaterialCommunityIcons
                    name={isPending ? 'account-clock-outline' : 'account-check-outline'}
                    size={14}
                    color={isPending ? Colors.statusPartial : Colors.statusConfirmed}
                  />
                </View>
                <View style={styles.tenantInfo}>
                  <Text style={styles.tenantName} numberOfLines={1}>{t.tenant_name}</Text>
                  <Text style={styles.tenantMeta}>Flat {t.flat_no} · {formatCurrency(t.monthly_rent)}/mo</Text>
                </View>
                <View style={[styles.tenantStatus, { backgroundColor: isPending ? '#FEF3C7' : '#DCFCE7' }]}>
                  <View style={[styles.tenantStatusDot, { backgroundColor: isPending ? Colors.statusPartial : Colors.statusConfirmed }]} />
                  <Text style={[styles.tenantStatusText, { color: isPending ? '#92400E' : '#166534' }]}>
                    {isPending ? 'Pending' : 'Active'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* No tenants hint */}
      {tenants && tenants.length === 0 && !isTenantView && (
        <View style={styles.noTenants}>
          <Text style={styles.noTenantsText}>No tenants yet</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
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

  // Tenant list
  tenantList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  tenantIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantInfo: {
    flex: 1,
    gap: 1,
  },
  tenantName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  tenantMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  tenantStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tenantStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tenantStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  noTenants: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  noTenantsText: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
});
