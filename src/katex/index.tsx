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

import * as React from "react";
import type { BlockPlugin, InlinePlugin } from "../parser/types";

let katexPromise: Promise<typeof import("katex")> | null = null;

async function getKatex(): Promise<typeof import("katex")> {
  if (!katexPromise) katexPromise = import("katex");
  return katexPromise;
}

/** Inline `$...$` math. */
export const katexInlinePlugin: InlinePlugin = {
  name: "math",
  triggers: "$",
  match(text, pos) {
    if (text[pos] !== "$") return null;
    // Skip `$$` — that's a block, handled by katexBlockPlugin.
    if (text[pos + 1] === "$") return null;
    // Find a closing `$` that isn't escaped, on the same line.
    let i = pos + 1;
    while (i < text.length) {
      if (text[i] === "\\" && i + 1 < text.length) {
        i += 2;
        continue;
      }
      if (text[i] === "\n") return null;
      if (text[i] === "$") {
        const inner = text.slice(pos + 1, i).trim();
        if (!inner) return null;
        return {
          consumed: i + 1 - pos,
          token: { type: "math", content: inner },
        };
      }
      i++;
    }
    return null;
  },
  render(token) {
    return <KatexInline tex={token.content} />;
  },
};

/** Block `$$...$$` math. */
export const katexBlockPlugin: BlockPlugin = {
  name: "math",
  openMatch(line) {
    if (line.trim() === "$$") {
      // Open a math block; closes on next `$$` line.
      return { type: "math", content: "", meta: { pluginName: "math" } };
    }
    // Single-line `$$ ... $$`
    const m = line.match(/^\$\$(.+?)\$\$\s*$/);
    if (m) {
      return {
        type: "math",
        content: m[1]!.trim(),
        meta: { pluginName: "math" },
        closeImmediately: true,
      };
    }
    return null;
  },
  isClose(line) {
    return line.trim() === "$$";
  },
  render(block) {
    return <KatexBlock tex={block.content} />;
  },
};

function KatexInline({ tex }: { tex: string }): React.JSX.Element {
  const [html, setHtml] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void getKatex().then((mod) => {
      if (cancelled) return;
      try {
        const out = mod.default.renderToString(tex, { throwOnError: false, displayMode: false });
        setHtml(out);
      } catch {
        setHtml(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tex]);
  if (html === null) {
    return <code className="smd-inline-code smd-math-fallback">{tex}</code>;
  }
  return <span className="smd-math smd-math-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}

function KatexBlock({ tex }: { tex: string }): React.JSX.Element {
  const [html, setHtml] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void getKatex().then((mod) => {
      if (cancelled) return;
      try {
        const out = mod.default.renderToString(tex, { throwOnError: false, displayMode: true });
        setHtml(out);
      } catch {
        setHtml(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tex]);
  if (html === null) {
    return <pre className="smd-pre smd-math-fallback">{tex}</pre>;
  }
  return <div className="smd-math smd-math-block" dangerouslySetInnerHTML={{ __html: html }} />;
}
