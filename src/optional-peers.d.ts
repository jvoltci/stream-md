/**
 * Type shims for optional peer dependencies.
 *
 * These packages are listed as `peerDependenciesMeta.optional: true` so end
 * users don't need them installed. We declare minimal `any`-typed shims so
 * `tsc --noEmit` passes without the packages present.
 *
 * Real type-checking against these libraries happens in the consumer's
 * project, where the packages ARE installed.
 */
declare module "katex" {
  const katex: {
    renderToString: (
      tex: string,
      options?: { throwOnError?: boolean; displayMode?: boolean },
    ) => string;
  };
  export default katex;
}

declare module "mermaid" {
  const mermaid: {
    initialize: (config: Record<string, unknown>) => void;
    render: (id: string, source: string) => Promise<{ svg: string }>;
  };
  export default mermaid;
}

declare module "shiki" {
  export function createHighlighter(opts: {
    themes: string[];
    langs: string[];
  }): Promise<unknown>;
  export function getHighlighter(opts: {
    themes: string[];
    langs: string[];
  }): Promise<unknown>;
}

declare module "micromark" {
  export function micromark(value: string, options?: Record<string, unknown>): string;
}

declare module "micromark-extension-gfm" {
  export function gfm(): unknown;
}
