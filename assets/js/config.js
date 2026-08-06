/* =========================================================================
   LSC · Deployment configuration
   ---------------------------------------------------------------------------
   Edit this file (or set window.LSC_CONFIG before the app scripts load) to
   point the tool at your own repository, contact channels and relay endpoint.
   Nothing secret belongs here — this file is public.
   ========================================================================= */

const DEFAULTS = {
  /** Repository that stores the sealed records. */
  owner: 'Pol4720',
  repo: 'LSC',
  branch: 'main',

  /** Public key the intake form seals submissions with. */
  advisorKeyPath: 'data/config/advisor-key.json',

  /**
   * Optional HTTPS endpoint that commits submissions to the repo in real time.
   * Leave empty to use link/download delivery. Ready-made implementations live
   * in api/submit.js (Vercel) and worker/index.js (Cloudflare Workers).
   */
  relayUrl: '',

  /** Contact fallbacks shown on the success screen. Digits only for WhatsApp. */
  advisorWhatsApp: '17866002222',
  advisorEmail: 'info@rostrosmagazine.com',

  /** Brand surface. */
  brandName: 'La Subasta Cubana',
  siteUrl: 'https://pol4720.github.io/LSC/',
};

/** Runtime overrides: <script>window.LSC_CONFIG = {...}</script> before app.js */
export const CONFIG = Object.freeze({ ...DEFAULTS, ...(globalThis.LSC_CONFIG || {}) });

export default CONFIG;
