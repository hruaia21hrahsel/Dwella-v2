import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';

export function AssistantHeaderButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/bot')}
      style={styles.btn}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="robot-outline" size={26} color={colors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
