import { useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Text, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/store';
import { useBotConversations } from '@/hooks/useBotConversations';
import { sendBotMessage } from '@/lib/bot';
import { ChatBubble } from '@/components/ChatBubble';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Shadows } from '@/constants/colors';
import { BotConversation } from '@/lib/types';
import { ProfileHeaderButton } from '@/components/ProfileHeaderButton';
import { DwellaHeaderTitle } from '@/components/DwellaHeaderTitle';

export default function BotScreen() {
  const { user } = useAuthStore();
  const { messages, loading, clearHistory } = useBotConversations(user?.id);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<BotConversation>>(null);
  const insets = useSafeAreaInsets();

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !user || sending) return;

    setInput('');
    setSending(true);

    try {
      await sendBotMessage(user.id, text);
      // Messages arrive via Realtime subscription in useBotConversations
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setSending(false);
    }
  }, [input, user, sending]);

  function handleClear() {
    Alert.alert(
      'Clear History',
      'Delete all conversation history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearHistory },
      ]
    );
  }

  const renderItem = useCallback(
    ({ item }: { item: BotConversation }) => <ChatBubble message={item} />,
    []
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <LinearGradient
        colors={Colors.gradientHeroSubtle as [string, string]}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <ProfileHeaderButton />
        <View style={styles.headerCenter}>
          <DwellaHeaderTitle />
        </View>
        {messages.length > 0 ? (
          <IconButton icon="delete-sweep" size={22} onPress={handleClear} iconColor={Colors.textSecondary} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </LinearGradient>

      {/* Messages */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="robot"
            title="Hi! I'm your Dwella Assistant"
            subtitle={"Ask me anything about your properties, tenants, or payments.\n\nExamples:\n• \"Who hasn't paid this month?\"\n• \"What's my total rent collection for March?\"\n• \"Show me overdue payments\""}
          />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 8 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {/* Sending indicator */}
      {sending && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
          <Text variant="bodySmall" style={styles.typingText}>Thinking…</Text>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything…"
          mode="outlined"
          style={styles.input}
          outlineStyle={styles.inputOutline}
          multiline
          maxLength={1000}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <IconButton
          icon="send"
          mode="contained"
          containerColor={Colors.primary}
          iconColor="#fff"
          size={22}
          onPress={handleSend}
          disabled={!input.trim() || sending}
          style={styles.sendBtn}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerSpacer: { width: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  list: { paddingTop: 12 },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  typingText: { color: Colors.textSecondary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: Colors.surface,
    gap: 4,
    ...Shadows.sm,
    shadowOffset: { width: 0, height: -2 },
  },
  input: { flex: 1, backgroundColor: Colors.surface, maxHeight: 120 },
  inputOutline: { borderRadius: 24 },
  sendBtn: { marginBottom: 2 },
});
