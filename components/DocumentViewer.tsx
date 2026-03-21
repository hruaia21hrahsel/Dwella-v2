import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  useWindowDimensions,
  Platform,
  Linking,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import { Document } from '@/lib/types';
import { getSignedUrl, shareDocument, isImageMime, mimeToExt } from '@/lib/documents';
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
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const loadDocument = useCallback(async () => {
    if (!document) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = await getSignedUrl(document.storage_path);
      setSignedUrl(url);

      // For PDFs and other non-image files, download to local cache
      if (!isImageMime(document.mime_type)) {
        const ext = mimeToExt(document.mime_type);
        const localPath = `${FileSystem.cacheDirectory}doc_${document.id}.${ext}`;
        const { uri } = await FileSystem.downloadAsync(url, localPath);
        setLocalUri(uri);

        // On Android, read as base64 for inline WebView rendering
        if (Platform.OS === 'android' && document.mime_type === 'application/pdf') {
          const b64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setPdfBase64(b64);
        }
      }
    } catch (err) {
      console.error('[DocumentViewer] Load failed:', err);
      setError('Could not load document. Tap to retry.');
    } finally {
      setIsLoading(false);
    }
  }, [document]);

  useEffect(() => {
    if (visible && document) {
      loadDocument();
    } else {
      setSignedUrl(null);
      setLocalUri(null);
      setPdfBase64(null);
      setError(null);
      setIsLoading(false);
      setIsSharing(false);
    }
  }, [visible, document, loadDocument]);

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

  function renderContent() {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading document...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <TouchableOpacity onPress={loadDocument} style={styles.errorContainer}>
            <MaterialCommunityIcons name="refresh" size={32} color={colors.textSecondary} />
            <Text style={[styles.errorText, { color: colors.textSecondary }]}>
              {error}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!document) return null;

    if (isImageMime(document.mime_type) && signedUrl) {
      // expo-image handles remote signed URLs directly — no download needed
      return (
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          contentContainerStyle={styles.imageContainer}
          showsVerticalScrollIndicator={false}
        >
          <Image
            source={{ uri: signedUrl }}
            style={{ width: screenWidth, height: screenHeight - 180 }}
            contentFit="contain"
            onError={(e) => {
              console.error('[DocumentViewer] Image load error:', e.error);
              setError('Could not display image. Tap to retry.');
            }}
          />
        </ScrollView>
      );
    }

    // PDF — render inline with WebView
    if (document.mime_type === 'application/pdf') {
      if (Platform.OS === 'ios' && localUri) {
        // iOS WebView renders local PDFs natively
        return (
          <WebView
            source={{ uri: localUri }}
            style={styles.flex}
            originWhitelist={['*']}
            onError={(e) => {
              console.error('[DocumentViewer] WebView error:', e.nativeEvent);
              setError('Could not display PDF. Tap to retry.');
            }}
          />
        );
      }
      if (Platform.OS === 'android' && pdfBase64) {
        // Android: embed base64 PDF in an HTML page with object/embed tag
        const html = `
          <!DOCTYPE html>
          <html><head>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{margin:0;padding:0;background:#1a1a1a;}
            iframe{width:100%;height:100%;border:none;}</style>
          </head><body>
            <iframe src="data:application/pdf;base64,${pdfBase64}"></iframe>
          </body></html>`;
        return (
          <WebView
            source={{ html }}
            style={styles.flex}
            originWhitelist={['*']}
            javaScriptEnabled
            allowFileAccess
            onError={(e) => {
              console.error('[DocumentViewer] WebView error:', e.nativeEvent);
              setError('Could not display PDF. Tap to retry.');
            }}
          />
        );
      }
    }

    if (!localUri) return null;

    // Word docs — open with system viewer (no reliable in-app renderer)
    return (
      <View style={styles.centered}>
        <MaterialCommunityIcons name="file-word" size={64} color={colors.primary} />
        <Text style={[styles.externalTitle, { color: colors.textPrimary }]}>
          {document.name}
        </Text>
        <Text style={[styles.externalSubtitle, { color: colors.textSecondary }]}>
          Tap below to open in your device's viewer
        </Text>
        <TouchableOpacity
          onPress={async () => {
            try {
              if (Platform.OS === 'android') {
                const contentUri = await FileSystem.getContentUriAsync(localUri);
                await Linking.openURL(contentUri);
              } else {
                await Linking.openURL(localUri);
              }
            } catch {
              showToast('No app found to open this file type.', 'error');
            }
          }}
          style={[styles.openButton, { backgroundColor: colors.primary }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="open-in-new" size={20} color="#fff" />
          <Text style={styles.openButtonText}>Open Document</Text>
        </TouchableOpacity>
      </View>
    );
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
          <View style={styles.rightSlot} />
        </View>

        {/* Content area */}
        <View style={styles.content}>
          {renderContent()}
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
  flex: {
    flex: 1,
  },
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
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  imageContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  externalTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 8,
  },
  externalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  openButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
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
