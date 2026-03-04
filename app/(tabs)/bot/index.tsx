import { View, StyleSheet } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { Colors } from '@/constants/colors';

export default function BotScreen() {
  return (
    <View style={styles.container}>
      <EmptyState
        icon="robot"
        title="AI Bot — Coming Soon"
        subtitle="Your AI-powered rental assistant will be available in Phase C."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
});
