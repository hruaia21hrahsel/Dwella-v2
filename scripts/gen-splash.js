/**
 * Generates:
 *   assets/splash.png        — 1284x2778, teal bg, white Dwella logo
 *   assets/adaptive-icon.png — 1024x1024, teal bg, white Dwella logo
 *
 * Run: node scripts/gen-splash.js
 */
const sharp = require('sharp');
const path = require('path');

const PRIMARY = '#009688';

// Logo viewBox: "10 30 180 115"
function logoSvg(canvasW, canvasH, logoTargetW) {
  const SCALE = logoTargetW / 180;
  const LOGO_H = 115 * SCALE;
  const CX = canvasW / 2;
  const CY = canvasH / 2;

  const tx = CX - logoTargetW / 2 - 10 * SCALE;
  const ty = CY - LOGO_H / 2 - 30 * SCALE;

  return `<svg width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}"
  xmlns="http://www.w3.org/2000/svg">

  <!-- Background -->
  <rect width="${canvasW}" height="${canvasH}" fill="${PRIMARY}"/>

  <!-- Dwella logo — white on teal -->
  <g transform="translate(${tx}, ${ty}) scale(${SCALE})">
    <text x="18" y="125"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="54" font-weight="400"
      fill="#FFFFFF" letter-spacing="1">dwe</text>

    <rect x="122" y="74" width="6" height="53" rx="1" fill="#FFFFFF"/>
    <rect x="142" y="74" width="6" height="53" rx="1" fill="#FFFFFF"/>

    <path d="M116 76 L135 50 L154 76"
      fill="none" stroke="#FFFFFF" stroke-width="4"
      stroke-linecap="round" stroke-linejoin="round"/>

    <text x="154" y="125"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="54" font-weight="400"
      fill="#FFFFFF">a</text>

    <line x1="18" y1="138" x2="185" y2="138"
      stroke="#FFFFFF" stroke-width="1.5" opacity="0.3"/>

    <!-- Sparkles — white with amber tint -->
    <path d="M158 42 L160 36 L162 42 L168 44 L162 46 L160 52 L158 46 L152 44 Z"
      fill="#FFFFFF"/>
    <path d="M168 56 L169 53 L170 56 L173 57 L170 58 L169 61 L168 58 L165 57 Z"
      fill="#FFFFFF" opacity="0.7"/>
    <path d="M148 36 L149 34 L150 36 L152 37 L150 38 L149 40 L148 38 L146 37 Z"
      fill="#FFFFFF" opacity="0.5"/>
  </g>
</svg>`;
}

async function generate(svgStr, outPath) {
  const info = await sharp(Buffer.from(svgStr)).png().toFile(outPath);
  console.log(`✓ ${path.basename(outPath)} (${info.width}x${info.height})`);
}

Promise.all([
  generate(
    logoSvg(1284, 2778, 820),
    path.join(__dirname, '..', 'assets', 'splash.png')
  ),
  generate(
    logoSvg(1024, 1024, 560),
    path.join(__dirname, '..', 'assets', 'adaptive-icon.png')
  ),
]).catch(console.error);
