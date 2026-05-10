import * as React from 'react';
import { jsx } from 'react/jsx-runtime';

// src/katex/index.tsx
var katexPromise = null;
async function getKatex() {
  if (!katexPromise) katexPromise = import('katex');
  return katexPromise;
}
var katexInlinePlugin = {
  name: "math",
  triggers: "$",
  match(text, pos) {
    if (text[pos] !== "$") return null;
    if (text[pos + 1] === "$") return null;
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
          token: { type: "math", content: inner }
        };
      }
      i++;
    }
    return null;
  },
  render(token) {
    return /* @__PURE__ */ jsx(KatexInline, { tex: token.content });
  }
};
var katexBlockPlugin = {
  name: "math",
  openMatch(line) {
    if (line.trim() === "$$") {
      return { type: "math", content: "", meta: { pluginName: "math" } };
    }
    const m = line.match(/^\$\$(.+?)\$\$\s*$/);
    if (m) {
      return {
        type: "math",
        content: m[1].trim(),
        meta: { pluginName: "math" },
        closeImmediately: true
      };
    }
    return null;
  },
  isClose(line) {
    return line.trim() === "$$";
  },
  render(block) {
    return /* @__PURE__ */ jsx(KatexBlock, { tex: block.content });
  }
};
function KatexInline({ tex }) {
  const [html, setHtml] = React.useState(null);
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
    return /* @__PURE__ */ jsx("code", { className: "smd-inline-code smd-math-fallback", children: tex });
  }
  return /* @__PURE__ */ jsx("span", { className: "smd-math smd-math-inline", dangerouslySetInnerHTML: { __html: html } });
}
function KatexBlock({ tex }) {
  const [html, setHtml] = React.useState(null);
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
    return /* @__PURE__ */ jsx("pre", { className: "smd-pre smd-math-fallback", children: tex });
  }
  return /* @__PURE__ */ jsx("div", { className: "smd-math smd-math-block", dangerouslySetInnerHTML: { __html: html } });
}

export { katexBlockPlugin, katexInlinePlugin };
//# sourceMappingURL=katex.js.map
//# sourceMappingURL=katex.js.map