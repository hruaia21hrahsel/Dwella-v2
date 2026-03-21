import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Modal,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Document } from '@/lib/types';
import {
  getSignedUrl,
  getViewerUrl,
  shareDocument,
  isImageMime,
} from '@/lib/documents';
import { useTheme } from '@/lib/theme-context';
import { useToastStore } from '@/lib/toast';

interface DocumentViewerProps {
  visible: boolean;
  document: Document | null;
  onClose: () => void;
}

export function DocumentViewer({ visible, document, onClose }: DocumentViewerProps) {
  const { colors } = useTheme();
  const showToast = useToastStore((s) => s.showToast);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(false);

  const fetchSignedUrl = useCallback(async () => {
    if (!document) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = await getSignedUrl(document.storage_path);
      setSignedUrl(url);
    } catch (err) {
      console.error('[DocumentViewer] Signed URL fetch failed:', err);
      setError('Could not load document. Tap to retry.');
    } finally {
      setIsLoading(false);
    }
  }, [document]);

  useEffect(() => {
    if (visible && document) {
      fetchSignedUrl();
    } else {
      // Reset state on close
      setSignedUrl(null);
      setError(null);
      setIsLoading(false);
      setIsSharing(false);
      setWebViewLoading(false);
    }
  }, [visible, document, fetchSignedUrl]);

  async function handleShare() {
    if (!document || !signedUrl) return;
    setIsSharing(true);
    try {
      await shareDocument(document, signedUrl);
    } catch {
      showToast('Could not share file.', 'error');
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top bar */}
        <View style={[styles.topBar, { borderBottomColor: colors.divider }]}>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close document viewer"
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text
            style={[styles.docName, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {document?.name ?? ''}
          </Text>
          {/* Empty right slot for centering */}
          <View style={styles.rightSlot} />
        </View>

        {/* Content area */}
        <View style={styles.content}>
          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <TouchableOpacity onPress={fetchSignedUrl} style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                  {error}
                </Text>
              </TouchableOpacity>
            </View>
          ) : signedUrl && document ? (
            isImageMime(document.mime_type) ? (
              // Image viewer with pinch-to-zoom
              <ScrollView
                maximumZoomScale={3}
                minimumZoomScale={1}
                contentContainerStyle={styles.imageContainer}
              >
                <Image
                  source={{ uri: signedUrl }}
                  style={{ width: screenWidth, height: screenHeight - 180 }}
                  resizeMode="contain"
                />
              </ScrollView>
            ) : (
              // PDF / Word viewer via WebView
              <View style={styles.webViewContainer}>
                <WebView
                  source={{ uri: getViewerUrl(signedUrl, document.mime_type, Platform.OS) }}
                  style={styles.webView}
                  onLoadStart={() => setWebViewLoading(true)}
                  onLoadEnd={() => setWebViewLoading(false)}
                  onError={(e) => {
                    console.error('[DocumentViewer] WebView error:', e.nativeEvent);
                    setError('Could not display document. Tap to retry.');
                    setWebViewLoading(false);
                  }}
                  javaScriptEnabled
                  domStorageEnabled
                  startInLoadingState
                />
                {webViewLoading && (
                  <View style={[styles.webViewLoader, { backgroundColor: colors.background }]}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                )}
              </View>
            )
          ) : null}
        </View>

        {/* Bottom bar */}
        <View style={[styles.bottomBar, { borderTopColor: colors.divider }]}>
          <TouchableOpacity
            onPress={handleShare}
            disabled={isSharing || !signedUrl}
            style={[
              styles.shareButton,
              { borderColor: colors.primary, opacity: isSharing || !signedUrl ? 0.5 : 1 },
            ]}
            activeOpacity={0.7}
          >
            {isSharing ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <View style={styles.shareRow}>
                <MaterialCommunityIcons name="share-variant" size={18} color={colors.primary} />
                <Text style={[styles.shareLabel, { color: colors.primary }]}>Share Document</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },
  rightSlot: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {},
  webViewContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
  },
  webViewLoader: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    height: 72,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    justifyContent: 'center',
  },
  shareButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  shareLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
