import { Image, StyleSheet } from 'react-native';

export function DwellaHeaderTitle() {
  return (
    <Image
      source={require('@/assets/images/logo.png')}
      style={styles.logo}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: { width: 160, height: 46 },
});
