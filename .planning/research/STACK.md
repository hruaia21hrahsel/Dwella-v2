# Stack Research

**Domain:** React Native / Expo managed workflow — Document Storage, Maintenance Requests, Reporting Dashboards
**Researched:** 2026-03-20
**Confidence:** HIGH (charts, document picker, file system), MEDIUM (PDF viewing approach)

---

## Context

This is a **subsequent milestone** (v1.1) for an existing Expo SDK 54 + React Native 0.81.5 + Supabase app. The baseline stack is fixed. This document covers only the **net-new library additions** required for three new feature areas:

1. **Document Storage** — bi-directional uploads (PDF, images, DOCX), property + tenant level, inline viewing
2. **Maintenance Requests** — tenant photo submission, status workflow, expense linking
3. **Reporting Dashboards** — P&L, expense breakdown, payment reliability, occupancy charts

**Already available (no changes needed):**
- `expo-image-picker` ~17.0.10 — maintenance photo capture, already used for payment proofs
- `expo-file-system` ~19.0.21 — file download and cache management
- `expo-sharing` ~14.0.8 — "Share" / "Open in..." native sheet
- `expo-print` ~15.0.8 — PDF generation (receipt printing already wired)
- `react-native-svg` 15.12.1 — required peer dependency for gifted-charts, already present
- `expo-linear-gradient` ~15.0.8 — optional peer for gifted-charts, already present
- Supabase Storage — bucket infrastructure, upload/download already working for payment proofs

---

## Recommended Stack

### Core Technologies (New Additions)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `expo-document-picker` | ~14.0.0 | Pick PDF, DOCX, images from device storage / cloud drives (iCloud, Google Drive) | First-party Expo package, managed workflow native, matches the `npx expo install` version pin for SDK 54. SDK 54 upgraded expo-file-system integration — picked files can be read immediately from the cache directory. No eject needed. |
| `react-native-gifted-charts` | ^1.4.76 | Bar, line, pie, and donut charts for P&L, expense breakdown, payment reliability, occupancy dashboards | Pure JS + react-native-svg (already installed). Zero new native modules. Expo managed compatible. Single library covers all four chart types needed. Actively maintained (1.4.76 as of early 2026). `react-native-svg` and `expo-linear-gradient` are already present — no additional peer installs required. |
| `react-native-webview` | ~14.1.1 | Inline PDF rendering via Google Docs Viewer (remote) or PDF.js HTML (local/signed URL) | No native PDF module exists that works in Expo managed workflow without a custom dev build config plugin. WebView is the only zero-eject PDF rendering path. Already supported in Expo SDK 54 managed workflow. Version ~14.1.1 is the SDK 54 compatible pin. |

### Supporting Libraries (No New Install Required)

| Library | Version | Purpose | How It Applies |
|---------|---------|---------|----------------|
| `expo-image-picker` | ~17.0.10 (installed) | Camera + photo library picker for maintenance request photos | Already used for payment proof uploads — identical pattern. No changes needed. |
| `expo-file-system` | ~19.0.21 (installed) | Download signed URLs from Supabase Storage to local cache before sharing/viewing | `FileSystem.downloadAsync()` to cache, then pass URI to WebView or `expo-sharing` |
| `expo-sharing` | ~14.0.8 (installed) | "Open in..." native sheet for downloaded documents | Fallback when user wants to open a document in an external app (Files, Mail, etc.) |
| `react-native-svg` | 15.12.1 (installed) | Required peer dependency for `react-native-gifted-charts` | Already present at a compatible version — no upgrade needed |
| `expo-linear-gradient` | ~15.0.8 (installed) | Optional peer for gradient fills in gifted-charts | Already present — enables gradient bar/line fills without additional install |
| `@supabase/supabase-js` | ^2.45.0 (installed) | Storage bucket upload/download for documents | New `documents` bucket alongside existing `payment-proofs` bucket. Same client, new bucket path pattern. |

---

## Installation

```bash
# New installs only — all peers are already present
npx expo install expo-document-picker react-native-webview react-native-gifted-charts
```

That is all. Three packages. No native config plugins required for any of them in managed workflow.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `react-native-gifted-charts` | `victory-native` (XL) | Victory Native XL requires Skia (`@shopify/react-native-skia`) which needs a custom dev build and is not compatible with Expo Go. Gifted Charts is SVG-based — no native dependency beyond react-native-svg, which is already installed. |
| `react-native-gifted-charts` | `recharts` | Recharts is a web-only library (DOM-dependent). Does not render on React Native. |
| `react-native-gifted-charts` | `react-native-chart-kit` | react-native-chart-kit is largely unmaintained (last meaningful commit 2022). Gifted Charts is actively maintained and more feature-rich. |
| `react-native-webview` for PDFs | `react-native-pdf` | react-native-pdf requires a config plugin (`@config-plugins/react-native-pdf`) and a custom dev build. Dwella uses Expo managed workflow — adding a custom native module requires a new EAS build cycle for every update. WebView approach works today without any EAS build changes. |
| `react-native-webview` for PDFs | `pdf-viewer-expo` (npm) | Version 1.0.0, 1 GitHub star, 5 commits, no releases published, no pagination or zoom. Not production-ready. |
| `expo-document-picker` | `react-native-document-picker` | The community `react-native-document-picker` requires manual native linking. `expo-document-picker` is first-party, versioned with the SDK, and works in managed workflow without any config plugin. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-native-pdf` | Requires config plugin + custom dev build. Breaks Expo managed workflow OTA update compatibility (native module version is pinned to the build, not the JS bundle). | `react-native-webview` + Google Docs Viewer URL or PDF.js HTML string |
| `@shopify/react-native-skia` (Victory Native XL) | Custom dev build required. Significant bundle size increase. Overkill for property management dashboards. | `react-native-gifted-charts` (SVG-based, no native requirement) |
| `recharts` | DOM-only. Will throw on React Native at import time. | `react-native-gifted-charts` |
| `react-native-chart-kit` | Unmaintained since 2022. API is incomplete and has unfixed rendering bugs on newer RN versions. | `react-native-gifted-charts` |
| `pdf-viewer-expo` | 1 star, 5 commits, v1.0.0 only, no zoom or pagination, no active maintenance. | `react-native-webview` with PDF.js HTML approach |
| Direct `Linking.openURL()` for PDFs | Opens Safari/Chrome — user leaves the app for every document view. Breaks the in-app UX model. | `react-native-webview` inline viewer |

---

## Stack Patterns by Feature

**Document upload (landlord or tenant):**
- Use `expo-document-picker` to select files (PDF, DOCX, images via `type: ['*/*']`)
- Upload directly to Supabase Storage via `supabase.storage.from('documents').upload(path, file)`
- Path pattern: `{property_id}/{scope}/{filename}` where scope is `property` or `tenant/{tenant_id}`

**Document viewing (inline PDF):**
- Download signed URL from Supabase Storage
- If the document is a PDF: render in `react-native-webview` using Google Docs Viewer URL as source (`https://docs.google.com/viewer?url={encodeURIComponent(signedUrl)}&embedded=true`) for remote URLs, or a PDF.js HTML string for downloaded local files
- If the document is an image: display inline with React Native `Image` component
- If the user wants to export/open externally: `expo-sharing` native sheet

**Maintenance request photo upload:**
- Use `expo-image-picker` (already installed and used for payment proofs) — identical pattern
- Upload to `maintenance-photos` Supabase Storage bucket at `{property_id}/{request_id}/{sequence}.jpg`
- Multiple photos per request: iterate `ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true })`

**Reporting dashboards:**
- `BarChart` from `react-native-gifted-charts` for monthly P&L and expense breakdown
- `LineChart` for payment reliability trend over time
- `PieChart` / `DonutChart` for occupancy rate and expense category breakdown
- Pass `expo-linear-gradient` colors through `frontColor` / `gradientColor` props for the existing brand palette

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `react-native-gifted-charts` ^1.4.76 | `react-native-svg` 15.x, `expo-linear-gradient` ~15.x | Peer deps use `*` version constraints — all installed versions are compatible. No changes to existing packages. |
| `expo-document-picker` ~14.0.0 | Expo SDK 54, React Native 0.81.5 | Version 14 targets SDK 54. `copyToCacheDirectory: true` required on Android for `expo-file-system` to read immediately after pick (already the default). iOS requires `usesIcloudStorage: true` in `app.json` for iCloud Drive access. |
| `react-native-webview` ~14.1.1 | Expo SDK 54, New Architecture (Fabric) supported | Supports both Paper and Fabric renderers. Use `npx expo install` to get the SDK 54 pinned version — do not manually specify a version or you risk a Paper/Fabric mismatch. |

---

## Supabase Storage Notes

The existing `payment-proofs` bucket pattern is the model. For v1.1, add two new buckets via migration:

| Bucket | Path Pattern | Allowed MIME Types | Max Size |
|--------|-------------|---------------------|----------|
| `documents` | `{property_id}/{scope}/{filename}` | `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/*` | 50 MB (Free plan global limit) |
| `maintenance-photos` | `{property_id}/{request_id}/{seq}.jpg` | `image/jpeg`, `image/png` | 10 MB |

RLS on both buckets must gate on `auth.uid()` matching the `owner_id` of the parent property or the `user_id` on the linked tenant row — same pattern already proven in `payment-proofs`.

---

## Sources

- [Expo DocumentPicker Documentation](https://docs.expo.dev/versions/latest/sdk/document-picker/) — API surface, iOS iCloud requirements. HIGH confidence.
- [expo-document-picker CHANGELOG](https://github.com/expo/expo/blob/main/packages/expo-document-picker/CHANGELOG.md) — Version 14.0.0 targets SDK 54. HIGH confidence.
- [react-native-gifted-charts GitHub](https://github.com/Abhinandan-Kushwaha/react-native-gifted-charts) — Version 1.4.76, peer dependencies confirmed from package.json. HIGH confidence.
- [react-native-gifted-charts npm](https://www.npmjs.com/package/react-native-gifted-charts) — Active maintenance, Expo managed workflow compatibility confirmed. HIGH confidence.
- [react-native-webview Expo Documentation](https://docs.expo.dev/versions/latest/sdk/webview/) — Managed workflow support, Fabric/Paper compatibility. HIGH confidence.
- [pdf-viewer-expo GitHub](https://github.com/abdelouali/pdf-viewer-expo) — Version 1.0.0, 1 star, not production-ready. Used to rule out. HIGH confidence.
- [Supabase Storage File Limits](https://supabase.com/docs/guides/storage/uploads/file-limits) — 50 MB global Free plan limit, per-bucket MIME type restrictions. HIGH confidence.
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54) — File system upgrade context, SDK 54 release date August 2025. HIGH confidence.
- [Victory Native docs](https://nearform.com/open-source/victory/docs/introduction/native/) — Skia/native dependency requirement confirmed. Used to rule out. MEDIUM confidence.
- [LogRocket: Top React Native Chart Libraries 2025](https://blog.logrocket.com/top-react-native-chart-libraries/) — Comparative analysis confirming gifted-charts maintenance advantage. MEDIUM confidence.

---

*Stack research for: Dwella v2 — v1.1 Document Storage, Maintenance Requests, Reporting Dashboards*
*Researched: 2026-03-20*
