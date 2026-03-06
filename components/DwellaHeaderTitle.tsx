import { Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export function DwellaHeaderTitle() {
  return <Text style={styles.title}>Dwella</Text>;
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
});
