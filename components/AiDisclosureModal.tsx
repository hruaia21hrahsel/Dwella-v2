import { StyleSheet } from 'react-native';
import { Modal, Portal, Text, Button, Surface } from 'react-native-paper';
import { useAuthStore } from '@/lib/store';
import { useTheme } from '@/lib/theme-context';

export function AiDisclosureModal() {
  const aiDisclosureAccepted = useAuthStore((s) => s.aiDisclosureAccepted);
  const setAiDisclosureAccepted = useAuthStore((s) => s.setAiDisclosureAccepted);
  const { colors } = useTheme();

  if (aiDisclosureAccepted) return null;

  return (
    <Portal>
      <Modal
        visible={true}
        dismissable={false}
        onDismiss={() => {}}
        contentContainerStyle={styles.container}
      >
        <Surface style={[styles.surface, { backgroundColor: colors.surface }]} elevation={4}>
          <Text variant="titleLarge" style={[styles.title, { color: colors.textPrimary }]}>
            AI Features Use Your Data
          </Text>
          <Text variant="bodyMedium" style={[styles.message, { color: colors.textSecondary }]}>
            When you use Dwella's AI assistant or AI tools, your property names, tenant names, and payment information are sent to Anthropic's Claude API to generate responses.
            {'\n\n'}
            This data is processed by Anthropic to provide the AI features. It is not used for advertising or sold to third parties.
          </Text>
          <Button
            mode="contained"
            onPress={() => setAiDisclosureAccepted(true)}
            buttonColor={colors.primary}
          >
            I Understand
          </Button>
        </Surface>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 24,
  },
  surface: {
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  title: {
    fontWeight: '700',
  },
  message: {
    lineHeight: 22,
  },
});
