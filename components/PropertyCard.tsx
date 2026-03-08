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
  const totalRent = tenants?.reduce((sum, t) => sum + t.monthly_rent, 0) ?? 0;
  const occupiedCount = tenants?.length ?? 0;

  return (
    <View style={[styles.card, isTenantView && styles.cardTenant]}>
      {/* Header row */}
      <TouchableOpacity style={styles.headerRow} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.iconContainer, { backgroundColor: isTenantView ? '#DCFCE7' : Colors.primarySoft }]}>
          <MaterialCommunityIcons name={iconName as any} size={22} color={iconColor} />
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{property.name}</Text>
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.address} numberOfLines={1}>
              {property.address}, {property.city}
            </Text>
          </View>
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
                <MaterialCommunityIcons name="pencil-outline" size={16} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDelete(); }} hitSlop={6} style={styles.actionBtn}>
                <MaterialCommunityIcons name="archive-outline" size={16} color={Colors.error} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textDisabled} />
      </TouchableOpacity>

      {/* Stats strip — owner view only */}
      {!isTenantView && tenants && (
        <View style={styles.statsStrip}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="door-open" size={14} color={Colors.primary} />
            <Text style={styles.statText}>
              <Text style={styles.statBold}>{occupiedCount}</Text>/{property.total_units} occupied
            </Text>
          </View>
          <View style={styles.statDot} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="cash" size={14} color={Colors.statusConfirmed} />
            <Text style={styles.statText}>
              <Text style={styles.statBold}>{formatCurrency(totalRent)}</Text>/mo
            </Text>
          </View>
          {paidCount !== undefined && (
            <>
              <View style={styles.statDot} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="check-circle-outline" size={14} color={Colors.statusPaid} />
                <Text style={styles.statText}>
                  <Text style={styles.statBold}>{paidCount}</Text> paid
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Tenant list */}
      {tenants && tenants.length > 0 && (
        <View style={styles.tenantList}>
          {tenants.map((t, index) => {
            const isPending = t.invite_status === 'pending';
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tenantRow, index < tenants.length - 1 && styles.tenantRowBorder]}
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
          <MaterialCommunityIcons name="account-plus-outline" size={14} color={Colors.textDisabled} />
          <Text style={styles.noTenantsText}>No tenants added yet</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  cardTenant: {
    borderColor: Colors.statusConfirmedSoft,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  address: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tenantBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.statusConfirmedSoft,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
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
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  statBold: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.textDisabled,
  },

  // Tenant list
  tenantList: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 8,
  },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  tenantRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  tenantIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
    paddingHorizontal: 7,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  noTenantsText: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
});
