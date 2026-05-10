'use strict';

var React = require('react');
var jsxRuntime = require('react/jsx-runtime');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var React__namespace = /*#__PURE__*/_interopNamespace(React);

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
    return /* @__PURE__ */ jsxRuntime.jsx(KatexInline, { tex: token.content });
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
    return /* @__PURE__ */ jsxRuntime.jsx(KatexBlock, { tex: block.content });
  }
};
function KatexInline({ tex }) {
  const [html, setHtml] = React__namespace.useState(null);
  React__namespace.useEffect(() => {
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
    return /* @__PURE__ */ jsxRuntime.jsx("code", { className: "smd-inline-code smd-math-fallback", children: tex });
  }
  return /* @__PURE__ */ jsxRuntime.jsx("span", { className: "smd-math smd-math-inline", dangerouslySetInnerHTML: { __html: html } });
}
function KatexBlock({ tex }) {
  const [html, setHtml] = React__namespace.useState(null);
  React__namespace.useEffect(() => {
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
    return /* @__PURE__ */ jsxRuntime.jsx("pre", { className: "smd-pre smd-math-fallback", children: tex });
  }
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "smd-math smd-math-block", dangerouslySetInnerHTML: { __html: html } });
}

exports.katexBlockPlugin = katexBlockPlugin;
exports.katexInlinePlugin = katexInlinePlugin;
//# sourceMappingURL=katex.cjs.map
//# sourceMappingURL=katex.cjs.map