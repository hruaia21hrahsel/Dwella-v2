/**
 * supabase/functions/invite-redirect/index.ts
 *
 * Smart invite landing page. When a tenant taps the invite link:
 *   - If the app is installed  → JS opens dwella://invite/{token} immediately
 *   - If not installed         → after 2 s shows App Store / Play Store buttons
 *
 * URL: https://{project}.supabase.co/functions/v1/invite-redirect?token={token}
 *
 * TODO before launch: replace the placeholder store URLs below with real ones.
 */

// ── Placeholder store URLs — update these when the app is published ──────────
const APP_STORE_URL  = 'https://apps.apple.com/app/dwella/id000000000';   // TODO
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.dwella.app'; // TODO
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const url   = new URL(req.url);
  const token = url.searchParams.get('token')?.trim();

  if (!token) {
    return new Response('Missing invite token.', { status: 400 });
  }

  const deepLink  = `dwella://invite/${token}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Join me on Dwella</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F8FAFC;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .card {
      background: #fff;
      border-radius: 20px;
      padding: 36px 28px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(13, 148, 136, 0.12);
    }

    .logo {
      width: 72px;
      height: 72px;
      border-radius: 20px;
      background: linear-gradient(135deg, #0F766E, #0D9488);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 36px;
    }

    h1 { font-size: 22px; font-weight: 800; color: #0F172A; margin-bottom: 10px; }
    p  { font-size: 15px; color: #64748B; line-height: 1.6; margin-bottom: 24px; }

    .spinner {
      width: 36px; height: 36px;
      border: 3px solid #E2E8F0;
      border-top-color: #0D9488;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .opening-text { font-size: 14px; color: #64748B; }

    #fallback { display: none; }

    .store-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 14px 20px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      text-decoration: none;
      margin-bottom: 12px;
      transition: opacity 0.15s;
    }
    .store-btn:active { opacity: 0.8; }
    .store-btn-ios {
      background: #0F172A;
      color: #fff;
    }
    .store-btn-android {
      background: #0D9488;
      color: #fff;
    }

    .token-hint {
      font-size: 12px;
      color: #94A3B8;
      margin-top: 20px;
      line-height: 1.5;
    }
    .token-hint code {
      background: #F1F5F9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🏠</div>
    <h1>You've been invited to Dwella</h1>
    <p>Manage your tenancy, track payments, and stay connected with your landlord — all in one place.</p>

    <!-- Shown while trying to open the app -->
    <div id="opening">
      <div class="spinner"></div>
      <p class="opening-text">Opening Dwella…</p>
    </div>

    <!-- Shown after 2 s if app didn't open -->
    <div id="fallback">
      <p>Download the app, sign up, then tap this link again to accept your invitation.</p>

      <a href="${APP_STORE_URL}" class="store-btn store-btn-ios">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
        Download on the App Store
      </a>

      <a href="${PLAY_STORE_URL}" class="store-btn store-btn-android">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.18 23.76c.3.17.64.22.98.15l12.18-12.18L12.93 8.3 3.18 23.76zM20.65 9.57l-2.62-1.52-3.54 3.54 3.54 3.54 2.64-1.54c.75-.44.75-1.59-.02-2.02zM2.02.46C1.75.7 1.6 1.08 1.6 1.58v20.9c0 .5.15.88.43 1.12l.07.06L13.36 12.5v-.28L2.09.4l-.07.06zM16.12 13.13L12.93 9.93 3.18.46c-.34-.07-.68-.02-.98.15l12.92 12.52z"/>
        </svg>
        Get it on Google Play
      </a>

      <p class="token-hint">
        After installing, tap your original invite link again or enter code:<br/>
        <code>${token}</code>
      </p>
    </div>
  </div>

  <script>
    // Attempt to open the native app immediately
    window.location.href = "${deepLink}";

    // After 2 seconds, assume the app isn't installed and show download buttons
    setTimeout(function () {
      document.getElementById('opening').style.display = 'none';
      document.getElementById('fallback').style.display = 'block';
    }, 2000);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});
