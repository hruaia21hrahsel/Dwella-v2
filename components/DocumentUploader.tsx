import { useState } from 'react';
import {
  View,
  Modal,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, Surface } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import {
  uploadDocument,
  getDocumentStoragePath,
  getExtFromFilename,
  isImageMime,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
} from '@/lib/documents';
import { useAuthStore } from '@/lib/store';
import { useToastStore } from '@/lib/toast';
import { useTheme } from '@/lib/theme-context';
import { GradientButton } from '@/components/GradientButton';
import { DocumentCategory } from '@/lib/types';

interface TenantOption {
  id: string;
  tenant_name: string;
}

interface DocumentUploaderProps {
  visible: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
  propertyId: string;
  tenantId: string | null; // null = property-wide (default scope)
  tenants?: TenantOption[]; // if provided, shows scope picker for landlord
}

export function DocumentUploader({
  visible,
  onClose,
  onUploadComplete,
  propertyId,
  tenantId,
  tenants,
}: DocumentUploaderProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.showToast);

  const [asset, setAsset] = useState<{ uri: string; name: string; mimeType: string; size: number } | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('other');
  const [scopeTenantId, setScopeTenantId] = useState<string | null>(tenantId);
  const [isUploading, setIsUploading] = useState(false);

  // Effective tenant ID: use scope picker value if tenants provided, otherwise prop
  const effectiveTenantId = tenants && tenants.length > 0 ? scopeTenantId : tenantId;

  function resetState() {
    setAsset(null);
    setName('');
    setCategory('other');
    setScopeTenantId(tenantId);
    setIsUploading(false);
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleChooseFile() {
    // expo-document-picker temporarily removed — use gallery instead
    showToast('Use the gallery option to select photos.', 'info');
  }

  async function handleChooseFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Gallery permission is required to select photos.', 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const img = result.assets[0];

    if (img.fileSize && img.fileSize > 10485760) {
      showToast('File exceeds 10 MB limit. Please choose a smaller file.', 'error');
      return;
    }

    // Convert ImagePicker result to DocumentPicker-compatible shape
    const fileName = img.fileName ?? `photo_${Date.now()}.jpg`;
    setAsset({
      uri: img.uri,
      name: fileName,
      mimeType: img.mimeType ?? 'image/jpeg',
      size: img.fileSize ?? 0,
    });

    const dotIndex = fileName.lastIndexOf('.');
    setName(dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName);
  }

  async function handleUpload() {
    if (!asset || !name.trim() || !user) return;

    setIsUploading(true);
    try {
      const ext = getExtFromFilename(asset.name);
      const storagePath = getDocumentStoragePath(propertyId, effectiveTenantId, ext);

      await uploadDocument(asset, storagePath);

      const { error: dbError } = await supabase.from('documents').insert({
        property_id: propertyId,
        tenant_id: effectiveTenantId,
        uploader_id: user.id,
        name: name.trim(),
        category,
        storage_path: storagePath,
        mime_type: asset.mimeType ?? 'application/octet-stream',
        file_size: asset.size ?? 0,
      });

      if (dbError) throw dbError;

      showToast('Document uploaded', 'success');
      onUploadComplete();
      resetState();
      onClose();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error('[DocumentUploader] Upload failed:', msg, err);
      showToast(`Upload failed: ${msg}`, 'error');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.flex, { backgroundColor: colors.background }]}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Surface style={[styles.surface, { backgroundColor: colors.surface }]} elevation={0}>
            {/* Title */}
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Upload Document
            </Text>

            {/* Scope picker — only for landlords with tenants */}
            {tenants && tenants.length > 0 && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Upload for</Text>
                <View style={styles.categoryRow}>
                  <TouchableOpacity
                    onPress={() => setScopeTenantId(null)}
                    disabled={isUploading}
                    style={[
                      styles.categoryChip,
                      scopeTenantId === null
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: scopeTenantId === null ? colors.textOnPrimary : colors.textSecondary },
                      ]}
                    >
                      Property
                    </Text>
                  </TouchableOpacity>
                  {tenants.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => setScopeTenantId(t.id)}
                      disabled={isUploading}
                      style={[
                        styles.categoryChip,
                        scopeTenantId === t.id
                          ? { backgroundColor: colors.primary }
                          : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          { color: scopeTenantId === t.id ? colors.textOnPrimary : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {t.tenant_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* File preview */}
            {asset ? (
              <View style={[styles.previewArea, { borderColor: colors.border }]}>
                {isImageMime(asset.mimeType ?? '') ? (
                  <Image
                    source={{ uri: asset.uri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.fileBadge, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.fileBadgeText, { color: colors.primary }]} numberOfLines={1}>
                      {asset.name}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.previewAreaEmpty, { borderColor: colors.border }]} />
            )}

            {/* Source buttons */}
            <View style={styles.sourceRow}>
              <Button
                mode="outlined"
                icon="image"
                onPress={handleChooseFromGallery}
                disabled={isUploading}
                style={styles.sourceButton}
              >
                From Gallery
              </Button>
              <Button
                mode="outlined"
                icon="file-plus"
                onPress={handleChooseFile}
                disabled={isUploading}
                style={styles.sourceButton}
              >
                Browse Files
              </Button>
            </View>

            {/* Document name input */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Document Name</Text>
            <TextInput
              mode="outlined"
              placeholder="e.g. Lease Agreement Jan 2026"
              value={name}
              onChangeText={setName}
              editable={!isUploading}
              style={[styles.textInput, { backgroundColor: colors.surface }]}
            />

            {/* Category picker */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
            <View style={styles.categoryRow}>
              {ALL_CATEGORIES.map((cat) => {
                const isActive = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    disabled={isUploading}
                    style={[
                      styles.categoryChip,
                      isActive
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: isActive ? colors.textOnPrimary : colors.textSecondary },
                      ]}
                    >
                      {CATEGORY_LABELS[cat]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Upload progress */}
            {isUploading && (
              <ActivityIndicator color={colors.primary} style={styles.spinner} />
            )}

            {/* Action buttons */}
            <View style={styles.buttonRow}>
              <Button
                mode="text"
                onPress={handleClose}
                disabled={isUploading}
                textColor={colors.textSecondary}
                style={styles.cancelButton}
              >
                Cancel
              </Button>
              <GradientButton
                title="Upload"
                onPress={handleUpload}
                disabled={!asset || !name.trim() || isUploading}
                loading={isUploading}
                style={styles.uploadButton}
              />
            </View>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  surface: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  previewArea: {
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAreaEmpty: {
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  imagePreview: {
    width: '100%',
    height: 120,
  },
  fileBadge: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '90%',
  },
  fileBadgeText: {
    fontSize: 14,
    fontWeight: '400',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sourceButton: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: -4,
  },
  textInput: {
    fontSize: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '400',
  },
  spinner: {
    alignSelf: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelButton: {
    minWidth: 80,
  },
  uploadButton: {
    minWidth: 120,
  },
});
