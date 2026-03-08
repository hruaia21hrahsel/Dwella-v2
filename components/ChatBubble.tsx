import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { BotConversation } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface Props {
  message: BotConversation;
  onConfirm?: () => void;
  onCancel?: () => void;
  isLatestAssistant?: boolean;
}

export function ChatBubble({ message, onConfirm, onCancel, isLatestAssistant }: Props) {
  const isUser = message.role === 'user';
  const hasPendingAction = !!(message.metadata as any)?.pending_action && isLatestAssistant;

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textBot]}>
          {message.content}
        </Text>
        <Text style={[styles.time, isUser ? styles.timeUser : styles.timeBot]}>
          {formatDate(message.created_at)}
        </Text>

        {hasPendingAction && onConfirm && onCancel && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
              <Text style={styles.confirmText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <MaterialCommunityIcons name="close" size={16} color={Colors.error} />
              <Text style={styles.cancelText}>Cancel</Text>
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
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: Colors.primarySoft,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textUser: {
    color: '#fff',
  },
  textBot: {
    color: Colors.textPrimary,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
  },
  timeUser: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  timeBot: {
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.statusConfirmed,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 4,
  },
  confirmText: {
    color: '#fff',
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
    borderColor: Colors.error,
    gap: 4,
  },
  cancelText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '600',
  },
});
