import * as React from 'react';
import { jsx } from 'react/jsx-runtime';

// src/mermaid/index.tsx
var mermaidPromise = null;
async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      try {
        m.default.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "default"
        });
      } catch {
      }
      return m;
    });
  }
  return mermaidPromise;
}
var idCounter = 0;
var mermaidBlockPlugin = {
  name: "mermaid",
  openMatch(line) {
    const m = line.match(/^( {0,3})(`{3,}|~{3,})\s*mermaid\s*$/i);
    if (!m) return null;
    return {
      type: "custom",
      content: "",
      meta: { pluginName: "mermaid", language: "mermaid" }
    };
  },
  isClose(line) {
    return /^( {0,3})(`{3,}|~{3,})\s*$/.test(line);
  },
  transformLine(line) {
    return line;
  },
  render(block) {
    return /* @__PURE__ */ jsx(MermaidDiagram, { source: block.content, closed: block.closed });
  }
};
function MermaidDiagram({
  source,
  closed
}) {
  const [svg, setSvg] = React.useState(null);
  const [error, setError] = React.useState(null);
  const idRef = React.useRef(`smd-mermaid-${++idCounter}`);
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
    return /* @__PURE__ */ jsx("pre", { className: "smd-pre smd-mermaid-streaming", children: /* @__PURE__ */ jsx("code", { className: "smd-code language-mermaid", children: source }) });
  }
  if (error) {
    return /* @__PURE__ */ jsx("pre", { className: "smd-pre smd-mermaid-error", title: error, children: /* @__PURE__ */ jsx("code", { children: source }) });
  }
  if (svg === null) {
    return /* @__PURE__ */ jsx("div", { className: "smd-mermaid-loading", children: "Rendering diagram\u2026" });
  }
  return /* @__PURE__ */ jsx("div", { className: "smd-mermaid", dangerouslySetInnerHTML: { __html: svg } });
}

export { mermaidBlockPlugin };
//# sourceMappingURL=mermaid.js.map
//# sourceMappingURL=mermaid.js.map