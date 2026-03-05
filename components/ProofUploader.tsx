import { useState } from 'react';
import { View, Image, StyleSheet, Alert } from 'react-native';
import { Button, Text, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { STORAGE_BUCKET } from '@/constants/config';
import { Colors } from '@/constants/colors';

interface ProofUploaderProps {
  storagePath: string;
  onUploaded: (path: string) => void;
  existingUrl?: string | null;
}

export function ProofUploader({ storagePath, onUploaded, existingUrl }: ProofUploaderProps) {
  const [previewUri, setPreviewUri] = useState<string | null>(existingUrl ?? null);
  const [uploading, setUploading] = useState(false);

  async function pickImage(source: 'camera' | 'library') {
    const permission = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission required', `Please allow ${source} access to upload proof.`);
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

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (error) {
        Alert.alert('Upload failed', error.message);
        setPreviewUri(null);
      } else {
        onUploaded(storagePath);
      }
    } catch (e) {
      Alert.alert('Upload failed', 'Something went wrong. Please try again.');
      setPreviewUri(null);
    }
    setUploading(false);
  }

  return (
    <View style={styles.container}>
      <Text variant="labelMedium" style={styles.label}>Payment Proof (optional)</Text>

      {previewUri ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="cover" />
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color={Colors.textOnPrimary} />
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
    color: Colors.textSecondary,
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
    borderColor: Colors.border,
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
