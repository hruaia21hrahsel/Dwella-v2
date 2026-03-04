import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ActivityIndicator, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store';
import { getInviteDetails, acceptInvite } from '@/lib/invite';
import { Colors } from '@/constants/colors';
import { formatCurrency, getOrdinal } from '@/lib/utils';
import { Tenant, Property } from '@/lib/types';

type InviteData = Tenant & { properties: Property };

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, session } = useAuthStore();

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!session) {
      // Not logged in — redirect to login, then back here
      router.replace(`/(auth)/login`);
      return;
    }
    fetchInvite();
  }, [token, session]);

  async function fetchInvite() {
    setLoading(true);
    const data = await getInviteDetails(token);
    if (!data) {
      setError('This invite link is invalid or has already been used.');
    } else {
      setInviteData(data as InviteData);
    }
    setLoading(false);
  }

  async function handleAccept() {
    if (!user || !token) return;
    setAccepting(true);

    const result = await acceptInvite(token, user.id);
    if (!result.success) {
      setError(result.error ?? 'Failed to accept invite.');
    } else {
      setAccepted(true);
      // Navigate to properties tab after short delay
      setTimeout(() => router.replace('/(tabs)/properties'), 1500);
    }

    setAccepting(false);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (accepted) {
    return (
      <View style={styles.centered}>
        <Text variant="headlineMedium" style={styles.successTitle}>Welcome! 🎉</Text>
        <Text variant="bodyLarge" style={styles.successSubtitle}>
          You've been linked to the property. Redirecting…
        </Text>
      </View>
    );
  }

  if (error || !inviteData) {
    return (
      <View style={styles.centered}>
        <Text variant="titleMedium" style={styles.errorText}>{error || 'Invalid invite.'}</Text>
        <Button mode="outlined" onPress={() => router.replace('/(tabs)/properties')} style={styles.button}>
          Go Home
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text variant="headlineSmall" style={styles.headline}>You've been invited!</Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          You've been added as a tenant. Review the details below and accept to get started.
        </Text>

        <Divider style={styles.divider} />

        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={styles.label}>Property</Text>
          <Text variant="bodyLarge" style={styles.value}>{inviteData.properties?.name}</Text>
        </View>
        <Divider />
        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={styles.label}>Address</Text>
          <Text variant="bodyMedium" style={styles.value}>{inviteData.properties?.address}</Text>
        </View>
        <Divider />
        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={styles.label}>Flat / Unit</Text>
          <Text variant="bodyLarge" style={styles.value}>{inviteData.flat_no}</Text>
        </View>
        <Divider />
        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={styles.label}>Monthly Rent</Text>
          <Text variant="bodyLarge" style={[styles.value, styles.rentValue]}>
            {formatCurrency(inviteData.monthly_rent)}
          </Text>
        </View>
        <Divider />
        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={styles.label}>Due Date</Text>
          <Text variant="bodyLarge" style={styles.value}>
            {getOrdinal(inviteData.due_day)} of each month
          </Text>
        </View>

        <Button
          mode="contained"
          onPress={handleAccept}
          loading={accepting}
          disabled={accepting}
          style={styles.acceptButton}
          contentStyle={styles.acceptButtonContent}
        >
          Accept Invitation
        </Button>

        <Button
          mode="text"
          onPress={() => router.replace('/(tabs)/properties')}
          textColor={Colors.textSecondary}
        >
          Decline
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: Colors.background,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 0,
  },
  headline: {
    color: Colors.primary,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  divider: { marginVertical: 4 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  label: { color: Colors.textSecondary },
  value: { color: Colors.textPrimary, fontWeight: '500' },
  rentValue: { color: Colors.primary, fontWeight: '700' },
  acceptButton: { marginTop: 16 },
  acceptButtonContent: { paddingVertical: 6 },
  successTitle: { color: Colors.statusConfirmed, fontWeight: '700' },
  successSubtitle: { color: Colors.textSecondary, textAlign: 'center' },
  errorText: { color: Colors.error, textAlign: 'center' },
  button: { marginTop: 8 },
});
