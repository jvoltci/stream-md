import { H as HighlighterFn } from './types-CrKOFMtQ.js';
import 'react';

/**
 * stream-md/shiki — Shiki-backed syntax highlighter (lazy).
 *
 * Shiki uses TextMate grammars + VS Code themes for production-grade syntax
 * highlighting. Required as an *optional* peer dependency (zero cost if
 * not imported).
 *
 * @example
 * ```tsx
 * import { StreamMD } from 'stream-md';
 * import { createShikiHighlighter } from 'stream-md/shiki';
 *
 * const highlighter = await createShikiHighlighter({
 *   theme: 'github-dark',
 *   langs: ['ts', 'tsx', 'python', 'rust'],
 * });
 *
 * <StreamMD text={text} highlighter={highlighter} />
 * ```
 */

interface ShikiHighlighterOptions {
    /** Theme name or theme object. */
    theme?: string;
    /** Languages to load up-front. Others are lazy-loaded on first use. */
    langs?: string[];
}
/**
 * Create a Shiki-backed highlighter. Returns an async function compatible
 * with `<StreamMD highlighter={...} />`.
 *
 * Note: highlighter is async at create time, but synchronous when called
 * from the component (uses cached results).
 */
declare function createShikiHighlighter(options?: ShikiHighlighterOptions): Promise<HighlighterFn>;

export { type ShikiHighlighterOptions, createShikiHighlighter };
