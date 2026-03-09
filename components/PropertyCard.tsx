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
  onAddTenant?: () => void;
  onDelete?: () => void;
  onTenantPress?: (tenantId: string) => void;
}

function darkenHex(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * 0.65)}, ${Math.floor(g * 0.65)}, ${Math.floor(b * 0.65)})`;
}

export function PropertyCard({ property, isTenantView = false, paidCount, tenants, onPress, onEdit, onAddTenant, onDelete, onTenantPress }: PropertyCardProps) {
  const { colors, shadows } = useTheme();
  const propColor = property.color ?? colors.primary;
  const gradientColors: [string, string] = [propColor, darkenHex(propColor)];

  return (
    <View style={[styles.card, { borderColor: colors.border, ...shadows.sm }]}>

      {/* Gradient header */}
      <LinearGradient
        colors={gradientColors}
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

          {(onEdit || onAddTenant || onDelete) && (
            <View style={styles.actions}>
              {onEdit && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); onEdit(); }} hitSlop={6} style={styles.actionBtn}>
                  <MaterialCommunityIcons name="pencil-outline" size={16} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              )}
              {onAddTenant && (
                <TouchableOpacity onPress={(e) => { e.stopPropagation(); onAddTenant(); }} hitSlop={6} style={styles.actionBtn}>
                  <MaterialCommunityIcons name="account-plus-outline" size={16} color="rgba(255,255,255,0.85)" />
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
        <View style={[styles.tenantList, { backgroundColor: colors.surface }]}>
          {tenants.map((t, index) => {
            const isPending = t.invite_status === 'pending';
            const statusColor = isPending ? colors.statusPartial : colors.statusConfirmed;
            const initials = t.tenant_name.trim().split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.tenantRow,
                  index < tenants.length - 1 && [styles.tenantRowBorder, { borderBottomColor: colors.divider }],
                ]}
                onPress={() => onTenantPress?.(t.id)}
                activeOpacity={0.75}
              >
                {/* Left accent */}
                <View style={[styles.tenantAccent, { backgroundColor: statusColor }]} />

                {/* Initials avatar */}
                <View style={[styles.tenantAvatar, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.tenantInitial, { color: statusColor }]}>{initials}</Text>
                </View>

                {/* Name + flat + status */}
                <View style={styles.tenantInfo}>
                  <Text style={[styles.tenantName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t.tenant_name}
                  </Text>
                  <View style={styles.tenantMetaRow}>
                    <View style={[styles.flatPill, { backgroundColor: colors.primarySoft }]}>
                      <Text style={[styles.flatPillText, { color: colors.primary }]}>Flat {t.flat_no}</Text>
                    </View>
                    <View style={[styles.tenantStatusDot, { backgroundColor: statusColor }]} />
                    <Text style={[styles.tenantStatusLabel, { color: statusColor }]}>
                      {isPending ? 'Pending' : 'Active'}
                    </Text>
                  </View>
                </View>

                {/* Rent + chevron */}
                <View style={styles.tenantRight}>
                  <Text style={[styles.tenantRent, { color: colors.primary }]}>
                    {formatCurrency(t.monthly_rent)}
                  </Text>
                  <Text style={[styles.tenantRentSub, { color: colors.textDisabled }]}>/mo</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={colors.textDisabled} />
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
  tenantList: {},
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingRight: 14,
    paddingLeft: 0,
  },
  tenantRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tenantAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  tenantAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenantInitial: {
    fontSize: 14,
    fontWeight: '800',
  },
  tenantInfo: {
    flex: 1,
    gap: 4,
  },
  tenantName: {
    fontSize: 14,
    fontWeight: '700',
  },
  tenantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flatPill: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  flatPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tenantStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tenantStatusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tenantRight: {
    alignItems: 'flex-end',
  },
  tenantRent: {
    fontSize: 14,
    fontWeight: '800',
  },
  tenantRentSub: {
    fontSize: 10,
    fontWeight: '500',
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
