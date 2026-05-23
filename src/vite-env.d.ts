/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_SECRET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
