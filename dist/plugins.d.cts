import { c as BlockPlugin, I as InlinePlugin, j as InlineToken, B as Block } from './types-CrKOFMtQ.cjs';
export { b as BlockMeta, d as BlockPluginOpenResult, i as InlinePluginMatchResult, k as InlineTokenType } from './types-CrKOFMtQ.cjs';
import 'react';

/**
 * stream-md/plugins — public plugin API.
 *
 * Plugins extend the parser with custom block types and inline tokens.
 * The built-in block/inline rules use the same data shape, so plugins
 * are first-class citizens (not "second-class" overlays).
 *
 * Block plugins:
 *   - `openMatch(line)` returns `{ type, content?, meta?, closeImmediately? }`
 *     when the line should start a new block of this plugin's type.
 *   - `isClose(line, content)` (optional) decides when the block should close.
 *     If absent, blank-line-closes-block applies.
 *   - `render(block)` is the React renderer (only used by the React entry).
 *
 * Inline plugins:
 *   - `triggers` (optional) is a string of leading characters that *might*
 *     trigger this plugin — used as a perf hint.
 *   - `match(text, pos)` returns `{ consumed, token }` or null.
 *   - `render(token)` (optional) is the React renderer.
 */

/** Compose multiple plugin sets into a single set. */
declare function composePlugins<T extends BlockPlugin | InlinePlugin>(...sets: Array<readonly T[] | undefined>): T[];
/**
 * Tiny helper for building inline plugins that match a fixed delimiter
 * (e.g. `$...$` for math). Handles backslash-escapes inside the delimiter.
 */
declare function delimitedInlinePlugin(opts: {
    name: string;
    open: string;
    close: string;
    tokenType: InlineToken["type"];
    triggers?: string;
    /** If true, escaping is handled (`\$` inside math). */
    allowEscapes?: boolean;
}): InlinePlugin;
/**
 * Tiny helper for building block plugins that match a fenced block of the
 * form `OPENER ... CLOSER` (e.g. ```mermaid).
 */
declare function fencedBlockPlugin(opts: {
    name: string;
    /** Regex matched against a single line to detect open. */
    openLine: RegExp;
    /** Regex matched against a line to detect close (default: blank line). */
    closeLine?: RegExp;
    blockType?: Block["type"];
    metaFromOpen?: (m: RegExpMatchArray) => Block["meta"];
    render: (block: Block) => unknown;
}): BlockPlugin;

export { Block, BlockPlugin, InlinePlugin, InlineToken, composePlugins, delimitedInlinePlugin, fencedBlockPlugin };
