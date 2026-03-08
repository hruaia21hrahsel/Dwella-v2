import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Property } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, adjustPropertyColor } from '@/lib/utils';

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
  const { colors, shadows, isDark } = useTheme();
  const propColor = adjustPropertyColor(property.color ?? colors.primary, isDark);
  const iconColor = isTenantView ? colors.statusConfirmed : propColor;
  const iconBg = isTenantView ? colors.statusConfirmedSoft : propColor + '18';
  const iconName = isTenantView ? 'home-account' : 'home-city';
  const totalRent = tenants?.reduce((sum, t) => sum + t.monthly_rent, 0) ?? 0;
  const occupiedCount = tenants?.length ?? 0;

  return (
    <View style={[
      styles.card,
      { backgroundColor: colors.surface, borderColor: colors.border, ...shadows.sm },
      isTenantView
        ? { borderColor: colors.statusConfirmedSoft, marginBottom: 8 }
        : { backgroundColor: propColor + '08', borderColor: propColor + '40' },
    ]}>
      {/* Left color accent strip + content */}
      {!isTenantView && (
        <View style={[styles.colorStrip, { backgroundColor: propColor }]} />
      )}
      {/* Header row */}
      <TouchableOpacity style={styles.headerRow} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={iconName as any} size={22} color={iconColor} />
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.textPrimary }, !isTenantView && { color: propColor }]} numberOfLines={1}>{property.name}</Text>
          <View style={styles.addressRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={1}>
              {property.address}, {property.city}
            </Text>
          </View>
          {isTenantView && (
            <View style={[styles.tenantBadge, { backgroundColor: colors.statusConfirmedSoft }]}>
              <Text style={[styles.tenantBadgeText, { color: colors.statusConfirmed }]}>TENANT</Text>
            </View>
          )}
        </View>

        {/* Edit / Delete actions (owner only) */}
        {(onEdit || onDelete) && (
          <View style={styles.actions}>
            {onEdit && (
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(); }} hitSlop={6} style={[styles.actionBtn, { backgroundColor: colors.background }]}>
                <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDelete(); }} hitSlop={6} style={[styles.actionBtn, { backgroundColor: colors.background }]}>
                <MaterialCommunityIcons name="archive-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textDisabled} />
      </TouchableOpacity>

      {/* Stats strip — owner view only */}
      {!isTenantView && tenants && (
        <View style={[styles.statsStrip, { backgroundColor: propColor + '0D', borderTopColor: propColor + '20' }]}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="door-open" size={14} color={propColor} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              <Text style={[styles.statBold, { color: colors.textPrimary }]}>{occupiedCount}</Text>/{property.total_units} occupied
            </Text>
          </View>
          <View style={[styles.statDot, { backgroundColor: colors.textDisabled }]} />
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="cash" size={14} color={colors.statusConfirmed} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              <Text style={[styles.statBold, { color: colors.textPrimary }]}>{formatCurrency(totalRent)}</Text>/mo
            </Text>
          </View>
          {paidCount !== undefined && (
            <>
              <View style={[styles.statDot, { backgroundColor: colors.textDisabled }]} />
              <View style={styles.statItem}>
                <MaterialCommunityIcons name="check-circle-outline" size={14} color={colors.statusPaid} />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                  <Text style={[styles.statBold, { color: colors.textPrimary }]}>{paidCount}</Text> paid
                </Text>
              </View>
            </>
          )}
        </View>
      )}

      {/* Tenant list */}
      {tenants && tenants.length > 0 && (
        <View style={[styles.tenantList, { borderTopColor: colors.border }]}>
          {tenants.map((t, index) => {
            const isPending = t.invite_status === 'pending';
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tenantRow, index < tenants.length - 1 && [styles.tenantRowBorder, { borderBottomColor: colors.divider }]]}
                onPress={() => onTenantPress?.(t.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.tenantIcon, { backgroundColor: isPending ? colors.statusPartialSoft : colors.statusConfirmedSoft }]}>
                  <MaterialCommunityIcons
                    name={isPending ? 'account-clock-outline' : 'account-check-outline'}
                    size={14}
                    color={isPending ? colors.statusPartial : colors.statusConfirmed}
                  />
                </View>
                <View style={styles.tenantInfo}>
                  <Text style={[styles.tenantName, { color: colors.textPrimary }]} numberOfLines={1}>{t.tenant_name}</Text>
                  <Text style={[styles.tenantMeta, { color: colors.textSecondary }]}>Flat {t.flat_no} · {formatCurrency(t.monthly_rent)}/mo</Text>
                </View>
                <View style={[styles.tenantStatus, { backgroundColor: isPending ? colors.statusPartialSoft : colors.statusConfirmedSoft }]}>
                  <View style={[styles.tenantStatusDot, { backgroundColor: isPending ? colors.statusPartial : colors.statusConfirmed }]} />
                  <Text style={[styles.tenantStatusText, { color: isPending ? colors.statusPartial : colors.statusConfirmed }]}>
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
        <View style={[styles.noTenants, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <MaterialCommunityIcons name="account-plus-outline" size={14} color={colors.textDisabled} />
          <Text style={[styles.noTenantsText, { color: colors.textDisabled }]}>No tenants added yet</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  colorStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
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
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  address: {
    flex: 1,
    fontSize: 12,
  },
  tenantBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  tenantBadgeText: {
    fontSize: 9,
    fontWeight: '700',
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
    borderTopWidth: 1,
    gap: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
  },
  statBold: {
    fontWeight: '700',
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },

  // Tenant list
  tenantList: {
    borderTopWidth: 1,
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
  },
  tenantMeta: {
    fontSize: 11,
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
    paddingVertical: 12,
  },
  noTenantsText: {
    fontSize: 12,
  },
});
