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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { useBotConversations } from '@/hooks/useBotConversations';
import { sendBotMessage } from '@/lib/bot';
import { ChatBubble } from '@/components/ChatBubble';
import { EmptyState } from '@/components/EmptyState';
import { DwellaHeader } from '@/components/DwellaHeader';
import { useTheme } from '@/lib/theme-context';
import { BotConversation } from '@/lib/types';

export default function BotScreen() {
  const { colors, shadows } = useTheme();
  const { user } = useAuthStore();
  const { messages, loading, clearHistory } = useBotConversations(user?.id);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<BotConversation>>(null);
  const insets = useSafeAreaInsets();

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

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !user || sending) return;

    setInput('');
    setSending(true);

    try {
      await sendBotMessage(user.id, text.trim());
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err) {
      useToastStore.getState().showToast(String(err), 'error');
    } finally {
      setSending(false);
    }
  }, [user, sending]);

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleConfirm = useCallback(() => {
    sendMessage('yes');
  }, [sendMessage]);

  const handleCancel = useCallback(() => {
    sendMessage('cancel');
  }, [sendMessage]);

  // Find the last assistant message index for showing action buttons
  const lastAssistantIndex = messages.length > 0
    ? messages.reduce((lastIdx, msg, idx) => msg.role === 'assistant' ? idx : lastIdx, -1)
    : -1;

  const renderItem = useCallback(
    ({ item, index }: { item: BotConversation; index: number }) => (
      <ChatBubble
        message={item}
        isLatestAssistant={index === lastAssistantIndex}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    ),
    [lastAssistantIndex, handleConfirm, handleCancel]
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <DwellaHeader />
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 60}
    >
      {/* Messages */}
      {messages.length > 0 && (
        <View style={styles.chatTopBar}>
          <View style={{ flex: 1 }} />
          <IconButton icon="delete-sweep" size={22} onPress={handleClear} iconColor={colors.textSecondary} />
        </View>
      )}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="robot"
            title="Hi! I'm your Dwella Assistant"
            subtitle={"Ask me anything or tell me what to do!\n\nExamples:\n• \"Log Rahul's March rent as paid\"\n• \"Add a new property called Sunrise Apartments\"\n• \"Who hasn't paid this month?\"\n• \"Send a reminder to all overdue tenants\""}
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
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          <Text variant="bodySmall" style={[styles.typingText, { color: colors.textSecondary }]}>Thinking…</Text>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { backgroundColor: colors.surface, ...shadows.sm, shadowOffset: { width: 0, height: -2 } }, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything or give a command…"
          mode="outlined"
          style={[styles.input, { backgroundColor: colors.surface }]}
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
          containerColor={colors.primary}
          iconColor="#fff"
          size={22}
          onPress={handleSend}
          disabled={!input.trim() || sending}
          style={styles.sendBtn}
        />
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatTopBar: { flexDirection: 'row', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  list: { paddingTop: 12 },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  typingText: {},
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
  },
  input: { flex: 1, maxHeight: 120 },
  inputOutline: { borderRadius: 24 },
  sendBtn: { marginBottom: 2 },
});
