import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Share } from 'react-native';
import { Tenant } from '@/lib/types';
import { Colors } from '@/constants/colors';
import { formatCurrency } from '@/lib/utils';

interface TenantCardProps {
  tenant: Tenant;
  onPress?: () => void;
}

export function TenantCard({ tenant, onPress }: TenantCardProps) {
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
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconContainer, isPending ? styles.iconPending : styles.iconAccepted]}>
        <MaterialCommunityIcons
          name={isPending ? 'account-clock-outline' : 'account-check-outline'}
          size={20}
          color={isPending ? Colors.statusPartial : Colors.statusConfirmed}
        />
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{tenant.tenant_name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Flat {tenant.flat_no}</Text>
          <Text style={styles.dot}> · </Text>
          <Text style={styles.meta}>{formatCurrency(tenant.monthly_rent)}/mo</Text>
        </View>
      </View>

      {/* Status badge */}
      <View style={[styles.statusBadge, isPending ? styles.statusPending : styles.statusAccepted]}>
        <View style={[styles.statusDot, { backgroundColor: isPending ? Colors.statusPartial : Colors.statusConfirmed }]} />
        <Text style={[styles.statusText, { color: isPending ? '#92400E' : '#166534' }]}>
          {isPending ? 'Pending' : 'Accepted'}
        </Text>
      </View>

      {isPending ? (
        <TouchableOpacity onPress={handleShareInvite} style={styles.shareBtn} hitSlop={6}>
          <MaterialCommunityIcons name="share-variant-outline" size={18} color={Colors.primary} />
        </TouchableOpacity>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textDisabled} />
      )}
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
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPending: {
    backgroundColor: Colors.statusPartialSoft,
  },
  iconAccepted: {
    backgroundColor: Colors.statusConfirmedSoft,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  dot: {
    fontSize: 12,
    color: Colors.textDisabled,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusAccepted: {
    backgroundColor: '#DCFCE7',
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
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
