import { TouchableOpacity, View, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';

export function LogPaymentTabButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/log-payment')}
      style={styles.wrapper}
      activeOpacity={0.85}
    >
      <View style={[styles.circle, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
        <MaterialCommunityIcons name="plus" size={30} color={colors.textOnPrimary} />
      </View>
      <Text style={[styles.label, { color: colors.primary }]}>Log Payment</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
    overflow: 'visible',
  },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    // Elevated above the tab bar
    marginTop: -24,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
});
