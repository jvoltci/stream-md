export { S as StreamParser } from './StreamParser-BmMwTynp.js';
import { I as InlinePlugin, j as InlineToken } from './types-CrKOFMtQ.js';
export { B as Block, b as BlockMeta, e as BlockType, D as DEFAULT_LIMITS, k as InlineTokenType, L as Limits, P as ParseResult, S as StreamMDOptions, o as clampText } from './types-CrKOFMtQ.js';
import 'react';

/**
 * Inline markdown parser.
 *
 * Handles **bold**, *italic*, ***bolditalic***, `code`, [text](url),
 * ![alt](url), ~~strike~~, hard breaks, and a tentative-close mode for
 * unclosed runs at the trailing edge of the stream (so `**bo` renders as
 * partially-bold rather than as raw asterisks, eliminating flicker when
 * the closing `**` arrives).
 *
 * Recursion is hard-capped to defend against adversarial input; URLs are
 * sanitized via `core/sanitize`.
 */

interface ParseInlineOptions {
    /** Recursion depth (internal). */
    depth?: number;
    /** Max recursion depth. */
    maxDepth?: number;
    /** Treat trailing unclosed runs as tentative tokens (default true). */
    tentative?: boolean;
    /** Inline plugins (math, custom triggers). */
    plugins?: InlinePlugin[];
}
declare function parseInline(text: string, options?: ParseInlineOptions): InlineToken[];

/**
 * Lightweight regex-based syntax highlighter (~3kB).
 *
 * Trades absolute correctness for tiny bundle size. For production-grade
 * highlighting, opt into the Shiki adapter via `stream-md/shiki`.
 *
 * Design notes:
 * - `Set`-based keyword/builtin lookup (O(1) per word).
 * - Keywords are suppressed after `.` so `obj.return` stays plain.
 * - Per-line tokenization, but multi-line strings (Python `"""…"""`,
 *   JS template literals, JSDoc comments) are detected before line split.
 */
interface HighlightToken {
    text: string;
    className: string;
}
/** Highlight a code string for a given language. */
declare function highlight(code: string, language: string): HighlightToken[];

/** Highlight a unified-diff. */
declare function highlightDiff(code: string): HighlightToken[];

/**
 * URL sanitization. LLM output is untrusted; default-deny dangerous schemes.
 *
 * Returns the original URL if safe, or `null` if it should be neutralized
 * (callers render the link/image as plain text).
 */
interface SanitizeUrlOptions {
    /** Allow `data:image/...;base64,...` URIs (default: true). Other `data:` schemes are always denied. */
    allowDataImages?: boolean;
    /** Custom protocol allowlist. If provided, replaces the default. */
    allowedProtocols?: string[];
}
declare function sanitizeUrl(href: string | undefined | null, options?: SanitizeUrlOptions): string | null;
/**
 * For images we restrict more aggressively: only `http`, `https`, and (optionally)
 * `data:image/...`. No `mailto:` etc.
 */
declare function sanitizeImageUrl(href: string | undefined | null, options?: SanitizeUrlOptions): string | null;

export { type HighlightToken, InlineToken, type SanitizeUrlOptions, highlight, highlightDiff, parseInline, sanitizeImageUrl, sanitizeUrl };
