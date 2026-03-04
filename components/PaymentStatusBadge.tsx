import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { PaymentStatus } from '@/lib/types';
import { getStatusColor, getStatusLabel } from '@/lib/payments';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
  compact?: boolean;
}

export function PaymentStatusBadge({ status, compact = true }: PaymentStatusBadgeProps) {
  const color = getStatusColor(status);

  return (
    <Chip
      compact={compact}
      style={[styles.chip, { backgroundColor: color + '22' }]}
      textStyle={[styles.text, { color }]}
    >
      {getStatusLabel(status)}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 26,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
