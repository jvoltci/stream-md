// src/plugins/index.ts
function composePlugins(...sets) {
  const out = [];
  for (const s of sets) if (s) out.push(...s);
  return out;
}
function delimitedInlinePlugin(opts) {
  const plugin = {
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
            token: { type: opts.tokenType, content: inner }
          };
        }
        if (text[i] === "\n") return null;
        i++;
      }
      return null;
    }
  };
  if (opts.triggers !== void 0) plugin.triggers = opts.triggers;
  return plugin;
}
function fencedBlockPlugin(opts) {
  return {
    name: opts.name,
    openMatch(line) {
      const m = line.match(opts.openLine);
      if (!m) return null;
      return {
        type: opts.blockType ?? "custom",
        content: "",
        meta: { pluginName: opts.name, ...opts.metaFromOpen?.(m) ?? {} }
      };
    },
    isClose(line) {
      const re = opts.closeLine;
      return re ? re.test(line) : line.trim() === "";
    },
    render: opts.render
  };
}

export { composePlugins, delimitedInlinePlugin, fencedBlockPlugin };
//# sourceMappingURL=plugins.js.map
//# sourceMappingURL=plugins.js.map