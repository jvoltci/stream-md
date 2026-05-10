import { c as BlockPlugin, I as InlinePlugin } from './types-CrKOFMtQ.cjs';
import 'react';

/**
 * stream-md/katex — math rendering via KaTeX (lazy).
 *
 * Provides:
 *  - `katexInlinePlugin`: detects `$...$` inline math
 *  - `katexBlockPlugin`:  detects `$$...$$` block math
 *
 * Both render using KaTeX once the inner content is closed (so streaming
 * partial LaTeX doesn't trigger broken renders).
 *
 * KaTeX is an *optional* peer dependency — install it to enable.
 *
 * @example
 * ```tsx
 * import 'katex/dist/katex.min.css';
 * import { StreamMD } from 'stream-md';
 * import { katexInlinePlugin, katexBlockPlugin } from 'stream-md/katex';
 *
 * <StreamMD
 *   text={text}
 *   inlinePlugins={[katexInlinePlugin]}
 *   blockPlugins={[katexBlockPlugin]}
 * />
 * ```
 */

/** Inline `$...$` math. */
declare const katexInlinePlugin: InlinePlugin;
/** Block `$$...$$` math. */
declare const katexBlockPlugin: BlockPlugin;

export { katexBlockPlugin, katexInlinePlugin };
