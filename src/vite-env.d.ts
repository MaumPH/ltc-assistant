/// <reference types="vite/client" />

declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }
  export function createRoot(container: Element | DocumentFragment, options?: { onRecoverableError?: (error: unknown) => void }): Root;
  export function hydrateRoot(container: Element | Document, children: ReactNode, options?: { onRecoverableError?: (error: unknown) => void }): Root;
}

declare module '*.md?raw' {
  const content: string;
  export default content;
}

declare module '*.txt?raw' {
  const content: string;
  export default content;
}
