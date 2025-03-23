/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * API-Key für die Smithery Registry
   * Format: 'xxxxxx-xxxxxx-xxxxxx-xxxxxx'
   */
  readonly VITE_SMITHERY_API_KEY: string
  
  // Hier können weitere Umgebungsvariablen definiert werden
}

interface ImportMeta {
  readonly env: ImportMetaEnv
} 