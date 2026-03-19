import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme-context';
import { useTrack, EVENTS } from '@/lib/analytics';
import { AiDisclosureModal } from '@/components/AiDisclosureModal';

interface Props {
  nudge: string | null;
  loading: boolean;
}

export function AiInsightCard({ nudge, loading }: Props) {
  const { colors, shadows, isDark } = useTheme();
  const router = useRouter();
  const track = useTrack();

  if (!nudge && !loading) return null;

  const aiBg = isDark ? 'rgba(139,92,246,0.10)' : '#F5F3FF';
  const aiBorder = isDark ? 'rgba(139,92,246,0.20)' : '#E9E5FF';
  const aiIconBg = isDark ? 'rgba(139,92,246,0.18)' : '#EDE9FE';
  const aiIconColor = isDark ? '#A78BFA' : '#8B5CF6';
  const aiTextColor = isDark ? '#C4B5FD' : '#4C1D95';
  const aiLoadingColor = isDark ? '#A78BFA' : '#7C3AED';

  return (
    <>
      <AiDisclosureModal />
      <TouchableOpacity
        style={[styles.card, shadows.sm, { backgroundColor: aiBg, borderColor: aiBorder }]}
        onPress={() => { track(EVENTS.AI_NUDGE_TAPPED, { nudge_type: 'dashboard' }); router.push('/tools/ai-insights'); }}
        activeOpacity={0.8}
      >
      <View style={[styles.iconWrap, { backgroundColor: aiIconBg }]}>
        <MaterialCommunityIcons name="robot-outline" size={18} color={aiIconColor} />
      </View>
      <View style={styles.textWrap}>
        {loading ? (
          <Text style={[styles.loadingText, { color: aiLoadingColor }]}>Analyzing your data...</Text>
        ) : (
          <Text style={[styles.nudgeText, { color: aiTextColor }]} numberOfLines={2}>{nudge}</Text>
        )}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textDisabled} />
    </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontWeight: '500',
  },
  loadingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
