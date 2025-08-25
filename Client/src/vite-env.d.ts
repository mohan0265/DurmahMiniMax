// Minimal Vite env typings so TS stops complaining.
// No external type packages required.

export {};

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;

    // (optional extras you already use; safe to keep)
    readonly VITE_SESSION_ENDPOINT?: string;
    readonly VITE_TTS_PROVIDER?: string;
    readonly VITE_TTS_VOLUME?: string;
    readonly VITE_TTS_RATE?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
