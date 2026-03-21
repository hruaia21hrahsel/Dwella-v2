import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';
import { DocumentCategory } from './types';
import { DOCUMENTS_BUCKET } from '@/constants/config';

// ── Storage path helpers ─────────────────────────────────────────────────────

/**
 * Returns the storage path for a document inside the documents bucket.
 * - Property-wide:   {propertyId}/property/{uuid}.{ext}
 * - Tenant-specific: {propertyId}/{tenantId}/{uuid}.{ext}
 */
export function getDocumentStoragePath(
  propertyId: string,
  tenantId: string | null,
  fileExt: string,
): string {
  const uuid = Crypto.randomUUID();
  const scope = tenantId ?? 'property';
  return `${propertyId}/${scope}/${uuid}.${fileExt}`;
}

// ── Viewer URL ───────────────────────────────────────────────────────────────

/**
 * Returns the URL to load in a WebView for viewing the document.
 * - PDF: direct signed URL (WebView renders natively on iOS + Android)
 * - Word: Google Docs Viewer URL (embedded)
 * - Images: signed URL (rendered via Image component, not WebView)
 */
export function getViewerUrl(signedUrl: string, mimeType: string): string {
  if (mimeType === 'application/pdf') {
    return signedUrl;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl)}&embedded=true`;
  }
  return signedUrl;
}

// ── MIME utilities ───────────────────────────────────────────────────────────

/**
 * Maps a MIME type to a file extension string.
 */
export function mimeToExt(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'application/msword':
      return 'doc';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx';
    default:
      return 'bin';
  }
}

/**
 * Extracts the lowercase extension from a filename.
 */
export function getExtFromFilename(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? 'bin';
}

/**
 * Returns true if the MIME type represents an image.
 */
export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

// ── File size formatting ─────────────────────────────────────────────────────

/**
 * Formats a byte count into a human-readable string (B, KB, or MB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1048576) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── Storage operations ───────────────────────────────────────────────────────

/**
 * Uploads a document file to Supabase Storage.
 * Uses FileSystem base64 read to handle content:// URIs on Android reliably.
 */
export async function uploadDocument(
  asset: { uri: string; mimeType?: string | null; name: string },
  storagePath: string,
): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const buffer = decode(base64);

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: asset.mimeType ?? 'application/octet-stream',
    });

  if (error) throw error;
}

/**
 * Atomically deletes a document: storage file first, then DB row.
 * If the storage delete fails, the DB row is NOT deleted (preserves consistency).
 */
export async function deleteDocument(doc: { id: string; storage_path: string }): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([doc.storage_path]);

  if (storageError) {
    throw new Error('Failed to remove file: ' + storageError.message);
  }

  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', doc.id);

  if (dbError) {
    throw new Error('File removed but record delete failed: ' + dbError.message);
  }
}

/**
 * Downloads a document to the cache directory and opens the OS share sheet.
 * Throws if sharing is not available on the device.
 */
export async function shareDocument(
  doc: { name: string; mime_type: string },
  signedUrl: string,
): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  const ext = mimeToExt(doc.mime_type);
  const localUri = FileSystem.cacheDirectory + doc.name + '.' + ext;

  const { uri } = await FileSystem.downloadAsync(signedUrl, localUri);
  await Sharing.shareAsync(uri, { mimeType: doc.mime_type });
}

/**
 * Generates a 1-hour signed URL for accessing a document in storage.
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    throw error ?? new Error('No signed URL returned');
  }

  return data.signedUrl;
}

// ── Icon and label constants ─────────────────────────────────────────────────

/** Material Community Icons name for each supported MIME type. */
export const MIME_ICONS: Record<string, string> = {
  'application/pdf': 'file-pdf-box',
  'image/jpeg': 'file-image',
  'image/png': 'file-image',
  'application/msword': 'file-word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'file-word',
};

/** Fallback icon for unrecognised MIME types. */
export const DEFAULT_MIME_ICON = 'file-document-outline';

/** Material Community Icons name for each document category. */
export const CATEGORY_ICONS: Record<string, string> = {
  lease: 'file-sign',
  id: 'card-account-details',
  insurance: 'shield-check',
  receipts: 'receipt',
  other: 'folder-outline',
};

/** Human-readable label for each document category. */
export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  lease: 'Lease',
  id: 'ID',
  insurance: 'Insurance',
  receipts: 'Receipts',
  other: 'Other',
};

/** All categories in display order. */
export const ALL_CATEGORIES: DocumentCategory[] = [
  'lease',
  'id',
  'insurance',
  'receipts',
  'other',
];
