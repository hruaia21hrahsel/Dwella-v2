import { TouchableOpacity, View, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export function LogPaymentTabButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/log-payment')}
      style={styles.wrapper}
      activeOpacity={0.85}
    >
      <View style={styles.circle}>
        <MaterialCommunityIcons name="plus" size={30} color="#fff" />
      </View>
      <Text style={styles.label}>Log Payment</Text>
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    // Elevated above the tab bar
    marginTop: -24,
    shadowColor: Colors.primary,
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: Colors.primary,
    marginTop: 1,
  },
});
