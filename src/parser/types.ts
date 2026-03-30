// ═══════════════════════════════════════════════════════════════
// StreamMD — Parser Types
// ═══════════════════════════════════════════════════════════════

export type BlockType =
  | "heading"
  | "paragraph"
  | "code"
  | "list"
  | "table"
  | "blockquote"
  | "hr"
  | "html";

export type InlineTokenType =
  | "text"
  | "bold"
  | "italic"
  | "bolditalic"
  | "code"
  | "link"
  | "strikethrough"
  | "image";

export interface BlockMeta {
  /** Heading level (1-6) */
  level?: number;
  /** Code block language */
  language?: string;
  /** List type */
  ordered?: boolean;
  /** Table column alignments */
  alignments?: ("left" | "center" | "right" | "none")[];
}

export interface Block {
  /** Stable ID for React key */
  id: string;
  /** Block type */
  type: BlockType;
  /** Raw content of this block */
  content: string;
  /** Whether the block is "closed" (no more tokens will be appended) */
  closed: boolean;
  /** Block-specific metadata */
  meta: BlockMeta;
}

export interface InlineToken {
  type: InlineTokenType;
  content: string;
  href?: string;
  alt?: string;
  children?: InlineToken[];
}

export interface ParseResult {
  /** All blocks (completed + active) */
  blocks: Block[];
  /** Index of the currently streaming block (-1 if none) */
  activeIndex: number;
}

export interface StreamMDOptions {
  /** Called when a block is finalized */
  onBlockComplete?: (block: Block) => void;
}

export interface StreamMDProps {
  /** The current streamed markdown text (grows over time) */
  text: string;
  /** Additional CSS class */
  className?: string;
  /** Theme preset */
  theme?: "dark" | "light" | "none";
  /** Custom component overrides */
  components?: Partial<ComponentOverrides>;
  /** Called when a block is finalized */
  onBlockComplete?: (block: Block) => void;
}

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
  alignments: ("left" | "center" | "right" | "none")[];
}

export interface LinkProps {
  href: string;
  children: React.ReactNode;
}

export interface InlineCodeProps {
  children: React.ReactNode;
}

export interface ImageProps {
  src: string;
  alt: string;
}
