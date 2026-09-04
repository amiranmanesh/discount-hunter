/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Where the API proxy lives. Empty means `/api` on this app's own origin. */
  readonly VITE_API_BASE?: string;
  /** Sub-path the app is served from, for a project GitHub Pages site. */
  readonly VITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
