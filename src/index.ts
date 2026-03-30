// ═══════════════════════════════════════════════════════════════
// StreamMD — Public API
// ═══════════════════════════════════════════════════════════════

// Component
export { StreamMD } from "./components/StreamMD";

// Hook
export { useStreamMD } from "./hooks/useStreamMD";

// Parser (advanced usage)
export { StreamParser } from "./parser/StreamParser";
export { parseInline } from "./parser/InlineParser";

// Highlighter
export { highlight } from "./highlight/highlighter";

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
} from "./parser/types";
