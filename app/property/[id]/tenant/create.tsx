import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Share, Image, TouchableOpacity } from 'react-native';
import { TextInput, Button, HelperText, Text, IconButton, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { Colors, Shadows } from '@/constants/colors';
import { useToastStore } from '@/lib/toast';
import { Tenant } from '@/lib/types';
import { getInviteLink } from '@/lib/invite';

const PHOTO_BUCKET = 'tenant-photos';

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <MaterialCommunityIcons name={icon as any} size={18} color={Colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function TenantCreateScreen() {
  const { id: propertyId, tenantId } = useLocalSearchParams<{ id: string; tenantId?: string }>();
  const router = useRouter();
  const isEditing = !!tenantId;

  const [flatNo, setFlatNo] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [securityDeposit, setSecurityDeposit] = useState('0');
  const [dueDay, setDueDay] = useState('1');
  const [leaseStart, setLeaseStart] = useState<Date | null>(null);
  const [leaseEnd, setLeaseEnd] = useState<Date | null>(null);
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (!isEditing) return;

    async function fetchTenant() {
      const { data } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single<Tenant>();

      if (data) {
        setFlatNo(data.flat_no);
        setTenantName(data.tenant_name);
        setMonthlyRent(String(data.monthly_rent));
        setSecurityDeposit(String(data.security_deposit));
        setDueDay(String(data.due_day));
        if (data.lease_start) setLeaseStart(new Date(data.lease_start + 'T00:00:00'));
        if (data.lease_end) setLeaseEnd(new Date(data.lease_end + 'T00:00:00'));
        setNotes(data.notes ?? '');
        if (data.photo_url) {
          setPhotoPath(data.photo_url);
          const { data: urlData } = await supabase.storage
            .from(PHOTO_BUCKET)
            .createSignedUrl(data.photo_url, 3600);
          if (urlData?.signedUrl) setPhotoUri(urlData.signedUrl);
        }
      }
      setFetching(false);
    }

    fetchTenant();
  }, [tenantId, isEditing]);

  async function pickPhoto(source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      useToastStore.getState().showToast(`Please allow ${source} access.`, 'error');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setPhotoUri(uri);
  }

  function removePhoto() {
    setPhotoUri(null);
    setPhotoPath(null);
  }

  async function uploadPhoto(tid: string): Promise<string | null> {
    if (!photoUri || photoUri.startsWith('http')) {
      return photoPath;
    }

    setUploading(true);
    const path = `${propertyId}/${tid}/photo.jpg`;

    try {
      const response = await fetch(photoUri);
      const blob = await response.blob();

      await supabase.storage.from(PHOTO_BUCKET).remove([path]);

      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg' });

      if (error) {
        useToastStore.getState().showToast('Photo upload failed: ' + error.message, 'error');
        return photoPath;
      }
      return path;
    } catch {
      useToastStore.getState().showToast('Photo upload failed.', 'error');
      return photoPath;
    } finally {
      setUploading(false);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!flatNo.trim()) errs.flatNo = 'Flat/unit number is required.';
    if (!tenantName.trim()) errs.tenantName = 'Tenant name is required.';
    const rent = parseFloat(monthlyRent);
    if (isNaN(rent) || rent <= 0) errs.monthlyRent = 'Enter a valid rent amount.';
    const day = parseInt(dueDay, 10);
    if (isNaN(day) || day < 1 || day > 28) errs.dueDay = 'Due day must be between 1 and 28.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function onStartDateChange(_event: DateTimePickerEvent, selectedDate?: Date) {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) setLeaseStart(selectedDate);
  }

  function onEndDateChange(_event: DateTimePickerEvent, selectedDate?: Date) {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) setLeaseEnd(selectedDate);
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);

    const payload = {
      flat_no: flatNo.trim(),
      tenant_name: tenantName.trim(),
      monthly_rent: parseFloat(monthlyRent),
      security_deposit: parseFloat(securityDeposit) || 0,
      due_day: parseInt(dueDay, 10),
      lease_start: leaseStart ? toISODate(leaseStart) : new Date().toISOString().split('T')[0],
      lease_end: leaseEnd ? toISODate(leaseEnd) : null,
      notes: notes.trim() || null,
    };

    if (isEditing) {
      const uploadedPath = await uploadPhoto(tenantId!);
      const { error } = await supabase
        .from('tenants')
        .update({
          ...payload,
          photo_url: photoUri === null && photoPath === null ? null : uploadedPath,
        })
        .eq('id', tenantId);

      if (error) {
        useToastStore.getState().showToast(error.message, 'error');
      } else {
        router.back();
      }
    } else {
      const { data, error } = await supabase
        .from('tenants')
        .insert({ ...payload, property_id: propertyId })
        .select('id, invite_token')
        .single();

      if (error) {
        useToastStore.getState().showToast(error.message, 'error');
      } else if (data) {
        if (photoUri) {
          const uploadedPath = await uploadPhoto(data.id);
          if (uploadedPath) {
            await supabase
              .from('tenants')
              .update({ photo_url: uploadedPath })
              .eq('id', data.id);
          }
        }

        const inviteLink = getInviteLink(data.invite_token);
        await Share.share({
          message: `You've been added as a tenant on Dwella! Open this link to accept your invitation:\n\n${inviteLink}`,
          title: 'Tenant Invite',
        });
        router.back();
      }
    }

    setLoading(false);
  }

  if (fetching) {
    return <View style={styles.container} />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditing ? 'Edit Tenant' : 'Add Tenant',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.surface, height: 64 } as any,
          headerTintColor: Colors.textPrimary,
          headerShown: true,
          headerLeft: () => (
            <IconButton icon="close" size={22} onPress={() => router.back()} />
          ),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Photo upload */}
          <View style={styles.photoSection}>
            {photoUri ? (
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                {uploading && (
                  <View style={styles.photoUploading}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
                <TouchableOpacity style={styles.photoRemoveBtn} onPress={removePhoto} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoPlaceholder}>
                <MaterialCommunityIcons name="account-outline" size={32} color={Colors.textDisabled} />
              </View>
            )}
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickPhoto('camera')} activeOpacity={0.7}>
                <MaterialCommunityIcons name="camera-outline" size={18} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickPhoto('library')} activeOpacity={0.7}>
                <MaterialCommunityIcons name="image-outline" size={18} color={Colors.primary} />
                <Text style={styles.photoBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Tenant Info */}
          <View style={styles.sectionCard}>
            <SectionHeader icon="account-outline" title="Tenant Info" />
            <TextInput
              label="Tenant Name"
              value={tenantName}
              onChangeText={setTenantName}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              error={!!errors.tenantName}
            />
            {errors.tenantName && <HelperText type="error">{errors.tenantName}</HelperText>}

            <TextInput
              label="Flat / Unit Number"
              value={flatNo}
              onChangeText={setFlatNo}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              error={!!errors.flatNo}
            />
            {errors.flatNo && <HelperText type="error">{errors.flatNo}</HelperText>}
          </View>

          {/* Financials */}
          <View style={styles.sectionCard}>
            <SectionHeader icon="currency-inr" title="Financials" />
            <TextInput
              label="Monthly Rent (₹)"
              value={monthlyRent}
              onChangeText={setMonthlyRent}
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              error={!!errors.monthlyRent}
            />
            {errors.monthlyRent && <HelperText type="error">{errors.monthlyRent}</HelperText>}

            <TextInput
              label="Security Deposit (₹)"
              value={securityDeposit}
              onChangeText={setSecurityDeposit}
              keyboardType="decimal-pad"
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
            />

            <TextInput
              label="Due Day (1–28)"
              value={dueDay}
              onChangeText={setDueDay}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              error={!!errors.dueDay}
            />
            {errors.dueDay && <HelperText type="error">{errors.dueDay}</HelperText>}
          </View>

          {/* Lease Period */}
          <View style={styles.sectionCard}>
            <SectionHeader icon="calendar-range" title="Lease Period" />

            <TouchableOpacity
              style={styles.dateField}
              onPress={() => setShowStartPicker(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="calendar" size={20} color={Colors.primary} />
              <View style={styles.dateFieldText}>
                <Text style={styles.dateLabel}>Lease Start</Text>
                <Text style={leaseStart ? styles.dateValue : styles.datePlaceholder}>
                  {leaseStart ? formatDate(leaseStart) : 'Select date (optional)'}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textDisabled} />
            </TouchableOpacity>

            {showStartPicker && (
              <DateTimePicker
                value={leaseStart || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onStartDateChange}
              />
            )}

            <TouchableOpacity
              style={styles.dateField}
              onPress={() => setShowEndPicker(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="calendar" size={20} color={Colors.primary} />
              <View style={styles.dateFieldText}>
                <Text style={styles.dateLabel}>Lease End</Text>
                <Text style={leaseEnd ? styles.dateValue : styles.datePlaceholder}>
                  {leaseEnd ? formatDate(leaseEnd) : 'Select date (optional)'}
                </Text>
              </View>
              {leaseEnd && (
                <TouchableOpacity
                  onPress={() => { setLeaseEnd(null); }}
                  hitSlop={8}
                  style={styles.dateClearBtn}
                >
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textDisabled} />
            </TouchableOpacity>

            {showEndPicker && (
              <DateTimePicker
                value={leaseEnd || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onEndDateChange}
              />
            )}
          </View>

          {/* Additional Info */}
          <View style={styles.sectionCard}>
            <SectionHeader icon="note-text-outline" title="Additional Info" />
            <TextInput
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              mode="outlined"
              style={styles.input}
              outlineStyle={styles.inputOutline}
              multiline
              numberOfLines={3}
              placeholder="e.g. Contact number, ID proof details, special terms..."
            />
          </View>

          {!isEditing && (
            <Text variant="bodySmall" style={styles.inviteNote}>
              After saving, an invite link will be generated and shared with the tenant.
            </Text>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={loading || uploading}
            disabled={loading || uploading}
            style={styles.submitBtn}
            contentStyle={styles.submitBtnContent}
          >
            {isEditing ? 'Save Changes' : 'Add Tenant & Share Invite'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
  },
  inputOutline: {
    borderRadius: 12,
  },

  // Date picker fields
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dateFieldText: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  dateValue: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  datePlaceholder: {
    fontSize: 15,
    color: Colors.textDisabled,
  },
  dateClearBtn: {
    padding: 2,
  },

  inviteNote: {
    color: Colors.textSecondary,
    paddingHorizontal: 4,
  },
  submitBtn: {
    marginTop: 4,
    borderRadius: 14,
    ...Shadows.sm,
  },
  submitBtnContent: {
    paddingVertical: 10,
  },

  // Photo section
  photoSection: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 0,
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreviewWrap: {
    position: 'relative',
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  photoUploading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
