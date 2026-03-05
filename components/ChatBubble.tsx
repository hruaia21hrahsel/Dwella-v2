import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '@/constants/colors';
import { BotConversation } from '@/lib/types';
import { formatDate } from '@/lib/utils';

interface Props {
  message: BotConversation;
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowBot]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textBot]}>
          {message.content}
        </Text>
        <Text style={[styles.time, isUser ? styles.timeUser : styles.timeBot]}>
          {formatDate(message.created_at)}
        </Text>
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
});
