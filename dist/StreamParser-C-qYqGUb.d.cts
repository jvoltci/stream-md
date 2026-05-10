import { S as StreamMDOptions, c as BlockPlugin, P as ParseResult, B as Block } from './types-CrKOFMtQ.cjs';

/**
 * Streaming markdown block parser.
 *
 * Accepts the full accumulated text on each `push()`, diffs internally,
 * and produces a `Block[]` AST plus the index of the currently active
 * (still-streaming) block. Closed blocks are immutable so React can
 * memoize them safely.
 *
 * Supports: ATX + setext headings, paragraphs, fenced + indented code,
 * blockquotes, ordered/unordered/task lists with nesting, GFM tables
 * (committed only on separator-row), thematic breaks, horizontal rules,
 * hard limits, and prefix-change detection (auto-reset when the input
 * is no longer a prefix of what was last seen).
 */

interface ParserOptions extends StreamMDOptions {
    blockPlugins?: BlockPlugin[];
}
declare class StreamParser {
    private blocks;
    private prevText;
    private inCodeFence;
    private codeFenceChar;
    private codeFenceCount;
    private codeFenceIndent;
    private incompleteLine;
    private blockId;
    private limits;
    private opts;
    constructor(options?: ParserOptions);
    /**
     * Push the full accumulated text. The parser internally diffs against
     * the previous push to process only new content. If the new text is
     * not a prefix of the previous text (e.g. consumer cleared / replaced
     * the buffer), the parser resets and reparses from scratch.
     */
    push(fullText: string): ParseResult;
    /** Get the current incomplete trailing line (for streaming display). */
    getIncompleteLine(): string;
    /** Reset all state. */
    reset(): void;
    /** Get current blocks. */
    getBlocks(): Block[];
    private nextId;
    private getActive;
    private closeActive;
    private startBlock;
    /**
     * Cache parsed structure (e.g. table cells, list items) on close so
     * components don't re-parse on every render.
     */
    private cacheParsed;
    private processLine;
    private isClosingFence;
}

export { StreamParser as S };
