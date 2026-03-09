import { StyleSheet, TouchableOpacity } from 'react-native';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Share } from 'react-native';
import { Tenant } from '@/lib/types';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency } from '@/lib/utils';

interface TenantCardProps {
  tenant: Tenant;
  onPress?: () => void;
}

export function TenantCard({ tenant, onPress }: TenantCardProps) {
  const { colors, gradients, shadows } = useTheme();
  const isPending = tenant.invite_status === 'pending';

  async function handleShareInvite() {
    const inviteLink = `dwella://invite/${tenant.invite_token}`;
    await Share.share({
      message: `You've been added as a tenant on Dwella!\n\n${inviteLink}`,
      title: 'Tenant Invite',
    });
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[styles.wrapper, shadows.sm]}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={isPending ? 'account-clock-outline' : 'account-check-outline'}
            size={20}
            color="#fff"
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
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: isPending ? colors.statusPartial : colors.statusConfirmed }]} />
          <Text style={styles.statusText}>
            {isPending ? 'Pending' : 'Accepted'}
          </Text>
        </View>

        {isPending ? (
          <TouchableOpacity onPress={handleShareInvite} style={styles.shareBtn} hitSlop={6}>
            <MaterialCommunityIcons name="share-variant-outline" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <MaterialCommunityIcons name="chevron-right" size={18} color="rgba(255,255,255,0.45)" />
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  dot: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
