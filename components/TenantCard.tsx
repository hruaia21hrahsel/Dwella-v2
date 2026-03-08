import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Share } from 'react-native';
import { Tenant } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency } from '@/lib/utils';

interface TenantCardProps {
  tenant: Tenant;
  onPress?: () => void;
}

export function TenantCard({ tenant, onPress }: TenantCardProps) {
  const { colors } = useTheme();
  const isPending = tenant.invite_status === 'pending';
  const isAccepted = tenant.invite_status === 'accepted';

  async function handleShareInvite() {
    const inviteLink = `dwella://invite/${tenant.invite_token}`;
    await Share.share({
      message: `You've been added as a tenant on Dwella!\n\n${inviteLink}`,
      title: 'Tenant Invite',
    });
  }

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: isPending ? colors.statusPartialSoft : colors.statusConfirmedSoft }]}>
        <MaterialCommunityIcons
          name={isPending ? 'account-clock-outline' : 'account-check-outline'}
          size={20}
          color={isPending ? colors.statusPartial : colors.statusConfirmed}
        />
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{tenant.tenant_name}</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>Flat {tenant.flat_no}</Text>
          <Text style={[styles.dot, { color: colors.textDisabled }]}> · </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>{formatCurrency(tenant.monthly_rent)}/mo</Text>
        </View>
      </View>

      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: isPending ? colors.statusPartialSoft : colors.statusConfirmedSoft }]}>
        <View style={[styles.statusDot, { backgroundColor: isPending ? colors.statusPartial : colors.statusConfirmed }]} />
        <Text style={[styles.statusText, { color: isPending ? colors.statusPartial : colors.statusConfirmed }]}>
          {isPending ? 'Pending' : 'Accepted'}
        </Text>
      </View>

      {isPending ? (
        <TouchableOpacity onPress={handleShareInvite} style={[styles.shareBtn, { backgroundColor: colors.primarySoft }]} hitSlop={6}>
          <MaterialCommunityIcons name="share-variant-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textDisabled} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
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
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meta: {
    fontSize: 12,
  },
  dot: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
