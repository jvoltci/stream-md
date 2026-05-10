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

import * as React from "react";
import type { BlockPlugin } from "../parser/types";

let mermaidPromise: Promise<typeof import("mermaid")> | null = null;

async function getMermaid(): Promise<typeof import("mermaid")> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((m) => {
      // Initialize once.
      try {
        m.default.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "default",
        });
      } catch {
        /* already initialized */
      }
      return m;
    });
  }
  return mermaidPromise;
}

let idCounter = 0;

/**
 * Block plugin: matches ` ```mermaid ` opening fence. The standard
 * code-fence parser closes it on ` ``` ` automatically.
 *
 * Note: this plugin only fires when the parser sees the opening line as a
 * fresh block. The default code-fence rule will produce a `code` block
 * with language="mermaid"; this plugin upgrades it to a `custom` block
 * with our renderer attached.
 */
export const mermaidBlockPlugin: BlockPlugin = {
  name: "mermaid",
  openMatch(line) {
    const m = line.match(/^( {0,3})(`{3,}|~{3,})\s*mermaid\s*$/i);
    if (!m) return null;
    return {
      type: "custom",
      content: "",
      meta: { pluginName: "mermaid", language: "mermaid" },
    };
  },
  isClose(line) {
    return /^( {0,3})(`{3,}|~{3,})\s*$/.test(line);
  },
  transformLine(line) {
    return line;
  },
  render(block) {
    return <MermaidDiagram source={block.content} closed={block.closed} />;
  },
};

function MermaidDiagram({
  source,
  closed,
}: {
  source: string;
  closed: boolean;
}): React.JSX.Element {
  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const idRef = React.useRef<string>(`smd-mermaid-${++idCounter}`);

  React.useEffect(() => {
    if (!closed) return;
    let cancelled = false;
    void getMermaid().then(async (mod) => {
      if (cancelled) return;
      try {
        const { svg: out } = await mod.default.render(idRef.current, source);
        if (!cancelled) setSvg(out);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source, closed]);

  if (!closed) {
    return (
      <pre className="smd-pre smd-mermaid-streaming">
        <code className="smd-code language-mermaid">{source}</code>
      </pre>
    );
  }
  if (error) {
    return (
      <pre className="smd-pre smd-mermaid-error" title={error}>
        <code>{source}</code>
      </pre>
    );
  }
  if (svg === null) {
    return <div className="smd-mermaid-loading">Rendering diagram…</div>;
  }
  return (
    <div className="smd-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
