import { c as BlockPlugin } from './types-CrKOFMtQ.js';
import 'react';

/**
 * stream-md/mermaid — Mermaid diagram rendering (lazy).
 *
 * Detects ` ```mermaid ` fenced blocks and renders them with Mermaid once
 * the block has closed. Mermaid is an *optional* peer dependency.
 *
 * @example
 * ```tsx
 * import { StreamMD } from 'stream-md';
 * import { mermaidBlockPlugin } from 'stream-md/mermaid';
 *
 * <StreamMD text={text} blockPlugins={[mermaidBlockPlugin]} />
 * ```
 *
 * Mermaid blocks won't render until they're complete — streaming partial
 * diagrams would just show parse errors.
 */

/**
 * Block plugin: matches ` ```mermaid ` opening fence. The standard
 * code-fence parser closes it on ` ``` ` automatically.
 *
 * Note: this plugin only fires when the parser sees the opening line as a
 * fresh block. The default code-fence rule will produce a `code` block
 * with language="mermaid"; this plugin upgrades it to a `custom` block
 * with our renderer attached.
 */
declare const mermaidBlockPlugin: BlockPlugin;

export { mermaidBlockPlugin };
