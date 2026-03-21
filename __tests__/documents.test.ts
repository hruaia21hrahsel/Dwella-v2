/**
 * Unit tests for lib/documents.ts pure utility functions.
 *
 * Async functions (uploadDocument, deleteDocument, shareDocument, getSignedUrl)
 * require Supabase + device APIs — those are integration-tested manually.
 * All pure/deterministic logic is covered here.
 */

// expo-crypto is mocked in __tests__/setup.ts:
// randomUUID returns '00000000-1111-4222-8333-444444444444'

import {
  getDocumentStoragePath,
  getViewerUrl,
  mimeToExt,
  getExtFromFilename,
  isImageMime,
  formatFileSize,
} from '@/lib/documents';

// ── getDocumentStoragePath ───────────────────────────────────────────────────

describe('getDocumentStoragePath', () => {
  const FIXED_UUID = '00000000-1111-4222-8333-444444444444';
  const propertyId = 'prop-abc';
  const tenantId = 'tenant-xyz';

  it('returns property-wide path when tenantId is null', () => {
    const path = getDocumentStoragePath(propertyId, null, 'pdf');
    expect(path).toBe(`${propertyId}/property/${FIXED_UUID}.pdf`);
  });

  it('returns tenant-specific path when tenantId is provided', () => {
    const path = getDocumentStoragePath(propertyId, tenantId, 'pdf');
    expect(path).toBe(`${propertyId}/${tenantId}/${FIXED_UUID}.pdf`);
  });

  it('uses the provided file extension', () => {
    const path = getDocumentStoragePath(propertyId, null, 'jpg');
    expect(path).toMatch(/\.jpg$/);
  });

  it('segments are correctly ordered: {property}/{scope}/{uuid}.{ext}', () => {
    const path = getDocumentStoragePath(propertyId, tenantId, 'docx');
    const parts = path.split('/');
    expect(parts[0]).toBe(propertyId);
    expect(parts[1]).toBe(tenantId);
    expect(parts[2]).toMatch(/^[0-9a-f-]+\.docx$/i);
  });
});

// ── getViewerUrl ─────────────────────────────────────────────────────────────

describe('getViewerUrl', () => {
  const signedUrl = 'https://example.supabase.co/storage/v1/sign/documents/file.pdf?token=abc';

  it('returns the signed URL directly for PDF', () => {
    const result = getViewerUrl(signedUrl, 'application/pdf');
    expect(result).toBe(signedUrl);
  });

  it('returns a Google Docs Viewer URL for Word (.doc)', () => {
    const result = getViewerUrl(signedUrl, 'application/msword');
    expect(result).toContain('docs.google.com/viewer');
    expect(result).toContain(encodeURIComponent(signedUrl));
    expect(result).toContain('embedded=true');
  });

  it('returns a Google Docs Viewer URL for Word (.docx)', () => {
    const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const result = getViewerUrl(signedUrl, mimeType);
    expect(result).toContain('docs.google.com/viewer');
  });

  it('returns the signed URL directly for image MIME types (not WebView)', () => {
    const result = getViewerUrl(signedUrl, 'image/jpeg');
    expect(result).toBe(signedUrl);
  });

  it('returns the signed URL for unknown MIME types', () => {
    const result = getViewerUrl(signedUrl, 'application/octet-stream');
    expect(result).toBe(signedUrl);
  });
});

// ── mimeToExt ────────────────────────────────────────────────────────────────

describe('mimeToExt', () => {
  it('returns pdf for application/pdf', () => {
    expect(mimeToExt('application/pdf')).toBe('pdf');
  });

  it('returns jpg for image/jpeg', () => {
    expect(mimeToExt('image/jpeg')).toBe('jpg');
  });

  it('returns png for image/png', () => {
    expect(mimeToExt('image/png')).toBe('png');
  });

  it('returns doc for application/msword', () => {
    expect(mimeToExt('application/msword')).toBe('doc');
  });

  it('returns docx for the Word openxml MIME type', () => {
    expect(mimeToExt('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('docx');
  });

  it('returns bin for an unrecognised MIME type', () => {
    expect(mimeToExt('application/octet-stream')).toBe('bin');
    expect(mimeToExt('text/plain')).toBe('bin');
  });
});

// ── getExtFromFilename ────────────────────────────────────────────────────────

describe('getExtFromFilename', () => {
  it('extracts extension from a simple filename', () => {
    expect(getExtFromFilename('document.pdf')).toBe('pdf');
    expect(getExtFromFilename('image.JPEG')).toBe('jpeg');
  });

  it('handles filenames with multiple dots', () => {
    expect(getExtFromFilename('my.file.name.docx')).toBe('docx');
  });

  it('returns bin for a filename with no extension', () => {
    expect(getExtFromFilename('noextension')).toBe('noextension');
  });
});

// ── isImageMime ──────────────────────────────────────────────────────────────

describe('isImageMime', () => {
  it('returns true for image/jpeg', () => {
    expect(isImageMime('image/jpeg')).toBe(true);
  });

  it('returns true for image/png', () => {
    expect(isImageMime('image/png')).toBe(true);
  });

  it('returns false for application/pdf', () => {
    expect(isImageMime('application/pdf')).toBe(false);
  });

  it('returns false for Word MIME types', () => {
    expect(isImageMime('application/msword')).toBe(false);
    expect(isImageMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(false);
  });
});

// ── formatFileSize ────────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('formats bytes under 1 KB', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('formats sizes in KB range', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(512000)).toBe('500.0 KB');
    expect(formatFileSize(1048575)).toBe('1024.0 KB');
  });

  it('formats sizes in MB range', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(5242880)).toBe('5.0 MB');
    expect(formatFileSize(10485760)).toBe('10.0 MB');
  });
});
