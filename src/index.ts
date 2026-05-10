/**
 * stream-md — public API.
 *
 * The default entry exports the React layer. For framework-agnostic
 * use, import from `stream-md/core`. For server / RSC, import from
 * `stream-md/server`. For Next.js helpers, import from `stream-md/next`.
 */

// Component
export { StreamMD } from "./components/StreamMD";

// Hook
export { useStreamMD } from "./hooks/useStreamMD";

// Renderer pieces (for advanced usage / custom blocks)
export { InlineRenderer } from "./components/InlineRenderer";

// Parser (advanced usage)
export { StreamParser } from "./parser/StreamParser";
export { parseInline } from "./parser/InlineParser";

// Highlighter
export { highlight } from "./highlight/highlighter";
export { highlightDiff } from "./highlight/diff";

// Sanitizer + limits
export { sanitizeUrl, sanitizeImageUrl } from "./core/sanitize";
export type { SanitizeUrlOptions } from "./core/sanitize";
export { DEFAULT_LIMITS } from "./core/limits";
export type { Limits } from "./core/limits";

// Plugin helpers
export { composePlugins, delimitedInlinePlugin, fencedBlockPlugin } from "./plugins";

// Types
export type {
  Block,
  BlockType,
  BlockMeta,
  InlineToken,
  InlineTokenType,
  ParseResult,
  StreamMDProps,
  StreamMDOptions,
  ComponentOverrides,
  BlockComponentProps,
  CodeBlockProps,
  ListBlockProps,
  TableBlockProps,
  LinkProps,
  InlineCodeProps,
  ImageProps,
  HighlighterFn,
  BlockPlugin,
  InlinePlugin,
  BlockPluginOpenResult,
  InlinePluginMatchResult,
} from "./parser/types";
export type { HighlightToken } from "./highlight/highlighter";
