/**
 * stream-md — parser types.
 *
 * Block + inline AST shared by parser, components, plugins, and adapters.
 * Plain data only — `Block[]` is JSON-serializable so it can cross the
 * RSC boundary or be cached.
 */

import type * as React from "react";

export type BlockType =
  | "heading"
  | "paragraph"
  | "code"
  | "list"
  | "table"
  | "blockquote"
  | "hr"
  | "html"
  | "math"
  | "custom";

export type InlineTokenType =
  | "text"
  | "bold"
  | "italic"
  | "bolditalic"
  | "code"
  | "link"
  | "strikethrough"
  | "image"
  | "math"
  | "br";

export interface BlockMeta {
  /** Heading level (1-6). */
  level?: number;
  /** Code-block info-string language (e.g. "ts", "python"). */
  language?: string;
  /** Code-block additional attributes after the language (e.g. `title="x.py"`). */
  attributes?: string;
  /** True for ordered lists. */
  ordered?: boolean;
  /** Starting number for ordered lists (1 by default). */
  start?: number;
  /** List item indent (spaces from line start, used for nesting). */
  indent?: number;
  /** Table column alignments. */
  alignments?: Array<"left" | "center" | "right" | "none">;
  /** For `custom` block plugins, the plugin name. */
  pluginName?: string;
  /** Plugin-specific arbitrary data. */
  pluginData?: unknown;
  /** Cached parsed structure (e.g. table cells, list items). Set on close. */
  parsed?: unknown;
}

export interface Block {
  /** Stable ID for React key. Monotonically increasing per parser. */
  id: string;
  /** Block type. */
  type: BlockType;
  /** Raw content of this block (lines joined with \n). */
  content: string;
  /** Whether the block is "closed" (no more tokens will be appended). */
  closed: boolean;
  /** Block-specific metadata. */
  meta: BlockMeta;
}

export interface InlineToken {
  type: InlineTokenType;
  content: string;
  href?: string;
  alt?: string;
  title?: string;
  children?: InlineToken[];
  /**
   * True when the token is a speculative-close: the run hasn't been closed
   * yet (e.g. `**bol` waiting for `**`). The renderer can mark such tokens
   * with a CSS class so consumers can style them differently.
   */
  tentative?: boolean;
}

export interface ParseResult {
  /** All blocks (completed + active). */
  blocks: Block[];
  /** Index of the currently streaming block (-1 if none). */
  activeIndex: number;
}

export interface StreamMDOptions {
  /** Called when a block is finalized. */
  onBlockComplete?: (block: Block) => void;
  /** Override default limits. */
  limits?: Partial<import("../core/limits").Limits>;
  /** Allow raw HTML blocks (default: false — output is treated as text). */
  allowHtml?: boolean;
}

// ── React layer ──

export interface StreamMDProps {
  /** The current streamed markdown text (grows over time). */
  text: string;
  /** Additional CSS class. */
  className?: string;
  /** Theme preset. */
  theme?: "dark" | "light" | "none";
  /** Custom component overrides. */
  components?: Partial<ComponentOverrides>;
  /** Called when a block is finalized. */
  onBlockComplete?: (block: Block) => void;
  /** Override default limits. */
  limits?: Partial<import("../core/limits").Limits>;
  /** Custom highlighter (defaults to built-in). See `stream-md/shiki`. */
  highlighter?: HighlighterFn;
  /** Block plugins (custom block types). */
  blockPlugins?: BlockPlugin[];
  /** Inline plugins (custom inline tokens). */
  inlinePlugins?: InlinePlugin[];
  /** Show a blinking cursor on the active block (default true). */
  showCursor?: boolean;
}

export type HighlighterFn = (
  code: string,
  language: string,
) => Array<{ text: string; className: string }>;

export interface ComponentOverrides {
  h1: React.ComponentType<BlockComponentProps>;
  h2: React.ComponentType<BlockComponentProps>;
  h3: React.ComponentType<BlockComponentProps>;
  h4: React.ComponentType<BlockComponentProps>;
  h5: React.ComponentType<BlockComponentProps>;
  h6: React.ComponentType<BlockComponentProps>;
  p: React.ComponentType<BlockComponentProps>;
  pre: React.ComponentType<CodeBlockProps>;
  ul: React.ComponentType<ListBlockProps>;
  ol: React.ComponentType<ListBlockProps>;
  blockquote: React.ComponentType<BlockComponentProps>;
  table: React.ComponentType<TableBlockProps>;
  hr: React.ComponentType<Record<string, never>>;
  a: React.ComponentType<LinkProps>;
  code: React.ComponentType<InlineCodeProps>;
  strong: React.ComponentType<{ children: React.ReactNode }>;
  em: React.ComponentType<{ children: React.ReactNode }>;
  del: React.ComponentType<{ children: React.ReactNode }>;
  img: React.ComponentType<ImageProps>;
}

export interface BlockComponentProps {
  block: Block;
  children: React.ReactNode;
}

export interface CodeBlockProps {
  block: Block;
  language: string;
  code: string;
  /** True while the block is still streaming. */
  streaming: boolean;
}

export interface ListBlockProps {
  block: Block;
  ordered: boolean;
  children: React.ReactNode;
}

export interface TableBlockProps {
  block: Block;
  headers: string[];
  rows: string[][];
  alignments: Array<"left" | "center" | "right" | "none">;
}

export interface LinkProps {
  href: string;
  title?: string;
  children: React.ReactNode;
}

export interface InlineCodeProps {
  children: React.ReactNode;
}

export interface ImageProps {
  src: string;
  alt: string;
  title?: string;
}

// ── Plugin API ──

export interface BlockPluginOpenResult {
  type: BlockType;
  /** Initial content (often empty). */
  content?: string;
  meta?: BlockMeta;
  /** True if this single line completes the block. */
  closeImmediately?: boolean;
}

export interface BlockPlugin {
  name: string;
  /** Match the start of a new block. Returns null if not matched. */
  openMatch(line: string): BlockPluginOpenResult | null;
  /** Optional: detect closure on subsequent lines (defaults to blank-line). */
  isClose?(line: string, content: string): boolean;
  /** Optional: transform appended line before storing. Defaults to `line`. */
  transformLine?(line: string): string;
  /** Renderer for this block (only used by React entry). */
  render: (block: Block) => React.ReactNode;
}

export interface InlinePluginMatchResult {
  consumed: number;
  token: InlineToken;
}

export interface InlinePlugin {
  name: string;
  /** Char(s) at `text[pos]` that *might* trigger this plugin (perf hint). */
  triggers?: string;
  match(text: string, pos: number): InlinePluginMatchResult | null;
  render?: (token: InlineToken) => React.ReactNode;
}
