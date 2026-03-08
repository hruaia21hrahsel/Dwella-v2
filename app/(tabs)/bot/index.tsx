import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Text, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { useBotConversations } from '@/hooks/useBotConversations';
import { sendBotMessage } from '@/lib/bot';
import { ChatBubble } from '@/components/ChatBubble';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Shadows } from '@/constants/colors';
import { BotConversation } from '@/lib/types';

export default function BotScreen() {
  const { user } = useAuthStore();
  const { messages, loading, clearHistory } = useBotConversations(user?.id);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<BotConversation>>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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

  useEffect(() => {
    navigation.setOptions({
      headerRight: messages.length > 0
        ? () => <IconButton icon="delete-sweep" size={22} onPress={handleClear} iconColor={Colors.textSecondary} />
        : () => <View style={{ width: 50 }} />,
    });
  }, [messages.length, navigation]);

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
      useToastStore.getState().showToast(String(err), 'error');
    } finally {
      setSending(false);
    }
  }, [input, user, sending]);

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
    gap: 8,
    ...Shadows.sm,
    shadowOffset: { width: 0, height: -2 },
  },
  input: { flex: 1, backgroundColor: Colors.surface, maxHeight: 120 },
  inputOutline: { borderRadius: 24 },
  sendBtn: { marginBottom: 2 },
});
