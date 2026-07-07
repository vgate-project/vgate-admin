/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, any>
  export default component
}

declare global {
  interface Window {
    // Populated by public/env.js at runtime; lets the deployed build override
    // the API base URL without a rebuild.
    __ENV__?: { API_BASE_URL?: string }
  }
}

export {}
