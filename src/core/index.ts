/**
 * stream-md/core — framework-agnostic streaming markdown.
 *
 * Pure ESM. No React, no DOM. Works in Node, Edge, browsers, workers.
 * Use this when you want the parser without any rendering layer.
 */

export { StreamParser } from "../parser/StreamParser";
export { parseInline } from "../parser/InlineParser";
export { highlight } from "../highlight/highlighter";
export { highlightDiff } from "../highlight/diff";
export { sanitizeUrl, sanitizeImageUrl } from "./sanitize";
export type { SanitizeUrlOptions } from "./sanitize";
export { DEFAULT_LIMITS, clampText } from "./limits";
export type { Limits } from "./limits";
export type {
  Block,
  BlockType,
  BlockMeta,
  InlineToken,
  InlineTokenType,
  ParseResult,
  StreamMDOptions,
} from "../parser/types";
export type { HighlightToken } from "../highlight/highlighter";
