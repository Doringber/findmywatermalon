/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL of the optional Claude-vision Worker. When unset, the AI feature is hidden. */
  readonly VITE_AI_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
