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

export type {
  BlockPlugin,
  BlockPluginOpenResult,
  InlinePlugin,
  InlinePluginMatchResult,
  Block,
  BlockMeta,
  InlineToken,
  InlineTokenType,
} from "../parser/types";

import type {
  BlockPlugin,
  InlinePlugin,
  Block,
  InlineToken,
} from "../parser/types";

/** Compose multiple plugin sets into a single set. */
export function composePlugins<T extends BlockPlugin | InlinePlugin>(
  ...sets: Array<readonly T[] | undefined>
): T[] {
  const out: T[] = [];
  for (const s of sets) if (s) out.push(...s);
  return out;
}

/**
 * Tiny helper for building inline plugins that match a fixed delimiter
 * (e.g. `$...$` for math). Handles backslash-escapes inside the delimiter.
 */
export function delimitedInlinePlugin(opts: {
  name: string;
  open: string;
  close: string;
  tokenType: InlineToken["type"];
  triggers?: string;
  /** If true, escaping is handled (`\$` inside math). */
  allowEscapes?: boolean;
}): InlinePlugin {
  const plugin: InlinePlugin = {
    name: opts.name,
    match(text, pos) {
      if (!text.startsWith(opts.open, pos)) return null;
      const start = pos + opts.open.length;
      let i = start;
      while (i < text.length) {
        if (opts.allowEscapes && text[i] === "\\" && i + 1 < text.length) {
          i += 2;
          continue;
        }
        if (text.startsWith(opts.close, i)) {
          const inner = text.slice(start, i);
          return {
            consumed: i + opts.close.length - pos,
            token: { type: opts.tokenType, content: inner },
          };
        }
        if (text[i] === "\n") return null;
        i++;
      }
      return null;
    },
  };
  if (opts.triggers !== undefined) plugin.triggers = opts.triggers;
  return plugin;
}

/**
 * Tiny helper for building block plugins that match a fenced block of the
 * form `OPENER ... CLOSER` (e.g. ```mermaid).
 */
export function fencedBlockPlugin(opts: {
  name: string;
  /** Regex matched against a single line to detect open. */
  openLine: RegExp;
  /** Regex matched against a line to detect close (default: blank line). */
  closeLine?: RegExp;
  blockType?: Block["type"];
  metaFromOpen?: (m: RegExpMatchArray) => Block["meta"];
  render: (block: Block) => unknown;
}): BlockPlugin {
  return {
    name: opts.name,
    openMatch(line) {
      const m = line.match(opts.openLine);
      if (!m) return null;
      return {
        type: opts.blockType ?? "custom",
        content: "",
        meta: { pluginName: opts.name, ...(opts.metaFromOpen?.(m) ?? {}) },
      };
    },
    isClose(line) {
      const re = opts.closeLine;
      return re ? re.test(line) : line.trim() === "";
    },
    render: opts.render as BlockPlugin["render"],
  };
}
