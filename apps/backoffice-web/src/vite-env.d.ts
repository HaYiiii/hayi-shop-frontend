/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin, e.g. https://api.hayi.vn; unset for the same-origin proxy. */
  readonly VITE_API_ORIGIN?: string;
}
