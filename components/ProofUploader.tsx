import { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Button, Text, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { STORAGE_BUCKET } from '@/constants/config';
import { useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';

interface ProofUploaderProps {
  storagePath: string;
  onUploaded: (path: string) => void;
  existingUrl?: string | null;
}

export function ProofUploader({ storagePath, onUploaded, existingUrl }: ProofUploaderProps) {
  const { colors } = useTheme();
  const [previewUri, setPreviewUri] = useState<string | null>(existingUrl ?? null);
  const [uploading, setUploading] = useState(false);

  async function pickImage(source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      useToastStore.getState().showToast(`Please allow ${source} access to upload proof.`, 'error');
      return;
    }

    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setPreviewUri(uri);
    await upload(uri);
  }

  async function upload(uri: string) {
    setUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      // Try upload; if file already exists (from a previous attempt) remove it first then re-upload
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, blob, { contentType: 'image/jpeg' });

      let error = uploadError;
      if (uploadError?.message?.includes('already exists')) {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        const { error: retryError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, blob, { contentType: 'image/jpeg' });
        error = retryError;
      }

      if (error) {
        useToastStore.getState().showToast('Upload failed: ' + error.message, 'error');
        setPreviewUri(null);
      } else {
        onUploaded(storagePath);
      }
    } catch (e) {
      useToastStore.getState().showToast('Upload failed. Please try again.', 'error');
      setPreviewUri(null);
    }
    setUploading(false);
  }

  return (
    <View style={styles.container}>
      <Text variant="labelMedium" style={[styles.label, { color: colors.textSecondary }]}>Payment Proof (optional)</Text>

      {previewUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: previewUri }} style={[styles.preview, { borderColor: colors.border }]} resizeMode="cover" />
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color={colors.textOnPrimary} />
            </View>
          )}
        </View>
      ) : null}

      <View style={styles.buttonRow}>
        <Button
          mode="outlined"
          icon="camera"
          onPress={() => pickImage('camera')}
          disabled={uploading}
          style={styles.pickerButton}
          compact
        >
          Camera
        </Button>
        <Button
          mode="outlined"
          icon="image"
          onPress={() => pickImage('library')}
          disabled={uploading}
          style={styles.pickerButton}
          compact
        >
          Gallery
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    borderWidth: 1,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pickerButton: {
    flex: 1,
  },
});
