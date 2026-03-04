import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Chip, IconButton } from 'react-native-paper';
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

  async function handleShareInvite() {
    const inviteLink = `dwella://invite/${tenant.invite_token}`;
    await Share.share({
      message: `You've been added as a tenant on Dwella!\n\n${inviteLink}`,
      title: 'Tenant Invite',
    });
  }

  const statusColor = {
    pending: Colors.statusPending,
    accepted: Colors.statusConfirmed,
    expired: Colors.statusOverdue,
  }[tenant.invite_status];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name={isPending ? 'account-clock' : 'account-check'}
          size={24}
          color={isPending ? Colors.textSecondary : Colors.primary}
        />
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text variant="titleSmall" style={styles.name}>
            {tenant.tenant_name}
          </Text>
          <Chip
            compact
            style={[styles.statusChip, { backgroundColor: statusColor + '22' }]}
            textStyle={[styles.statusText, { color: statusColor }]}
          >
            {isPending ? 'Invite Pending' : tenant.invite_status}
          </Chip>
        </View>

        <View style={styles.bottomRow}>
          <Text variant="bodySmall" style={styles.flatNo}>
            Flat {tenant.flat_no}
          </Text>
          <Text variant="bodySmall" style={styles.rent}>
            {formatCurrency(tenant.monthly_rent)}/mo
          </Text>
        </View>
      </View>

      {isPending ? (
        <IconButton
          icon="share-variant"
          size={20}
          iconColor={Colors.primary}
          onPress={handleShareInvite}
        />
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textSecondary} />
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
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    color: Colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  statusChip: {
    height: 22,
  },
  statusText: {
    fontSize: 11,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  flatNo: {
    color: Colors.textSecondary,
  },
  rent: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
