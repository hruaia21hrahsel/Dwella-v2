/**
 * Generates assets/splash.png — dark premium background, big Dwella logo.
 * Run: node scripts/gen-splash.js
 */
const sharp = require('sharp');
const path = require('path');

// Logo viewBox: "10 30 180 115"
// Scale to ~820px wide on a 1284x2778 canvas.
const SCALE = 820 / 180;           // ≈ 4.56
const LOGO_W = 180 * SCALE;        // 820
const LOGO_H = 115 * SCALE;        // ~524
const CX = 1284 / 2;               // 642
const CY = 2778 / 2 - 40;         // slightly above centre

const tx = CX - LOGO_W / 2 - 10 * SCALE;   // account for viewBox x=10
const ty = CY - LOGO_H / 2 - 30 * SCALE;   // account for viewBox y=30

const taglineY = CY + LOGO_H / 2 + 56;

const svg = `<svg width="1284" height="2778" viewBox="0 0 1284 2778"
  xmlns="http://www.w3.org/2000/svg">

  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#07070F"/>
      <stop offset="100%" stop-color="#0F0C20"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="49%" r="28%">
      <stop offset="0%"   stop-color="#4F46E5" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#07070F" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1284" height="2778" fill="url(#bg)"/>
  <rect width="1284" height="2778" fill="url(#glow)"/>

  <!-- Dwella logo -->
  <g transform="translate(${tx}, ${ty}) scale(${SCALE})">
    <text x="18" y="125"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="54" font-weight="400"
      fill="#EDE9FF" letter-spacing="1">dwe</text>

    <rect x="122" y="74" width="6" height="53" rx="1" fill="#EDE9FF"/>
    <rect x="142" y="74" width="6" height="53" rx="1" fill="#EDE9FF"/>

    <path d="M116 76 L135 50 L154 76"
      fill="none" stroke="#EDE9FF" stroke-width="4"
      stroke-linecap="round" stroke-linejoin="round"/>

    <text x="154" y="125"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="54" font-weight="400"
      fill="#EDE9FF">a</text>

    <line x1="18" y1="138" x2="185" y2="138"
      stroke="#EDE9FF" stroke-width="1.5" opacity="0.15"/>

    <!-- Sparkles -->
    <path d="M158 42 L160 36 L162 42 L168 44 L162 46 L160 52 L158 46 L152 44 Z"
      fill="#F59E0B"/>
    <path d="M168 56 L169 53 L170 56 L173 57 L170 58 L169 61 L168 58 L165 57 Z"
      fill="#F59E0B" opacity="0.7"/>
    <path d="M148 36 L149 34 L150 36 L152 37 L150 38 L149 40 L148 38 L146 37 Z"
      fill="#F59E0B" opacity="0.5"/>
  </g>

  <!-- Tagline -->
  <text x="642" y="${taglineY}"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="26" fill="#3A3A5C" letter-spacing="7">
    your rental, simplified
  </text>
</svg>`;

sharp(Buffer.from(svg))
  .png()
  .toFile(path.join(__dirname, '..', 'assets', 'splash.png'))
  .then(info => console.log('✓ splash.png written', info))
  .catch(console.error);
