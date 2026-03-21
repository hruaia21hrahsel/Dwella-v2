import { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { useTheme } from '@/lib/theme-context';
import { getMaintenancePhotoPath } from '@/lib/maintenance';
import { MAINTENANCE_PHOTOS_BUCKET } from '@/constants/config';
import { MaintenancePhotoUploader } from '@/components/MaintenancePhotoUploader';
import { GradientButton } from '@/components/GradientButton';
import type { MaintenancePriority } from '@/lib/types';

interface PhotoAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

const PRIORITIES: { value: MaintenancePriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
];

export default function SubmitMaintenanceScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colors } = useTheme();
  const showToast = useToastStore((s) => s.showToast);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('normal');
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Look up tenant record for current user + property
  useEffect(() => {
    if (!user || !propertyId) return;

    supabase
      .from('tenants')
      .select('id')
      .eq('property_id', propertyId)
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .single()
      .then(({ data }) => {
        if (data) setTenantId(data.id);
      });
  }, [user, propertyId]);

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    !isSubmitting;

  async function handleSubmit() {
    if (!user || !propertyId || !tenantId) return;

    setIsSubmitting(true);

    try {
      // Step 1: INSERT request row with empty photo_paths
      const { data: inserted, error: insertError } = await supabase
        .from('maintenance_requests')
        .insert({
          property_id: propertyId,
          tenant_id: tenantId,
          title: title.trim(),
          description: description.trim(),
          priority,
          photo_paths: [],
        })
        .select('id')
        .single();

      if (insertError || !inserted) {
        showToast('Could not submit your request. Please check your connection and try again.', 'error');
        return;
      }

      // Step 2: INSERT initial status log
      await supabase.from('maintenance_status_logs').insert({
        request_id: inserted.id,
        changed_by: user.id,
        from_status: null,
        to_status: 'open',
      });

      // Step 3: Upload photos sequentially (if any)
      let photoUploadFailed = false;
      const uploadedPaths: string[] = [];

      if (photos.length > 0) {
        for (const photo of photos) {
          try {
            const base64 = await FileSystem.readAsStringAsync(photo.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const buffer = decode(base64);
            const storagePath = getMaintenancePhotoPath(propertyId, inserted.id, 'jpg');
            const { error: uploadError } = await supabase.storage
              .from(MAINTENANCE_PHOTOS_BUCKET)
              .upload(storagePath, buffer, {
                contentType: 'image/jpeg',
                upsert: false,
              });
            if (!uploadError) {
              uploadedPaths.push(storagePath);
            } else {
              photoUploadFailed = true;
            }
          } catch {
            photoUploadFailed = true;
          }
        }

        // Step 4: UPDATE photo_paths if any uploaded
        if (uploadedPaths.length > 0) {
          await supabase
            .from('maintenance_requests')
            .update({ photo_paths: uploadedPaths })
            .eq('id', inserted.id);
        }
      }

      // Step 5: Send push notification to landlord
      try {
        const { data: property } = await supabase
          .from('properties')
          .select('owner_id')
          .eq('id', propertyId)
          .single();

        if (property?.owner_id) {
          const { data: owner } = await supabase
            .from('users')
            .select('push_token')
            .eq('id', property.owner_id)
            .single();

          if (owner?.push_token) {
            await supabase.functions.invoke('send-push', {
              body: {
                messages: [
                  {
                    token: owner.push_token,
                    title: 'New Maintenance Request',
                    body: `${user.full_name ?? 'A tenant'}: ${title.trim().substring(0, 80)}`,
                    data: { type: 'maintenance_new', requestId: inserted.id },
                  },
                ],
              },
            });
          }

          // Insert in-app notification row for landlord (non-blocking)
          try {
            await supabase.from('notifications').insert({
              user_id: property.owner_id,
              maintenance_request_id: inserted.id,
              type: 'maintenance_new',
              title: 'New Maintenance Request',
              body: `${user.full_name ?? 'A tenant'}: ${title.trim().substring(0, 80)}`,
            });
          } catch (notifErr) {
            console.warn('[Dwella] Failed to insert maintenance_new notification row:', notifErr);
          }
        }
      } catch {
        // Push notification failure should not block the success flow
      }

      // Step 6: Show feedback and navigate back
      if (photoUploadFailed) {
        showToast(
          'Request submitted, but one or more photos failed to upload. You can resubmit with photos.',
          'info',
        );
      } else {
        showToast('Maintenance request submitted!', 'success');
      }
      router.back();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <Text style={[styles.backText, { color: colors.primary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            New Request
          </Text>
          <View style={styles.backBtn} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Title *</Text>
          <TextInput
            mode="outlined"
            placeholder="e.g. Leaking kitchen tap"
            value={title}
            onChangeText={setTitle}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={styles.textInput}
          />

          {/* Description */}
          <Text style={[styles.fieldLabel, styles.fieldLabelSpaced, { color: colors.textSecondary }]}>
            Description *
          </Text>
          <TextInput
            mode="outlined"
            placeholder="Describe the issue in detail"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            outlineColor={colors.border}
            activeOutlineColor={colors.primary}
            style={[styles.textInput, styles.textArea]}
          />

          {/* Priority */}
          <Text style={[styles.fieldLabel, styles.fieldLabelSpaced, { color: colors.textSecondary }]}>
            Priority
          </Text>
          <View
            style={[
              styles.priorityControl,
              { borderColor: colors.border },
            ]}
          >
            {PRIORITIES.map((p, index) => {
              const isActive = priority === p.value;
              return (
                <TouchableOpacity
                  key={p.value}
                  onPress={() => setPriority(p.value)}
                  activeOpacity={0.7}
                  style={[
                    styles.prioritySegment,
                    isActive
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.surface },
                    index < PRIORITIES.length - 1 && {
                      borderRightWidth: 1,
                      borderRightColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityText,
                      {
                        color: isActive ? colors.textOnPrimary : colors.textSecondary,
                        fontWeight: isActive ? '700' : '400',
                      },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Photos */}
          <Text style={[styles.fieldLabel, styles.fieldLabelSpaced, { color: colors.textSecondary }]}>
            Photos (optional)
          </Text>
          <MaintenancePhotoUploader
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={5}
            disabled={isSubmitting}
          />

          {/* Submit */}
          <View style={styles.submitContainer}>
            {isSubmitting ? (
              <View
                style={[
                  styles.submittingContainer,
                  { backgroundColor: colors.primary + '20' },
                ]}
              >
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.submittingText, { color: colors.primary }]}>
                  Submitting...
                </Text>
              </View>
            ) : (
              <GradientButton
                title="Submit Request"
                onPress={handleSubmit}
                disabled={!canSubmit}
              />
            )}
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldLabelSpaced: {
    marginTop: 20,
  },
  textInput: {
    backgroundColor: 'transparent',
  },
  textArea: {
    minHeight: 100,
  },
  priorityControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    height: 48,
  },
  prioritySegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: {
    fontSize: 14,
  },
  submitContainer: {
    marginTop: 32,
  },
  submittingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  submittingText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
