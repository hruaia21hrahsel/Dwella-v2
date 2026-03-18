import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme-context';
import { BotConversation } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface Props {
  message: BotConversation;
  onConfirm?: () => void;
  onCancel?: () => void;
  isLatestAssistant?: boolean;
}

export function ChatBubble({ message, onConfirm, onCancel, isLatestAssistant }: Props) {
  const { colors, isDark } = useTheme();
  const isUser = message.role === 'user';
  const hasPendingAction = !!(message.metadata as Record<string, unknown>)?.pending_action && isLatestAssistant;

  const actionBorderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
      <View style={[
        styles.bubble,
        isUser
          ? [styles.bubbleUser, { backgroundColor: colors.primary }]
          : [styles.bubbleBot, { backgroundColor: colors.primarySoft }],
      ]}>
        <Text style={[styles.text, { color: isUser ? colors.textOnPrimary : colors.textPrimary }]}>
          {message.content}
        </Text>
        <Text style={[
          styles.time,
          isUser
            ? { color: 'rgba(255,255,255,0.7)', textAlign: 'right' as const }
            : { color: colors.textSecondary },
        ]}>
          {formatDate(message.created_at)}
        </Text>

        {hasPendingAction && onConfirm && onCancel && (
          <View style={[styles.actionRow, { borderTopColor: actionBorderColor }]}>
            <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.statusConfirmed }]} onPress={onConfirm} activeOpacity={0.8}>
              <MaterialCommunityIcons name="check" size={16} color={colors.textOnPrimary} />
              <Text style={[styles.confirmText, { color: colors.textOnPrimary }]}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.error }]} onPress={onCancel} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close" size={16} color={colors.error} />
              <Text style={[styles.cancelText, { color: colors.error }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowBot: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 4,
  },
  confirmText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 4,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
