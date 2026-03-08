import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Shadows } from '@/constants/colors';

interface Props {
  nudge: string | null;
  loading: boolean;
}

export function AiInsightCard({ nudge, loading }: Props) {
  const router = useRouter();

  if (!nudge && !loading) return null;

  return (
    <TouchableOpacity
      style={[styles.card, Shadows.sm]}
      onPress={() => router.push('/tools/ai-insights')}
      activeOpacity={0.8}
    >
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name="robot-outline" size={18} color="#8B5CF6" />
      </View>
      <View style={styles.textWrap}>
        {loading ? (
          <Text style={styles.loadingText}>Analyzing your data...</Text>
        ) : (
          <Text style={styles.nudgeText} numberOfLines={2}>{nudge}</Text>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={Colors.textDisabled} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E9E5FF',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  nudgeText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#4C1D95',
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 13,
    color: '#7C3AED',
    fontStyle: 'italic',
  },
});
