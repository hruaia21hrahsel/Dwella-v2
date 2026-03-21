import { View, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/lib/theme-context';

interface PhotoAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

interface MaintenancePhotoUploaderProps {
  photos: PhotoAsset[];
  onPhotosChange: (photos: PhotoAsset[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export function MaintenancePhotoUploader({
  photos,
  onPhotosChange,
  maxPhotos = 5,
  disabled = false,
}: MaintenancePhotoUploaderProps) {
  const { colors } = useTheme();

  const isAtLimit = photos.length >= maxPhotos;

  async function handleTakePhoto() {
    if (isAtLimit || disabled) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    onPhotosChange([
      ...photos,
      {
        uri: asset.uri,
        fileName: asset.fileName ?? null,
        mimeType: asset.mimeType ?? 'image/jpeg',
      },
    ]);
  }

  async function handleChooseFromGallery() {
    if (isAtLimit || disabled) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const remaining = maxPhotos - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });

    if (result.canceled || !result.assets?.length) return;

    const newPhotos: PhotoAsset[] = result.assets.map((a) => ({
      uri: a.uri,
      fileName: a.fileName ?? null,
      mimeType: a.mimeType ?? 'image/jpeg',
    }));

    onPhotosChange([...photos, ...newPhotos]);
  }

  function handleRemovePhoto(index: number) {
    onPhotosChange(photos.filter((_, i) => i !== index));
  }

  const buttonDisabled = isAtLimit || disabled;

  return (
    <View style={styles.container}>
      {/* Buttons row */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          onPress={handleTakePhoto}
          disabled={buttonDisabled}
          activeOpacity={0.7}
          style={[
            styles.button,
            { borderColor: colors.border, backgroundColor: colors.surface },
            buttonDisabled && styles.buttonDisabled,
          ]}
        >
          <MaterialCommunityIcons
            name="camera-outline"
            size={22}
            color={buttonDisabled ? colors.textSecondary : colors.primary}
          />
          <Text
            style={[
              styles.buttonText,
              { color: buttonDisabled ? colors.textSecondary : colors.primary },
            ]}
          >
            Take Photo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleChooseFromGallery}
          disabled={buttonDisabled}
          activeOpacity={0.7}
          style={[
            styles.button,
            { borderColor: colors.border, backgroundColor: colors.surface },
            buttonDisabled && styles.buttonDisabled,
          ]}
        >
          <MaterialCommunityIcons
            name="image-outline"
            size={22}
            color={buttonDisabled ? colors.textSecondary : colors.primary}
          />
          <Text
            style={[
              styles.buttonText,
              { color: buttonDisabled ? colors.textSecondary : colors.primary },
            ]}
          >
            Choose from Library
          </Text>
        </TouchableOpacity>
      </View>

      {/* Thumbnail strip */}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailStrip}
        >
          {photos.map((photo, index) => (
            <View key={`${photo.uri}-${index}`} style={styles.thumbnailWrapper}>
              <Image
                source={{ uri: photo.uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => handleRemovePhoto(index)}
                accessibilityLabel={`Remove photo ${index + 1}`}
                style={styles.removeButton}
              >
                <MaterialCommunityIcons
                  name="close-circle"
                  size={20}
                  color={colors.error}
                />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Photo count indicator */}
      {maxPhotos > 0 && (
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          {photos.length}/{maxPhotos} photos
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '400',
  },
  thumbnailStrip: {
    gap: 8,
    paddingVertical: 4,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '400',
  },
});
