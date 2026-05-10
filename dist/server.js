// src/core/limits.ts
var DEFAULT_LIMITS = {
  maxDocLength: 1e6,
  maxInlineDepth: 4,
  maxInlineTokens: 5e4,
  maxListDepth: 10,
  maxTableColumns: 100
};

// src/parser/StreamParser.ts
var StreamParser = class {
  constructor(options = {}) {
    this.blocks = [];
    this.prevText = "";
    this.inCodeFence = false;
    this.codeFenceChar = "";
    this.codeFenceCount = 0;
    this.codeFenceIndent = 0;
    this.incompleteLine = "";
    this.blockId = 0;
    this.opts = options;
    this.limits = { ...DEFAULT_LIMITS, ...options.limits ?? {} };
  }
  /**
   * Push the full accumulated text. The parser internally diffs against
   * the previous push to process only new content. If the new text is
   * not a prefix of the previous text (e.g. consumer cleared / replaced
   * the buffer), the parser resets and reparses from scratch.
   */
  push(fullText) {
    if (fullText.length > this.limits.maxDocLength) {
      fullText = fullText.slice(0, this.limits.maxDocLength);
    }
    if (fullText === this.prevText) {
      return {
        blocks: this.blocks,
        activeIndex: this.blocks.length > 0 ? this.blocks.length - 1 : -1
      };
    }
    const isPrefixGrow = fullText.length >= this.prevText.length && fullText.startsWith(this.prevText);
    if (!isPrefixGrow) {
      this.reset();
    }
    const startedAt = this.prevText.length;
    const newContent = fullText.slice(startedAt);
    this.prevText = fullText;
    const buffer = this.incompleteLine + newContent;
    const lines = buffer.split("\n");
    const lastIsIncomplete = !buffer.endsWith("\n");
    const popped = lines.pop();
    this.incompleteLine = lastIsIncomplete ? popped ?? "" : "";
    for (let li = 0; li < lines.length; li++) {
      this.processLine(lines[li], lines, li);
    }
    return {
      blocks: this.blocks,
      activeIndex: this.blocks.length > 0 ? this.blocks.length - 1 : -1
    };
  }
  /** Get the current incomplete trailing line (for streaming display). */
  getIncompleteLine() {
    return this.incompleteLine;
  }
  /** Reset all state. */
  reset() {
    this.blocks = [];
    this.prevText = "";
    this.inCodeFence = false;
    this.codeFenceChar = "";
    this.codeFenceCount = 0;
    this.codeFenceIndent = 0;
    this.incompleteLine = "";
  }
  /** Get current blocks. */
  getBlocks() {
    return this.blocks;
  }
  // ── Internals ──
  nextId() {
    return "smd-" + ++this.blockId;
  }
  getActive() {
    if (this.blocks.length === 0) return null;
    const last = this.blocks[this.blocks.length - 1];
    return last.closed ? null : last;
  }
  closeActive() {
    const a = this.getActive();
    if (a) {
      a.closed = true;
      this.cacheParsed(a);
      this.opts.onBlockComplete?.(a);
    }
  }
  startBlock(type, content, meta) {
    const block = {
      id: this.nextId(),
      type,
      content,
      closed: false,
      meta
    };
    this.blocks.push(block);
    return block;
  }
  /**
   * Cache parsed structure (e.g. table cells, list items) on close so
   * components don't re-parse on every render.
   */
  cacheParsed(block) {
    if (block.type === "table") {
      block.meta.parsed = parseTable(block.content);
    } else if (block.type === "list") {
      block.meta.parsed = parseListItems(block.content);
    }
  }
  processLine(line, allLines, idx) {
    if (this.inCodeFence) {
      const stripped = line.replace(/^ {0,3}/, "");
      if (this.isClosingFence(stripped)) {
        this.inCodeFence = false;
        this.closeActive();
        return;
      }
      const a2 = this.getActive();
      if (a2 && a2.type === "code") {
        const indented = line.replace(
          new RegExp(`^ {0,${this.codeFenceIndent}}`),
          ""
        );
        a2.content += (a2.content ? "\n" : "") + indented;
      }
      return;
    }
    if (this.opts.blockPlugins?.length) {
      for (const plugin of this.opts.blockPlugins) {
        const m = plugin.openMatch(line);
        if (m) {
          this.closeActive();
          const block = this.startBlock(m.type, m.content ?? "", {
            ...m.meta ?? {},
            pluginName: plugin.name
          });
          if (m.closeImmediately) {
            block.closed = true;
            this.cacheParsed(block);
            this.opts.onBlockComplete?.(block);
          }
          return;
        }
      }
    }
    if (line.trim() === "") {
      this.closeActive();
      return;
    }
    const fenceMatch = line.match(/^( {0,3})(`{3,}|~{3,})\s*([^`]*)$/);
    if (fenceMatch) {
      const fence = fenceMatch[2];
      if (fence.startsWith("`") && fenceMatch[3].includes("`")) ; else {
        this.closeActive();
        this.inCodeFence = true;
        this.codeFenceChar = fence[0];
        this.codeFenceCount = fence.length;
        this.codeFenceIndent = fenceMatch[1].length;
        const info = fenceMatch[3].trim();
        const spaceIdx = info.search(/\s/);
        const language = spaceIdx >= 0 ? info.slice(0, spaceIdx) : info;
        const attributes = spaceIdx >= 0 ? info.slice(spaceIdx + 1) : "";
        this.startBlock("code", "", {
          language,
          ...attributes ? { attributes } : {}
        });
        return;
      }
    }
    const atxMatch = line.match(/^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/);
    if (atxMatch) {
      this.closeActive();
      const level = atxMatch[1].length;
      const text = (atxMatch[2] ?? "").trim();
      const block = this.startBlock("heading", text, { level });
      block.closed = true;
      this.opts.onBlockComplete?.(block);
      return;
    }
    const setextMatch = line.match(/^ {0,3}(=+|-+)\s*$/);
    if (setextMatch) {
      const active = this.getActive();
      if (active && active.type === "paragraph" && !active.closed) {
        active.type = "heading";
        active.meta = { level: setextMatch[1].startsWith("=") ? 1 : 2 };
        active.closed = true;
        this.opts.onBlockComplete?.(active);
        return;
      }
    }
    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      this.closeActive();
      const block = this.startBlock("hr", "", {});
      block.closed = true;
      this.opts.onBlockComplete?.(block);
      return;
    }
    const bqMatch = line.match(/^ {0,3}>\s?(.*)$/);
    if (bqMatch) {
      const a2 = this.getActive();
      if (a2 && a2.type === "blockquote") {
        a2.content += "\n" + bqMatch[1];
      } else {
        this.closeActive();
        this.startBlock("blockquote", bqMatch[1], {});
      }
      return;
    }
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    const olMatch = line.match(/^(\s*)(\d{1,9})([.)])\s+(.*)$/);
    if (ulMatch || olMatch) {
      const indent = (ulMatch ? ulMatch[1] : olMatch[1]).length;
      const ordered = !!olMatch;
      const a2 = this.getActive();
      if (a2 && a2.type === "list" && a2.meta.ordered === ordered) {
        a2.content += "\n" + line;
        return;
      }
      this.closeActive();
      const meta = { ordered, indent };
      if (ordered) meta.start = parseInt(olMatch[2], 10);
      this.startBlock("list", line, meta);
      return;
    }
    {
      const a2 = this.getActive();
      if (a2 && a2.type === "list" && /^\s+\S/.test(line)) {
        a2.content += "\n" + line;
        return;
      }
    }
    if (/^ {4}/.test(line)) {
      const a2 = this.getActive();
      if (!a2 || a2.type === "paragraph" || a2.type === "code") {
        if (a2 && a2.type === "code") {
          a2.content += "\n" + line.slice(4);
          return;
        }
        if (!a2) {
          this.startBlock("code", line.slice(4), { language: "" });
          return;
        }
      }
    }
    if (line.includes("|")) {
      const a2 = this.getActive();
      if (a2 && a2.type === "table") {
        a2.content += "\n" + line;
        return;
      }
      if (a2 && a2.type === "paragraph" && a2.content.includes("|") && !a2.content.includes("\n") && isTableSeparatorRow(line)) {
        const headers = splitTableRow(a2.content);
        const seps = splitTableRow(line);
        if (headers.length === seps.length && headers.length > 0) {
          a2.type = "table";
          a2.content += "\n" + line;
          return;
        }
      }
      if (!a2 || a2.type === "paragraph" && a2.content.includes("\n") === false) {
        const next = allLines[idx + 1];
        if (next !== void 0 && next.includes("|") && isTableSeparatorRow(next)) {
          const headers = splitTableRow(line);
          const seps = splitTableRow(next);
          if (headers.length === seps.length && headers.length > 0) {
            this.closeActive();
            this.startBlock("table", line, {});
            return;
          }
        }
      }
    }
    if (this.opts.allowHtml && /^ {0,3}<[a-z!]/i.test(line)) {
      const a2 = this.getActive();
      if (a2 && a2.type === "html") {
        a2.content += "\n" + line;
      } else {
        this.closeActive();
        this.startBlock("html", line, {});
      }
      return;
    }
    const a = this.getActive();
    if (a && a.type === "paragraph") {
      a.content += "\n" + line;
    } else {
      this.closeActive();
      this.startBlock("paragraph", line, {});
    }
  }
  isClosingFence(line) {
    if (line.length < this.codeFenceCount) return false;
    let n = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === this.codeFenceChar) n++;
      else if (line[i] === " " && n >= this.codeFenceCount) {
        for (let j = i; j < line.length; j++) {
          if (line[j] !== " ") return false;
        }
        return true;
      } else return false;
    }
    return n >= this.codeFenceCount;
  }
};
function isTableSeparatorRow(line) {
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c.trim()));
}
function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\||\|$/g, "");
  if (!trimmed) return [];
  const out = [];
  let buf = "";
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (c === "\\" && trimmed[i + 1] === "|") {
      buf += "|";
      i++;
    } else if (c === "|") {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += c;
    }
  }
  out.push(buf.trim());
  return out;
}
function parseTable(content) {
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [], alignments: [] };
  const headers = splitTableRow(lines[0]);
  let alignments = headers.map(() => "none");
  let dataStart = 1;
  if (lines.length > 1 && isTableSeparatorRow(lines[1])) {
    const aligns = splitTableRow(lines[1]);
    alignments = aligns.map((a) => {
      const t = a.trim();
      const left = t.startsWith(":");
      const right = t.endsWith(":");
      if (left && right) return "center";
      if (right) return "right";
      if (left) return "left";
      return "none";
    });
    dataStart = 2;
  }
  const rows = lines.slice(dataStart).map(splitTableRow);
  return { headers, rows, alignments };
}
function parseListItems(content) {
  const lines = content.split("\n");
  const flat = [];
  for (const line of lines) {
    const m = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (!m) {
      const last = flat[flat.length - 1];
      if (last) last.text += "\n" + line.trim();
      continue;
    }
    const indent = m[1].length;
    let text = m[2];
    let isTask;
    let taskChecked;
    const tm = text.match(/^\[([ xX])\]\s+(.*)$/);
    if (tm) {
      isTask = true;
      taskChecked = tm[1] !== " ";
      text = tm[2];
    }
    const item = { text, indent };
    if (isTask !== void 0) {
      item.isTask = isTask;
      item.taskChecked = taskChecked;
    }
    flat.push(item);
  }
  return nestListItems(flat);
}
function nestListItems(flat) {
  const root = [];
  const stack = [
    { indent: -1, list: root }
  ];
  for (const item of flat) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].list;
    parent.push(item);
    stack.push({
      indent: item.indent,
      list: item.children = item.children ?? []
    });
  }
  const strip = (items) => {
    for (const it of items) {
      if (it.children && it.children.length === 0) delete it.children;
      else if (it.children) strip(it.children);
    }
    return items;
  };
  return strip(root);
}

// src/server/index.ts
function parseToBlocks(text, options = {}) {
  const parser = new StreamParser(options);
  parser.push(text);
  const blocks = parser.getBlocks();
  for (const b of blocks) {
    if (!b.closed) {
      b.closed = true;
    }
  }
  return blocks.map((b) => ({
    id: b.id,
    type: b.type,
    content: b.content,
    closed: b.closed,
    meta: stripFunctions(b.meta)
  }));
}
function stripFunctions(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripFunctions);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "function") continue;
    out[k] = stripFunctions(v);
  }
  return out;
}

export { StreamParser, parseToBlocks };
//# sourceMappingURL=server.js.map
//# sourceMappingURL=server.js.map