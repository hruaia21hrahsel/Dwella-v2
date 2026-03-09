import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Property } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';
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
  const { colors, gradients, shadows } = useTheme();

  return (
    <View style={[styles.card, { borderColor: colors.border, ...shadows.sm }]}>

      {/* Gradient header */}
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <TouchableOpacity style={styles.headerRow} onPress={onPress} activeOpacity={0.7}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={isTenantView ? 'home-account' : 'home-city'}
              size={22}
              color="#fff"
            />
          </View>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{property.name}</Text>
            <View style={styles.addressRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={12} color="rgba(255,255,255,0.65)" />
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

          {(onEdit || onDelete) && (
            <View style={styles.actions}>
              {onEdit && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(); }} hitSlop={6} style={styles.actionBtn}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); onDelete(); }} hitSlop={6} style={styles.actionBtn}>
                  <MaterialCommunityIcons name="archive-outline" size={16} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              )}
            </View>
          )}

          <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.45)" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats strip */}
      {!isTenantView && paidCount !== undefined && (
        <View style={[styles.statsStrip, { backgroundColor: colors.primarySoft, borderTopColor: colors.primaryLight + '60' }]}>
          <View style={styles.statItem}>
            <MaterialCommunityIcons name="check-circle-outline" size={14} color={colors.statusPaid} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>
              <Text style={[styles.statBold, { color: colors.textPrimary }]}>{paidCount}</Text> paid
            </Text>
          </View>
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
    backgroundColor: 'transparent',
  },
  headerGradient: {},
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
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  address: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  tenantBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tenantBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#fff',
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
    backgroundColor: 'rgba(255,255,255,0.15)',
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
