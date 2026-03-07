import { TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';

export function AssistantHeaderButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/bot')}
      style={styles.btn}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name="robot-outline" size={26} color={Colors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginRight: 12,
  },
});
