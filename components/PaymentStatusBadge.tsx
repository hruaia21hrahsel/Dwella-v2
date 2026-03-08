import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { PaymentStatus } from '@/lib/types';
import { getStatusColor, getStatusLabel } from '@/lib/payments';
import { useTheme } from '@/lib/theme-context';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  compact?: boolean;
}

const STATUS_ICONS: Record<PaymentStatus, string> = {
  pending: 'clock-outline',
  partial: 'clock-alert-outline',
  paid: 'check-circle-outline',
  confirmed: 'check-decagram',
  overdue: 'alert-circle-outline',
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const { colors } = useTheme();
  const color = getStatusColor(status);
  const icon = STATUS_ICONS[status];

  const STATUS_BG: Record<PaymentStatus, string> = {
    pending: colors.statusPendingSoft,
    partial: colors.statusPartialSoft,
    paid: colors.statusPaidSoft,
    confirmed: colors.statusConfirmedSoft,
    overdue: colors.statusOverdueSoft,
  };

  const bg = STATUS_BG[status];

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <MaterialCommunityIcons name={icon as any} size={12} color={color} />
      <Text style={[styles.text, { color }]}>{getStatusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});
