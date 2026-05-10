// src/shiki/index.ts
async function createShikiHighlighter(options = {}) {
  const theme = options.theme ?? "github-dark";
  const langs = options.langs ?? ["javascript", "typescript", "tsx", "python", "rust", "go", "bash", "json"];
  const shiki = await import('shiki');
  const factory = shiki.createHighlighter ?? shiki.getHighlighter;
  if (!factory) throw new Error("[stream-md/shiki] No createHighlighter/getHighlighter export found");
  const highlighter = await factory({
    themes: [theme],
    langs
  });
  const cache = /* @__PURE__ */ new Map();
  return (code, language) => {
    const key = `${language}\0${code}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const lang = language || "text";
    if (!highlighter.getLoadedLanguages().includes(lang)) {
      void highlighter.loadLanguage(lang).catch(() => void 0);
      return [{ text: code, className: "" }];
    }
    let result;
    try {
      result = highlighter.codeToTokens(code, { lang, theme });
    } catch {
      return [{ text: code, className: "" }];
    }
    const tokens = [];
    result.tokens.forEach((line, li) => {
      for (const t of line) {
        const cls = t.color ? `smd-shiki ${colorToClass(t.color)}` : "";
        tokens.push({ text: t.content, className: cls });
      }
      if (li < result.tokens.length - 1) tokens.push({ text: "\n", className: "" });
    });
    cache.set(key, tokens);
    return tokens;
  };
}
function colorToClass(color) {
  return "smd-c-" + color.replace(/[^a-zA-Z0-9]/g, "");
}

export { createShikiHighlighter };
//# sourceMappingURL=shiki.js.map
//# sourceMappingURL=shiki.js.map