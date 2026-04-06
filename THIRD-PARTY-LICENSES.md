# Third-Party Licenses — Dwella v1.0

**Generated:** 2026-04-06
**Scope:** Production runtime dependencies, bundled assets, and fonts shipped in the iOS/Android app binary. Dev dependencies are excluded (they do not ship).

## Attestation

No GPL, AGPL, LGPL, or SSPL licensed code is bundled in the Dwella v1.0 production build.

Two packages in the full `node_modules` tree have copyleft license references, but neither contaminates the production binary:

1. **`@img/sharp-win32-x64@0.34.5`** — Licensed `Apache-2.0 AND LGPL-3.0-or-later`. This is `sharp`, listed under `optionalDependencies` in `package.json`. It is a build-time image optimization tool and is **not bundled** in the iOS/Android binary. The LGPL-3.0 component (libvips) never ships to end users.

2. **`node-forge@1.3.3`** — Licensed `(BSD-3-Clause OR GPL-2.0)`. This is a dual-licensed package. Under the SPDX OR expression, we elect the **BSD-3-Clause** license, which is fully permissive.

Verification: `grep -iE '"licenses?": *"[^"]*\b(A?GPL|LGPL|SSPL)[^"]*"' .planning/legal/npm-licenses.json` returns exactly two matches, both accounted for above.

## 1. NPM Runtime Dependencies

Source: `npx license-checker-rseidelsohn --production --json` -> `.planning/legal/npm-licenses.json` (committed for audit).

**762 packages total. License distribution:**

| License | Count |
|---------|-------|
| MIT | 650 |
| ISC | 42 |
| BSD-3-Clause | 17 |
| BSD-2-Clause | 15 |
| Apache-2.0 | 13 |
| BlueOak-1.0.0 | 9 |
| Unlicense | 2 |
| 0BSD | 2 |
| MPL-2.0 | 2 |
| (MIT OR CC0-1.0) | 2 |
| Apache-2.0 AND LGPL-3.0-or-later | 1 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| UNLICENSED | 1 |
| CC0-1.0 | 1 |
| (BSD-3-Clause OR GPL-2.0) | 1 |
| Apache 2.0 | 1 |
| (BSD-2-Clause OR MIT OR Apache-2.0) | 1 |

**Note:** The 1 `UNLICENSED` package should be investigated before final store submission to confirm it is an internal or Expo-managed package.

Full per-package manifest: see `.planning/legal/npm-licenses.json`.

## 2. Bundled Assets

See `.planning/legal/asset-provenance.md` (Phase 1 Plan 05) for full provenance of every image/icon/splash asset. Summary:

- `assets/icon.png` — see asset-provenance.md
- `assets/adaptive-icon.png` — see asset-provenance.md
- `assets/splash.png` — see asset-provenance.md
- `assets/favicon.png` — see asset-provenance.md
- `assets/images/logo.png` — see asset-provenance.md

## 3. Fonts

Dwella v1.0 uses only platform system fonts. No `@expo-google-fonts/*` packages are present in `package.json` (verified 2026-04-06), so no SIL OFL attestation is required. If custom fonts are added in a future release, this section MUST be updated.

## 4. Regeneration

To regenerate Section 1:
```bash
npx --yes license-checker-rseidelsohn --production --json 2>/dev/null > .planning/legal/npm-licenses.json
```
Then re-aggregate counts via:
```bash
node -e "const d=require('./.planning/legal/npm-licenses.json'); const c={}; for(const [p,i] of Object.entries(d)){const l=i.licenses||'UNKNOWN';c[l]=(c[l]||0)+1;} Object.entries(c).sort((a,b)=>b[1]-a[1]).forEach(([l,n])=>console.log(n+' '+l));"
```
