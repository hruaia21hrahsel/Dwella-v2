import { Image, View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export function DwellaHeaderTitle() {
  return (
    <View style={styles.row}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Dwella</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 28, height: 28 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3 },
});
