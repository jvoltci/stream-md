import React$1 from 'react';

type BlockType = "heading" | "paragraph" | "code" | "list" | "table" | "blockquote" | "hr" | "html";
type InlineTokenType = "text" | "bold" | "italic" | "bolditalic" | "code" | "link" | "strikethrough" | "image";
interface BlockMeta {
    /** Heading level (1-6) */
    level?: number;
    /** Code block language */
    language?: string;
    /** List type */
    ordered?: boolean;
    /** Table column alignments */
    alignments?: ("left" | "center" | "right" | "none")[];
}
interface Block {
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
interface InlineToken {
    type: InlineTokenType;
    content: string;
    href?: string;
    alt?: string;
    children?: InlineToken[];
}
interface ParseResult {
    /** All blocks (completed + active) */
    blocks: Block[];
    /** Index of the currently streaming block (-1 if none) */
    activeIndex: number;
}
interface StreamMDOptions {
    /** Called when a block is finalized */
    onBlockComplete?: (block: Block) => void;
}
interface StreamMDProps {
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
interface ComponentOverrides {
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
    strong: React.ComponentType<{
        children: React.ReactNode;
    }>;
    em: React.ComponentType<{
        children: React.ReactNode;
    }>;
    del: React.ComponentType<{
        children: React.ReactNode;
    }>;
    img: React.ComponentType<ImageProps>;
}
interface BlockComponentProps {
    block: Block;
    children: React.ReactNode;
}
interface CodeBlockProps {
    block: Block;
    language: string;
    code: string;
}
interface ListBlockProps {
    block: Block;
    ordered: boolean;
    children: React.ReactNode;
}
interface TableBlockProps {
    block: Block;
    headers: string[];
    rows: string[][];
    alignments: ("left" | "center" | "right" | "none")[];
}
interface LinkProps {
    href: string;
    children: React.ReactNode;
}
interface InlineCodeProps {
    children: React.ReactNode;
}
interface ImageProps {
    src: string;
    alt: string;
}

/**
 * StreamMD — Streaming markdown renderer for LLM token streams.
 *
 * @example
 * ```tsx
 * const [text, setText] = useState('');
 *
 * // On each streaming token:
 * setText(prev => prev + token);
 *
 * return <StreamMD text={text} theme="dark" />;
 * ```
 *
 * @example With Vercel AI SDK:
 * ```tsx
 * const { messages } = useChat();
 * const lastMessage = messages[messages.length - 1];
 *
 * return lastMessage?.role === 'assistant'
 *   ? <StreamMD text={lastMessage.content} />
 *   : null;
 * ```
 */
declare function StreamMD({ text, className, theme, components, onBlockComplete, }: StreamMDProps): React$1.JSX.Element;

interface UseStreamMDReturn {
    /** All parsed blocks */
    blocks: Block[];
    /** Index of the currently active (streaming) block */
    activeIndex: number;
    /** The current incomplete line (not yet committed to a block) */
    incompleteLine: string;
    /** Push the full accumulated text (we diff internally) */
    push: (fullText: string) => void;
    /** Reset all parser state */
    reset: () => void;
}
/**
 * React hook for streaming markdown parsing.
 * Accepts the full accumulated text on each call to `push()`.
 * Internally diffs to only process new tokens.
 *
 * @example
 * ```tsx
 * const { blocks, activeIndex, incompleteLine, push, reset } = useStreamMD();
 *
 * useEffect(() => {
 *   const sse = new EventSource('/api/chat');
 *   let text = '';
 *   sse.onmessage = (e) => {
 *     text += e.data;
 *     push(text);
 *   };
 *   return () => sse.close();
 * }, [push]);
 * ```
 */
declare function useStreamMD(options?: StreamMDOptions): UseStreamMDReturn;

declare class StreamParser {
    private blocks;
    private buffer;
    private prevLength;
    private inCodeFence;
    private codeFenceChar;
    private codeFenceCount;
    private options;
    private _incompleteLine;
    private _blockId;
    private nextId;
    constructor(options?: StreamMDOptions);
    /**
     * Push new text. Accepts the FULL accumulated text each time
     * (not just the delta). Internally diffs to find new content.
     */
    push(fullText: string): ParseResult;
    /** Get the current incomplete line (not yet committed to a block) */
    getIncompleteLine(): string;
    /** Reset all state */
    reset(): void;
    /** Get current blocks */
    getBlocks(): Block[];
    private parseBuffer;
    private processLine;
    private isClosingFence;
    private getActiveBlock;
    private closeActiveBlock;
    private startBlock;
    /** Reset ID counter (for tests) */
    resetIdCounter(): void;
}

/**
 * Parse inline markdown tokens from raw text content.
 * Handles: **bold**, *italic*, `code`, [link](url),
 * ~~strikethrough~~, ![image](url)
 *
 * Gracefully handles partial/unclosed tokens by showing raw text.
 */
declare function parseInline(text: string): InlineToken[];

interface HighlightToken {
    text: string;
    className: string;
}
/**
 * Highlight a code string for a given language.
 * Returns an array of tokens with text + CSS class.
 */
declare function highlight(code: string, language: string): HighlightToken[];

export { type Block, type BlockComponentProps, type BlockMeta, type BlockType, type CodeBlockProps, type ComponentOverrides, type ImageProps, type InlineCodeProps, type InlineToken, type InlineTokenType, type LinkProps, type ListBlockProps, type ParseResult, StreamMD, type StreamMDOptions, type StreamMDProps, StreamParser, type TableBlockProps, highlight, parseInline, useStreamMD };
