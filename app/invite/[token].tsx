import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ActivityIndicator, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/store';
import { getInviteDetails, acceptInvite } from '@/lib/invite';
import { useTheme } from '@/lib/theme-context';
import { formatCurrency, getOrdinal } from '@/lib/utils';
import { Tenant, Property } from '@/lib/types';
import { useTrack, EVENTS } from '@/lib/analytics';

type InviteData = Tenant & { properties: Property };

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { user, session } = useAuthStore();
  const { colors } = useTheme();
  const track = useTrack();

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
      track(EVENTS.INVITE_ACCEPTED, {
        token,
        property_id: inviteData?.property_id,
      });
      setAccepted(true);
      // Navigate to properties tab after short delay
      setTimeout(() => router.replace('/(tabs)/properties'), 1500);
    }

    setAccepting(false);
  }

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (accepted) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text variant="headlineMedium" style={{ color: colors.statusConfirmed, fontWeight: '700' }}>Welcome! 🎉</Text>
        <Text variant="bodyLarge" style={{ color: colors.textSecondary, textAlign: 'center' }}>
          You've been linked to the property. Redirecting…
        </Text>
      </View>
    );
  }

  if (error || !inviteData) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text variant="titleMedium" style={{ color: colors.error, textAlign: 'center' }}>{error || 'Invalid invite.'}</Text>
        <Button mode="outlined" onPress={() => router.replace('/(tabs)/properties')} style={styles.button}>
          Go Home
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="headlineSmall" style={{ color: colors.primary, fontWeight: '700', marginBottom: 8 }}>You've been invited!</Text>
        <Text variant="bodyMedium" style={{ color: colors.textSecondary, marginBottom: 8 }}>
          You've been added as a tenant. Review the details below and accept to get started.
        </Text>

        <Divider style={styles.divider} />

        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Property</Text>
          <Text variant="bodyLarge" style={{ color: colors.textPrimary, fontWeight: '500' }}>{inviteData.properties?.name}</Text>
        </View>
        <Divider />
        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Address</Text>
          <Text variant="bodyMedium" style={{ color: colors.textPrimary, fontWeight: '500' }}>{inviteData.properties?.address}</Text>
        </View>
        <Divider />
        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Flat / Unit</Text>
          <Text variant="bodyLarge" style={{ color: colors.textPrimary, fontWeight: '500' }}>{inviteData.flat_no}</Text>
        </View>
        <Divider />
        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Monthly Rent</Text>
          <Text variant="bodyLarge" style={{ color: colors.primary, fontWeight: '700' }}>
            {formatCurrency(inviteData.monthly_rent)}
          </Text>
        </View>
        <Divider />
        <View style={styles.detailRow}>
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>Due Date</Text>
          <Text variant="bodyLarge" style={{ color: colors.textPrimary, fontWeight: '500' }}>
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
          textColor={colors.textSecondary}
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
    padding: 24,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    gap: 0,
  },
  divider: { marginVertical: 4 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  acceptButton: { marginTop: 16 },
  acceptButtonContent: { paddingVertical: 6 },
  button: { marginTop: 8 },
});
