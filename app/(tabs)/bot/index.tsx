import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text, TextInput, IconButton, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { useBotConversations } from '@/hooks/useBotConversations';
import { sendBotMessage } from '@/lib/bot';
import { ChatBubble } from '@/components/ChatBubble';
import { DwellaHeader } from '@/components/DwellaHeader';
import { useTheme } from '@/lib/theme-context';
import { BotConversation } from '@/lib/types';

const EXAMPLES = [
  "Log Rahul's March rent as paid",
  'Add a new property called Sunrise Apartments',
  "Who hasn't paid this month?",
  'Send a reminder to all overdue tenants',
];

const MAX_INPUT_LENGTH = 1000;
const COUNTER_THRESHOLD = 800;

export default function BotScreen() {
  const { colors, shadows } = useTheme();
  const { user } = useAuthStore();
  const { messages, loading, clearHistory, refetch } = useBotConversations(user?.id);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const listRef = useRef<FlatList<BotConversation>>(null);
  const insets = useSafeAreaInsets();

  // Keep the latest message above the keyboard: scroll to end whenever
  // the keyboard shows. The FlatList doesn't reposition on its own when
  // its viewport shrinks, so without this the newest bubble hides behind
  // the input row.
  useEffect(() => {
    const evt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(evt, () => {
      // Wait a frame so the KAV has applied its padding before we scroll.
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    });
    return () => sub.remove();
  }, []);

  // Optimistic bubble: show the user's message immediately while the server round-trips.
  const displayMessages = useMemo<BotConversation[]>(() => {
    if (!pendingUserText || !user) return messages;
    // Suppress the optimistic row if the realtime insert has already echoed it back.
    const alreadyEchoed = messages.some(
      (m) => m.role === 'user' && m.content === pendingUserText,
    );
    if (alreadyEchoed) return messages;
    const optimistic: BotConversation = {
      id: `pending-${pendingUserText}`,
      user_id: user.id,
      role: 'user',
      content: pendingUserText,
      created_at: new Date().toISOString(),
      metadata: null,
    };
    return [...messages, optimistic];
  }, [messages, pendingUserText, user]);

  const hasConversation = displayMessages.length > 0;

  function handleClear() {
    Alert.alert(
      'Clear History',
      'Delete all conversation history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearHistory },
      ],
    );
  }

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !user || sending) return;

      setInput('');
      setPendingUserText(trimmed);
      setSending(true);

      try {
        await sendBotMessage(user.id, trimmed);
        // Realtime isn't reliable here — pull the authoritative list so the
        // user's message and the assistant's reply appear without needing
        // the screen to be re-focused.
        await refetch({ silent: true });
      } catch (err) {
        useToastStore.getState().showToast(String(err), 'error');
      } finally {
        setSending(false);
        setPendingUserText(null);
      }
    },
    [user, sending, refetch],
  );

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
  const lastAssistantIndex = displayMessages.length > 0
    ? displayMessages.reduce((lastIdx, msg, idx) => (msg.role === 'assistant' ? idx : lastIdx), -1)
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
    [lastAssistantIndex, handleConfirm, handleCancel],
  );

  const canSend = !!input.trim() && !sending;
  const showCounter = input.length >= COUNTER_THRESHOLD;

  const clearButton = hasConversation ? (
    <IconButton
      icon="delete-sweep"
      size={22}
      onPress={handleClear}
      iconColor={colors.textSecondary}
      accessibilityLabel="Clear conversation history"
    />
  ) : null;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <DwellaHeader rightSlot={clearButton} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : !hasConversation ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.introContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.introIcon, { backgroundColor: colors.primarySoft, ...shadows.sm }]}>
            <MaterialCommunityIcons name="robot" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.introTitle, { color: colors.textPrimary }]}>
            Hi! I'm your Dwella Assistant
          </Text>
          <Text style={[styles.introSubtitle, { color: colors.textSecondary }]}>
            Ask me anything or tell me what to do.
          </Text>

          <Text style={[styles.examplesLabel, { color: colors.textDisabled }]}>Try asking</Text>
          <View style={styles.examplesList}>
            {EXAMPLES.map((example) => (
              <TouchableOpacity
                key={example}
                style={[styles.exampleChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setInput(example)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Use example: ${example}`}
              >
                <MaterialCommunityIcons
                  name="lightbulb-on-outline"
                  size={16}
                  color={colors.primary}
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.exampleText, { color: colors.textPrimary }]} numberOfLines={2}>
                  {example}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={displayMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: 8 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Sending indicator — only when there's an actual conversation in flight */}
      {sending && hasConversation && (
        <View style={styles.typingRow}>
          <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
            Thinking…
          </Text>
        </View>
      )}

      {/* Input */}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <View style={styles.inputWrap}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Message your Assistant…"
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.surface }]}
            outlineStyle={styles.inputOutline}
            multiline
            maxLength={MAX_INPUT_LENGTH}
            onFocus={() => {
              // Fallback for the "tap input while keyboard is already up"
              // case, where keyboardWillShow won't fire a second time.
              requestAnimationFrame(() => {
                listRef.current?.scrollToEnd({ animated: true });
              });
            }}
            accessibilityLabel="Message input"
          />
          {showCounter && (
            <Text style={[styles.counter, { color: input.length >= MAX_INPUT_LENGTH ? colors.statusOverdue : colors.textDisabled }]}>
              {input.length}/{MAX_INPUT_LENGTH}
            </Text>
          )}
        </View>
        <IconButton
          icon="send"
          mode="contained"
          containerColor={canSend ? colors.primary : colors.border}
          iconColor={canSend ? '#fff' : colors.textDisabled}
          size={22}
          onPress={handleSend}
          disabled={!canSend}
          style={styles.sendBtn}
          accessibilityLabel="Send message"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 12 },
  introContent: {
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  introIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  introSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  examplesLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginTop: 28,
    marginBottom: 10,
  },
  examplesList: {
    width: '100%',
    gap: 8,
  },
  exampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  exampleText: {
    flex: 1,
    fontSize: 14,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    maxHeight: 120,
  },
  inputOutline: { borderRadius: 24 },
  counter: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 2,
    marginRight: 8,
  },
  sendBtn: { marginBottom: 2 },
});
