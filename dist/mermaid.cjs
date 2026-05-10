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
    return /* @__PURE__ */ jsxRuntime.jsx(MermaidDiagram, { source: block.content, closed: block.closed });
  }
};
function MermaidDiagram({
  source,
  closed
}) {
  const [svg, setSvg] = React__namespace.useState(null);
  const [error, setError] = React__namespace.useState(null);
  const idRef = React__namespace.useRef(`smd-mermaid-${++idCounter}`);
  React__namespace.useEffect(() => {
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
    return /* @__PURE__ */ jsxRuntime.jsx("pre", { className: "smd-pre smd-mermaid-streaming", children: /* @__PURE__ */ jsxRuntime.jsx("code", { className: "smd-code language-mermaid", children: source }) });
  }
  if (error) {
    return /* @__PURE__ */ jsxRuntime.jsx("pre", { className: "smd-pre smd-mermaid-error", title: error, children: /* @__PURE__ */ jsxRuntime.jsx("code", { children: source }) });
  }
  if (svg === null) {
    return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "smd-mermaid-loading", children: "Rendering diagram\u2026" });
  }
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "smd-mermaid", dangerouslySetInnerHTML: { __html: svg } });
}

exports.mermaidBlockPlugin = mermaidBlockPlugin;
//# sourceMappingURL=mermaid.cjs.map
//# sourceMappingURL=mermaid.cjs.map