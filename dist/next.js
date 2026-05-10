import * as React from 'react';
import { memo, useState, useCallback, useMemo, useRef, useEffect, useSyncExternalStore } from 'react';
import { jsx, jsxs, Fragment } from 'react/jsx-runtime';

// src/components/StreamMD.tsx

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

// src/core/sanitize.ts
var DANGEROUS_SCHEME = /^(javascript|vbscript|data|file|blob):/i;
var SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|avif|bmp|x-icon);base64,[a-z0-9+/=\s]+$/i;
var ALLOWED_PROTOCOL = /^(https?|mailto|tel):/i;
function sanitizeUrl(href, options = {}) {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[ -]/g, "");
  if (cleaned.startsWith("/") || cleaned.startsWith("#") || cleaned.startsWith("?")) {
    return cleaned;
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) {
    return cleaned;
  }
  if (/^data:/i.test(cleaned)) {
    const allow = options.allowDataImages ?? true;
    if (allow && SAFE_DATA_IMAGE.test(cleaned)) return cleaned;
    return null;
  }
  if (DANGEROUS_SCHEME.test(cleaned)) return null;
  if (options.allowedProtocols) {
    const protoMatch = cleaned.match(/^([a-z][a-z0-9+.-]*):/i);
    if (!protoMatch) return null;
    const proto = protoMatch[1].toLowerCase();
    return options.allowedProtocols.includes(proto) ? cleaned : null;
  }
  return ALLOWED_PROTOCOL.test(cleaned) ? cleaned : null;
}
function sanitizeImageUrl(href, options = {}) {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[ -]/g, "");
  if (cleaned.startsWith("/") || cleaned.startsWith("#") || cleaned.startsWith("?")) {
    return cleaned;
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return cleaned;
  if (/^data:/i.test(cleaned)) {
    const allow = options.allowDataImages ?? true;
    if (allow && SAFE_DATA_IMAGE.test(cleaned)) return cleaned;
    return null;
  }
  if (DANGEROUS_SCHEME.test(cleaned)) return null;
  return /^https?:/i.test(cleaned) ? cleaned : null;
}

// src/parser/InlineParser.ts
function parseInline(text, options = {}) {
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? DEFAULT_LIMITS.maxInlineDepth;
  const tentative = options.tentative ?? true;
  const plugins = options.plugins;
  if (depth >= maxDepth) {
    return [{ type: "text", content: text }];
  }
  const tokens = [];
  const len = text.length;
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) {
      tokens.push({ type: "text", content: buf });
      buf = "";
    }
  };
  const isWhitespace = (c) => c === void 0 || /\s/.test(c);
  const isPunct = (c) => c !== void 0 && /[!-/:-@[-`{-~]/.test(c);
  const isLeftFlanking = (before, after) => {
    if (isWhitespace(after)) return false;
    if (!isPunct(after)) return true;
    return isWhitespace(before) || isPunct(before);
  };
  const isRightFlanking = (before, after) => {
    if (isWhitespace(before)) return false;
    if (!isPunct(before)) return true;
    return isWhitespace(after) || isPunct(after);
  };
  const findLinkClose = (start) => {
    let pdepth = 1;
    for (let k = start; k < len; k++) {
      const ch = text[k];
      if (ch === "\\" && k + 1 < len) {
        k++;
        continue;
      }
      if (ch === "(") pdepth++;
      else if (ch === ")") {
        pdepth--;
        if (pdepth === 0) return k;
      }
    }
    return -1;
  };
  const tryLinkOrImage = (isImage) => {
    const open = isImage ? i + 2 : i + 1;
    let bdepth = 1;
    let close = -1;
    for (let k = open; k < len; k++) {
      const ch = text[k];
      if (ch === "\\" && k + 1 < len) {
        k++;
        continue;
      }
      if (ch === "[") bdepth++;
      else if (ch === "]") {
        bdepth--;
        if (bdepth === 0) {
          close = k;
          break;
        }
      }
    }
    if (close === -1) return false;
    if (text[close + 1] !== "(") return false;
    const urlStart = close + 2;
    const urlEnd = findLinkClose(urlStart);
    if (urlEnd === -1) return false;
    const inner = text.slice(open, close);
    const dest = text.slice(urlStart, urlEnd).trim();
    let url = dest;
    let title;
    const titleMatch = dest.match(/^(\S+)\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/);
    if (titleMatch) {
      url = titleMatch[1];
      title = titleMatch[2] ?? titleMatch[3] ?? titleMatch[4];
    }
    const safeUrl = isImage ? sanitizeImageUrl(url) : sanitizeUrl(url);
    if (safeUrl === null) {
      return false;
    }
    flush();
    if (isImage) {
      const tok = {
        type: "image",
        content: inner,
        alt: inner,
        href: safeUrl
      };
      if (title !== void 0) tok.title = title;
      tokens.push(tok);
    } else {
      const tok = {
        type: "link",
        content: inner,
        href: safeUrl,
        children: parseInline(inner, { ...options, depth: depth + 1, tentative: false })
      };
      if (title !== void 0) tok.title = title;
      tokens.push(tok);
    }
    i = urlEnd + 1;
    return true;
  };
  const tryCode = () => {
    let ticks = 0;
    let j = i;
    while (j < len && text[j] === "`") {
      ticks++;
      j++;
    }
    let k = j;
    while (k < len) {
      if (text[k] === "`") {
        let n = 0;
        const runStart = k;
        while (k < len && text[k] === "`") {
          n++;
          k++;
        }
        if (n === ticks) {
          flush();
          let content = text.slice(j, runStart);
          if (content.length >= 2 && content.startsWith(" ") && content.endsWith(" ") && content.trim().length > 0) {
            content = content.slice(1, -1);
          }
          tokens.push({ type: "code", content });
          i = k;
          return true;
        }
      } else {
        k++;
      }
    }
    return false;
  };
  const tryEmphasis = (marker) => {
    let runLen = 0;
    let j = i;
    while (j < len && text[j] === marker) {
      runLen++;
      j++;
    }
    if (runLen === 0) return false;
    const before = i > 0 ? text[i - 1] : void 0;
    const after = text[j];
    const leftFlank = isLeftFlanking(before, after);
    const rightFlank = isRightFlanking(before, after);
    const canOpen = leftFlank && (marker === "*" || !rightFlank || isPunct(before));
    if (!canOpen) {
      buf += text.slice(i, j);
      i = j;
      return true;
    }
    let k = j;
    while (k < len) {
      if (text[k] === "\\" && k + 1 < len) {
        k += 2;
        continue;
      }
      if (text[k] === "`") {
        let n = 0;
        while (k < len && text[k] === "`") {
          n++;
          k++;
        }
        let m = k;
        while (m < len) {
          if (text[m] === "`") {
            let n2 = 0;
            while (m < len && text[m] === "`") {
              n2++;
              m++;
            }
            if (n2 === n) break;
          } else m++;
        }
        k = m;
        continue;
      }
      if (text[k] === marker) {
        let closeRun = 0;
        const closeStart = k;
        while (k < len && text[k] === marker) {
          closeRun++;
          k++;
        }
        const cBefore = closeStart > 0 ? text[closeStart - 1] : void 0;
        const cAfter = text[k];
        const rightFlank2 = isRightFlanking(cBefore, cAfter);
        if (!rightFlank2) continue;
        const consumed = Math.min(runLen, closeRun);
        if (consumed === 0) continue;
        const innerStart = i + consumed;
        const innerEnd = closeStart + (closeRun - consumed);
        const inner = text.slice(innerStart, innerEnd);
        flush();
        let type;
        if (consumed >= 3) type = "bolditalic";
        else if (consumed === 2) type = "bold";
        else type = "italic";
        tokens.push({
          type,
          content: inner,
          children: parseInline(inner, { ...options, depth: depth + 1, tentative: false })
        });
        i = innerEnd + consumed;
        return true;
      }
      k++;
    }
    if (tentative && depth === 0 && runLen <= 3) {
      const remaining = text.slice(j);
      if (!remaining.includes("\n")) {
        flush();
        const innerText = remaining;
        let type;
        if (runLen >= 3) type = "bolditalic";
        else if (runLen === 2) type = "bold";
        else type = "italic";
        tokens.push({
          type,
          content: innerText,
          children: parseInline(innerText, {
            ...options,
            depth: depth + 1,
            tentative: false
          }),
          tentative: true
        });
        i = len;
        return true;
      }
    }
    buf += text.slice(i, j);
    i = j;
    return true;
  };
  const tryStrike = () => {
    if (text[i] !== "~" || text[i + 1] !== "~") return false;
    const start = i + 2;
    let k = start;
    while (k < len - 1) {
      if (text[k] === "\\" && k + 1 < len) {
        k += 2;
        continue;
      }
      if (text[k] === "~" && text[k + 1] === "~") {
        const inner = text.slice(start, k);
        flush();
        tokens.push({
          type: "strikethrough",
          content: inner,
          children: parseInline(inner, { ...options, depth: depth + 1, tentative: false })
        });
        i = k + 2;
        return true;
      }
      k++;
    }
    if (tentative && depth === 0) {
      const remaining = text.slice(start);
      if (!remaining.includes("\n")) {
        flush();
        tokens.push({
          type: "strikethrough",
          content: remaining,
          children: parseInline(remaining, {
            ...options,
            depth: depth + 1,
            tentative: false
          }),
          tentative: true
        });
        i = len;
        return true;
      }
    }
    return false;
  };
  const tryAutolink = () => {
    if (text[i] !== "<") return false;
    const close = text.indexOf(">", i + 1);
    if (close === -1) return false;
    const inner = text.slice(i + 1, close);
    const isUrl = /^[a-z][a-z0-9+.-]*:[^\s<>]+$/i.test(inner);
    const isEmail = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      inner
    );
    if (!isUrl && !isEmail) return false;
    const url = isEmail ? `mailto:${inner}` : inner;
    const safe = sanitizeUrl(url);
    if (safe === null) return false;
    flush();
    tokens.push({ type: "link", content: inner, href: safe });
    i = close + 1;
    return true;
  };
  const tryHardBreak = () => {
    if (text[i] === "\\" && text[i + 1] === "\n") {
      flush();
      tokens.push({ type: "br", content: "" });
      i += 2;
      return true;
    }
    if (text[i] === " " && text[i + 1] === " " && (text[i + 2] === "\n" || i + 2 === len)) {
      flush();
      tokens.push({ type: "br", content: "" });
      i = text[i + 2] === "\n" ? i + 3 : i + 2;
      return true;
    }
    return false;
  };
  while (i < len) {
    const ch = text[i];
    if (plugins?.length) {
      let pluginMatched = false;
      for (const p of plugins) {
        if (p.triggers && !p.triggers.includes(ch)) continue;
        const m = p.match(text, i);
        if (m) {
          flush();
          tokens.push(m.token);
          i += m.consumed;
          pluginMatched = true;
          break;
        }
      }
      if (pluginMatched) continue;
    }
    if (ch === "\\" && i + 1 < len) {
      if (text[i + 1] === "\n") {
        if (tryHardBreak()) continue;
      }
      buf += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === "<" && tryAutolink()) continue;
    if ((ch === " " || ch === "\\") && tryHardBreak()) continue;
    if (ch === "!" && text[i + 1] === "[") {
      if (tryLinkOrImage(true)) continue;
    }
    if (ch === "[") {
      if (tryLinkOrImage(false)) continue;
    }
    if (ch === "`") {
      if (tryCode()) continue;
      if (tentative && depth === 0) {
        const remaining = text.slice(i + 1);
        if (!remaining.includes("\n") && remaining.length > 0) {
          flush();
          tokens.push({ type: "code", content: remaining, tentative: true });
          i = len;
          continue;
        }
      }
      buf += ch;
      i++;
      continue;
    }
    if (ch === "*" || ch === "_") {
      if (tryEmphasis(ch)) continue;
    }
    if (ch === "~" && text[i + 1] === "~") {
      if (tryStrike()) continue;
      buf += ch;
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return tokens;
}
function InlineRenderer({
  text,
  overrides,
  inlinePlugins,
  tentative
}) {
  const tokens = parseInline(text, {
    plugins: inlinePlugins,
    ...tentative !== void 0 ? { tentative } : {}
  });
  return /* @__PURE__ */ jsx(Fragment, { children: tokens.map(
    (token, i) => renderToken(token, i, overrides, inlinePlugins)
  ) });
}
function tentativeProps(t) {
  if (!t.tentative) return {};
  return { className: "smd-tentative", "data-tentative": "true" };
}
function renderToken(token, key, overrides, plugins) {
  if (plugins?.length) {
    for (const p of plugins) {
      if (p.render && (p.name === token.type || token.type === "math")) {
        const node = p.render(token);
        if (node !== null && node !== void 0) {
          return /* @__PURE__ */ jsx(React.Fragment, { children: node }, key);
        }
      }
    }
  }
  switch (token.type) {
    case "text":
      return /* @__PURE__ */ jsx(React.Fragment, { children: token.content }, key);
    case "br":
      return /* @__PURE__ */ jsx("br", {}, key);
    case "bold": {
      const Strong = overrides?.strong;
      const inner = token.children ? token.children.map((t, i) => renderToken(t, i, overrides, plugins)) : token.content;
      const tProps = tentativeProps(token);
      if (Strong) return /* @__PURE__ */ jsx(Strong, { children: inner }, key);
      return /* @__PURE__ */ jsx("strong", { ...tProps, children: inner }, key);
    }
    case "italic": {
      const Em = overrides?.em;
      const inner = token.children ? token.children.map((t, i) => renderToken(t, i, overrides, plugins)) : token.content;
      const tProps = tentativeProps(token);
      if (Em) return /* @__PURE__ */ jsx(Em, { children: inner }, key);
      return /* @__PURE__ */ jsx("em", { ...tProps, children: inner }, key);
    }
    case "bolditalic": {
      const inner = token.children ? token.children.map((t, i) => renderToken(t, i, overrides, plugins)) : token.content;
      const tProps = tentativeProps(token);
      return /* @__PURE__ */ jsx("strong", { ...tProps, children: /* @__PURE__ */ jsx("em", { children: inner }) }, key);
    }
    case "code": {
      const Code = overrides?.code;
      if (Code) return /* @__PURE__ */ jsx(Code, { children: token.content }, key);
      return /* @__PURE__ */ jsx("code", { className: `smd-inline-code${token.tentative ? " smd-tentative" : ""}`, ...token.tentative ? { "data-tentative": "true" } : {}, children: token.content }, key);
    }
    case "link": {
      const A = overrides?.a;
      if (!token.href) {
        return /* @__PURE__ */ jsx(React.Fragment, { children: token.content }, key);
      }
      const inner = token.children ? token.children.map((t, i) => renderToken(t, i, overrides, plugins)) : token.content;
      if (A) {
        const aProps = {
          href: token.href,
          children: inner
        };
        if (token.title !== void 0) aProps.title = token.title;
        return /* @__PURE__ */ jsx(A, { ...aProps }, key);
      }
      const isExternal = /^(https?:|mailto:|tel:)/i.test(token.href);
      return /* @__PURE__ */ jsx(
        "a",
        {
          href: token.href,
          ...token.title !== void 0 ? { title: token.title } : {},
          ...isExternal ? {
            target: "_blank",
            rel: "noopener noreferrer",
            referrerPolicy: "no-referrer"
          } : {},
          className: "smd-link",
          children: inner
        },
        key
      );
    }
    case "strikethrough": {
      const Del = overrides?.del;
      const inner = token.children ? token.children.map((t, i) => renderToken(t, i, overrides, plugins)) : token.content;
      const tProps = tentativeProps(token);
      if (Del) return /* @__PURE__ */ jsx(Del, { children: inner }, key);
      return /* @__PURE__ */ jsx("del", { ...tProps, children: inner }, key);
    }
    case "image": {
      const Img = overrides?.img;
      if (!token.href) {
        return /* @__PURE__ */ jsx(React.Fragment, { children: token.content }, key);
      }
      if (Img) {
        const props = {
          src: token.href,
          alt: token.alt ?? ""
        };
        if (token.title !== void 0) props.title = token.title;
        return /* @__PURE__ */ jsx(Img, { ...props }, key);
      }
      return /* @__PURE__ */ jsx(
        "img",
        {
          src: token.href,
          alt: token.alt ?? "",
          ...token.title !== void 0 ? { title: token.title } : {},
          className: "smd-image",
          loading: "lazy",
          decoding: "async"
        },
        key
      );
    }
    default:
      return /* @__PURE__ */ jsx(React.Fragment, { children: token.content }, key);
  }
}

// src/highlight/diff.ts
function highlightDiff(code) {
  const out = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) out.push({ text: "\n", className: "" });
    const line = lines[i];
    if (line.startsWith("+++") || line.startsWith("---")) {
      out.push({ text: line, className: "smd-hl-info" });
    } else if (line.startsWith("+")) {
      out.push({ text: line, className: "smd-hl-inserted" });
    } else if (line.startsWith("-")) {
      out.push({ text: line, className: "smd-hl-deleted" });
    } else if (line.startsWith("@@")) {
      out.push({ text: line, className: "smd-hl-info" });
    } else {
      out.push({ text: line, className: "" });
    }
  }
  return out;
}

// src/highlight/highlighter.ts
var set = (...arr) => new Set(arr);
var JS_KW = set(
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "new",
  "this",
  "class",
  "extends",
  "import",
  "export",
  "from",
  "default",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "throw",
  "typeof",
  "instanceof",
  "in",
  "of",
  "yield",
  "delete",
  "void",
  "null",
  "undefined",
  "true",
  "false",
  "static",
  "super",
  "get",
  "set"
);
var JS_BI = set(
  "console",
  "Promise",
  "Array",
  "Object",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "JSON",
  "Math",
  "Date",
  "Error",
  "RegExp",
  "Symbol",
  "BigInt",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "fetch",
  "window",
  "document",
  "globalThis",
  "process",
  "Buffer"
);
var TS_KW = set(
  ...JS_KW,
  "type",
  "interface",
  "enum",
  "namespace",
  "declare",
  "abstract",
  "implements",
  "keyof",
  "readonly",
  "as",
  "is",
  "infer",
  "satisfies",
  "public",
  "private",
  "protected",
  "override",
  "out",
  "never",
  "unknown",
  "any"
);
var TS_BI = set(
  ...JS_BI,
  "Partial",
  "Required",
  "Pick",
  "Omit",
  "Record",
  "Exclude",
  "Extract",
  "ReturnType",
  "Awaited",
  "Readonly",
  "NonNullable",
  "Parameters",
  "ConstructorParameters",
  "InstanceType",
  "ThisType"
);
var JS_LIKE = {
  comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
  strings: [
    /^"(?:[^"\\\n]|\\.)*"/,
    /^'(?:[^'\\\n]|\\.)*'/,
    /^`(?:[^`\\]|\\.)*`/
  ],
  numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i,
  memberAccess: true
};
var PY_KW = set(
  "def",
  "class",
  "return",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "break",
  "continue",
  "import",
  "from",
  "as",
  "try",
  "except",
  "finally",
  "raise",
  "with",
  "yield",
  "lambda",
  "pass",
  "del",
  "global",
  "nonlocal",
  "assert",
  "async",
  "await",
  "True",
  "False",
  "None",
  "and",
  "or",
  "not",
  "in",
  "is"
);
var PY_BI = set(
  "print",
  "len",
  "range",
  "type",
  "int",
  "str",
  "float",
  "list",
  "dict",
  "set",
  "tuple",
  "bool",
  "input",
  "open",
  "map",
  "filter",
  "zip",
  "enumerate",
  "super",
  "self",
  "cls",
  "isinstance",
  "hasattr",
  "getattr",
  "setattr",
  "abs",
  "min",
  "max",
  "sum",
  "any",
  "all",
  "sorted",
  "reversed"
);
var RUST_KW = set(
  "fn",
  "let",
  "mut",
  "const",
  "static",
  "if",
  "else",
  "for",
  "while",
  "loop",
  "match",
  "return",
  "use",
  "mod",
  "pub",
  "struct",
  "enum",
  "impl",
  "trait",
  "type",
  "where",
  "async",
  "await",
  "move",
  "ref",
  "self",
  "Self",
  "super",
  "crate",
  "unsafe",
  "extern",
  "dyn",
  "true",
  "false",
  "as",
  "in",
  "break",
  "continue"
);
var RUST_BI = set(
  "println",
  "eprintln",
  "print",
  "format",
  "vec",
  "String",
  "Vec",
  "Option",
  "Result",
  "Some",
  "None",
  "Ok",
  "Err",
  "Box",
  "Rc",
  "Arc",
  "RefCell",
  "Mutex",
  "HashMap",
  "HashSet",
  "BTreeMap",
  "BTreeSet",
  "i8",
  "i16",
  "i32",
  "i64",
  "i128",
  "u8",
  "u16",
  "u32",
  "u64",
  "u128",
  "f32",
  "f64",
  "bool",
  "char",
  "usize",
  "isize",
  "str"
);
var GO_KW = set(
  "func",
  "return",
  "if",
  "else",
  "for",
  "range",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "goto",
  "var",
  "const",
  "type",
  "struct",
  "interface",
  "map",
  "chan",
  "select",
  "defer",
  "go",
  "package",
  "import",
  "true",
  "false",
  "nil"
);
var GO_BI = set(
  "fmt",
  "make",
  "len",
  "cap",
  "append",
  "copy",
  "delete",
  "new",
  "panic",
  "recover",
  "close",
  "error",
  "string",
  "int",
  "int32",
  "int64",
  "float32",
  "float64",
  "bool",
  "byte",
  "rune",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "complex64",
  "complex128"
);
var JAVA_KW = set(
  "public",
  "private",
  "protected",
  "static",
  "final",
  "abstract",
  "class",
  "interface",
  "extends",
  "implements",
  "new",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "try",
  "catch",
  "finally",
  "throw",
  "throws",
  "import",
  "package",
  "void",
  "int",
  "long",
  "double",
  "float",
  "boolean",
  "char",
  "byte",
  "short",
  "null",
  "true",
  "false",
  "this",
  "super",
  "instanceof",
  "synchronized",
  "volatile",
  "transient",
  "enum",
  "record",
  "sealed",
  "non-sealed",
  "permits",
  "yield"
);
var JAVA_BI = set(
  "System",
  "String",
  "Integer",
  "Long",
  "Double",
  "Float",
  "Boolean",
  "Character",
  "List",
  "ArrayList",
  "Map",
  "HashMap",
  "Set",
  "HashSet",
  "Optional",
  "Stream",
  "Arrays",
  "Collections",
  "Math",
  "Object"
);
var C_KW = set(
  "auto",
  "break",
  "case",
  "char",
  "const",
  "continue",
  "default",
  "do",
  "double",
  "else",
  "enum",
  "extern",
  "float",
  "for",
  "goto",
  "if",
  "inline",
  "int",
  "long",
  "register",
  "restrict",
  "return",
  "short",
  "signed",
  "sizeof",
  "static",
  "struct",
  "switch",
  "typedef",
  "union",
  "unsigned",
  "void",
  "volatile",
  "while",
  "_Bool",
  "_Complex",
  "_Imaginary"
);
var CPP_KW = set(
  ...C_KW,
  "alignas",
  "alignof",
  "and",
  "and_eq",
  "asm",
  "atomic_cancel",
  "atomic_commit",
  "atomic_noexcept",
  "auto",
  "bitand",
  "bitor",
  "bool",
  "catch",
  "char16_t",
  "char32_t",
  "class",
  "compl",
  "concept",
  "constexpr",
  "const_cast",
  "co_await",
  "co_return",
  "co_yield",
  "decltype",
  "delete",
  "dynamic_cast",
  "explicit",
  "export",
  "false",
  "friend",
  "mutable",
  "namespace",
  "new",
  "noexcept",
  "not",
  "not_eq",
  "nullptr",
  "operator",
  "or",
  "or_eq",
  "private",
  "protected",
  "public",
  "reinterpret_cast",
  "requires",
  "static_assert",
  "static_cast",
  "synchronized",
  "template",
  "this",
  "thread_local",
  "throw",
  "true",
  "try",
  "typeid",
  "typename",
  "using",
  "virtual",
  "wchar_t",
  "xor",
  "xor_eq"
);
var C_BI = set(
  "printf",
  "scanf",
  "fprintf",
  "fscanf",
  "sprintf",
  "sscanf",
  "fopen",
  "fclose",
  "fread",
  "fwrite",
  "malloc",
  "calloc",
  "realloc",
  "free",
  "memcpy",
  "memset",
  "strlen",
  "strcpy",
  "strncpy",
  "strcmp",
  "strncmp",
  "strcat",
  "size_t",
  "ssize_t",
  "FILE",
  "NULL",
  "stdin",
  "stdout",
  "stderr"
);
var BASH_KW = set(
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "for",
  "while",
  "do",
  "done",
  "case",
  "esac",
  "function",
  "return",
  "in",
  "select",
  "until",
  "export",
  "source",
  "local",
  "readonly",
  "declare",
  "unset",
  "set"
);
var BASH_BI = set(
  "echo",
  "cd",
  "ls",
  "grep",
  "sed",
  "awk",
  "cat",
  "chmod",
  "chown",
  "cp",
  "mv",
  "rm",
  "mkdir",
  "touch",
  "find",
  "xargs",
  "curl",
  "wget",
  "git",
  "npm",
  "npx",
  "node",
  "python",
  "pip",
  "docker",
  "kubectl",
  "ssh",
  "scp",
  "tar",
  "zip",
  "unzip",
  "head",
  "tail",
  "less",
  "more",
  "wc",
  "sort",
  "uniq",
  "tr"
);
var SQL_KW = set(
  "SELECT",
  "FROM",
  "WHERE",
  "INSERT",
  "INTO",
  "UPDATE",
  "DELETE",
  "CREATE",
  "DROP",
  "ALTER",
  "TABLE",
  "INDEX",
  "VIEW",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "FULL",
  "CROSS",
  "ON",
  "USING",
  "AND",
  "OR",
  "NOT",
  "IN",
  "LIKE",
  "ILIKE",
  "BETWEEN",
  "EXISTS",
  "NULL",
  "IS",
  "AS",
  "ORDER",
  "BY",
  "GROUP",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "UNION",
  "INTERSECT",
  "EXCEPT",
  "ALL",
  "DISTINCT",
  "SET",
  "VALUES",
  "DEFAULT",
  "PRIMARY",
  "KEY",
  "FOREIGN",
  "REFERENCES",
  "CASCADE",
  "CONSTRAINT",
  "CHECK",
  "UNIQUE",
  "WITH",
  "CASE",
  "WHEN",
  "THEN",
  "END",
  "ELSE"
);
var YAML_KW = set("true", "false", "null", "yes", "no", "on", "off", "True", "False", "Null", "None", "TRUE", "FALSE", "NULL");
var CSS_KW = set(
  "important",
  "inherit",
  "initial",
  "unset",
  "revert",
  "auto",
  "none",
  "block",
  "inline",
  "flex",
  "grid",
  "inline-block",
  "inline-flex",
  "inline-grid",
  "relative",
  "absolute",
  "fixed",
  "sticky",
  "static"
);
var LANGS = {
  javascript: { keywords: JS_KW, builtins: JS_BI, ...JS_LIKE, jsx: false },
  typescript: { keywords: TS_KW, builtins: TS_BI, ...JS_LIKE, jsx: false },
  jsx: { keywords: JS_KW, builtins: JS_BI, ...JS_LIKE, jsx: true },
  tsx: { keywords: TS_KW, builtins: TS_BI, ...JS_LIKE, jsx: true },
  python: {
    keywords: PY_KW,
    builtins: PY_BI,
    comments: [/^#[^\n]*/],
    strings: [
      /^"""[\s\S]*?"""/,
      /^'''[\s\S]*?'''/,
      /^[rRbBuUfF]?"(?:[^"\\\n]|\\.)*"/,
      /^[rRbBuUfF]?'(?:[^'\\\n]|\\.)*'/
    ],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?(?:j|J)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i,
    memberAccess: true
  },
  rust: {
    keywords: RUST_KW,
    builtins: RUST_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^r#"[\s\S]*?"#/, /^b"(?:[^"\\\n]|\\.)*"/],
    numbers: /^(\d+(?:_\d+)*\.?\d*(?:e[+-]?\d+)?(?:f32|f64|u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize)?)\b/i,
    memberAccess: true
  },
  go: {
    keywords: GO_KW,
    builtins: GO_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^`[\s\S]*?`/],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?)\b/i,
    memberAccess: true
  },
  java: {
    keywords: JAVA_KW,
    builtins: JAVA_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?[lLfFdD]?)\b/i,
    memberAccess: true
  },
  c: {
    keywords: C_KW,
    builtins: C_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?[uUlLfF]*|0x[\da-f]+[uUlL]*)\b/i,
    memberAccess: true
  },
  cpp: {
    keywords: CPP_KW,
    builtins: C_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/, /^R"\([\s\S]*?\)"/],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?[uUlLfF]*|0x[\da-f]+[uUlL]*)\b/i,
    memberAccess: true
  },
  bash: {
    keywords: BASH_KW,
    builtins: BASH_BI,
    comments: [/^#[^\n]*/],
    strings: [/^"(?:[^"\\]|\\.)*"/, /^'[^']*'/],
    numbers: /^(\d+\.?\d*)\b/
  },
  sql: {
    keywords: /* @__PURE__ */ new Set([...SQL_KW, ...Array.from(SQL_KW).map((k) => k.toLowerCase())]),
    comments: [/^--[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^'(?:[^'\\\n]|\\.)*'/, /^"(?:[^"\\\n]|\\.)*"/],
    numbers: /^(\d+\.?\d*)\b/
  },
  yaml: {
    keywords: YAML_KW,
    comments: [/^#[^\n]*/],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/i
  },
  json: {
    keywords: set("true", "false", "null"),
    comments: [],
    strings: [/^"(?:[^"\\\n]|\\.)*"/],
    numbers: /^(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/i
  },
  html: {
    keywords: /* @__PURE__ */ new Set(),
    comments: [/^<!--[\s\S]*?-->/],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(\d+\.?\d*)\b/
  },
  css: {
    keywords: CSS_KW,
    comments: [/^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(-?\d+\.?\d*(?:px|em|rem|%|vh|vw|vmin|vmax|fr|s|ms|deg|rad|turn|pt|cm|mm|in)?)\b/
  },
  markdown: {
    keywords: /* @__PURE__ */ new Set(),
    comments: [],
    strings: [],
    numbers: /^a^/
  }
};
var ALIASES = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  py: "python",
  py3: "python",
  rs: "rust",
  golang: "go",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  bashrc: "bash",
  yml: "yaml",
  "c++": "cpp",
  cxx: "cpp",
  cc: "cpp",
  hpp: "cpp",
  h: "c",
  postgres: "sql",
  postgresql: "sql",
  mysql: "sql",
  sqlite: "sql",
  htm: "html",
  xml: "html",
  svg: "html",
  scss: "css",
  sass: "css",
  less: "css",
  md: "markdown"
};
function highlight(code, language) {
  if (!code) return [];
  const lang = (language || "").toLowerCase().trim();
  const resolved = ALIASES[lang] ?? lang;
  if (resolved === "diff") {
    return highlightDiff(code);
  }
  if (resolved === "markdown") {
    return highlightMarkdown(code);
  }
  const spec = LANGS[resolved];
  if (!spec) return [{ text: code, className: "" }];
  const tokens = [];
  let pos = 0;
  let lastWasDot = false;
  while (pos < code.length) {
    const sub = code.slice(pos);
    if (sub.startsWith("\n")) {
      tokens.push({ text: "\n", className: "" });
      pos++;
      lastWasDot = false;
      continue;
    }
    const wsMatch = sub.match(/^[ \t]+/);
    if (wsMatch) {
      tokens.push({ text: wsMatch[0], className: "" });
      pos += wsMatch[0].length;
      continue;
    }
    let matched = false;
    for (const re of spec.comments) {
      const m = sub.match(re);
      if (m && m.index === 0) {
        tokens.push({ text: m[0], className: "smd-hl-comment" });
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (matched) {
      lastWasDot = false;
      continue;
    }
    for (const re of spec.strings) {
      const m = sub.match(re);
      if (m && m.index === 0) {
        tokens.push({ text: m[0], className: "smd-hl-string" });
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (matched) {
      lastWasDot = false;
      continue;
    }
    if (spec.jsx) {
      const tagOpen = sub.match(/^<\/?[A-Za-z][\w.-]*/);
      if (tagOpen) {
        tokens.push({ text: tagOpen[0], className: "smd-hl-tag" });
        pos += tagOpen[0].length;
        lastWasDot = false;
        continue;
      }
    }
    const numMatch = sub.match(spec.numbers);
    if (numMatch && numMatch.index === 0) {
      tokens.push({ text: numMatch[0], className: "smd-hl-number" });
      pos += numMatch[0].length;
      lastWasDot = false;
      continue;
    }
    const wordMatch = sub.match(/^[A-Za-z_$][\w$]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      let cls = "";
      if (!lastWasDot || !spec.memberAccess) {
        if (spec.keywords.has(word)) cls = "smd-hl-keyword";
        else if (spec.builtins?.has(word)) cls = "smd-hl-builtin";
      }
      tokens.push({ text: word, className: cls });
      pos += word.length;
      lastWasDot = false;
      continue;
    }
    const ch = sub[0];
    if (ch === ".") {
      lastWasDot = true;
    } else if (ch !== " " && ch !== "	") {
      lastWasDot = false;
    }
    tokens.push({ text: ch, className: "smd-hl-punctuation" });
    pos++;
  }
  return tokens;
}
function highlightMarkdown(code) {
  const out = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) out.push({ text: "\n", className: "" });
    const line = lines[i];
    if (/^#{1,6}\s/.test(line)) {
      out.push({ text: line, className: "smd-hl-keyword" });
    } else if (/^>\s/.test(line)) {
      out.push({ text: line, className: "smd-hl-comment" });
    } else if (/^```/.test(line) || /^~~~/.test(line)) {
      out.push({ text: line, className: "smd-hl-builtin" });
    } else if (/^\s*[-*+]\s/.test(line) || /^\s*\d+[.)]\s/.test(line)) {
      out.push({ text: line, className: "smd-hl-number" });
    } else {
      out.push({ text: line, className: "" });
    }
  }
  return out;
}
var HeadingBlock = memo(function HeadingBlock2({
  block,
  overrides,
  inlinePlugins
}) {
  const level = block.meta.level ?? 1;
  const Tag = `h${level}`;
  const className = `smd-heading smd-h${level}`;
  return /* @__PURE__ */ jsx(Tag, { className, children: /* @__PURE__ */ jsx(
    InlineRenderer,
    {
      text: block.content,
      ...overrides ? { overrides } : {},
      ...inlinePlugins ? { inlinePlugins } : {}
    }
  ) });
});
var ParagraphBlock = memo(function ParagraphBlock2({
  block,
  overrides,
  inlinePlugins
}) {
  return /* @__PURE__ */ jsx("p", { className: "smd-paragraph", children: /* @__PURE__ */ jsx(
    InlineRenderer,
    {
      text: block.content,
      ...overrides ? { overrides } : {},
      ...inlinePlugins ? { inlinePlugins } : {}
    }
  ) });
});
var CodeBlockComponent = memo(function CodeBlockComponent2({
  block,
  overrides,
  isActive,
  highlighter
}) {
  const language = block.meta.language ?? "";
  const code = block.content.endsWith("\n") ? block.content.slice(0, -1) : block.content;
  const streaming = !!isActive && !block.closed;
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    });
  }, [code]);
  const Pre = overrides?.pre;
  if (Pre) {
    return /* @__PURE__ */ jsx(Pre, { block, language, code, streaming });
  }
  const tokens = useMemo(() => {
    if (streaming) return null;
    const fn = highlighter ?? highlight;
    return fn(code, language);
  }, [streaming, code, language, highlighter]);
  return /* @__PURE__ */ jsxs("div", { className: `smd-code-block${streaming ? " smd-code-streaming" : ""}`, children: [
    /* @__PURE__ */ jsxs("div", { className: "smd-code-header", children: [
      language && /* @__PURE__ */ jsx("span", { className: "smd-code-lang", children: language }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "smd-code-copy",
          onClick: handleCopy,
          "aria-label": copied ? "Copied" : "Copy code",
          children: copied ? "Copied" : "Copy"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("pre", { className: "smd-pre", children: /* @__PURE__ */ jsx("code", { className: `smd-code language-${language}`, children: tokens === null ? code : tokens.map(
      (t, i) => t.className ? /* @__PURE__ */ jsx("span", { className: t.className, children: t.text }, i) : /* @__PURE__ */ jsx(React.Fragment, { children: t.text }, i)
    ) }) })
  ] });
});
var ListBlock = memo(function ListBlock2({
  block,
  overrides,
  inlinePlugins
}) {
  const ordered = block.meta.ordered ?? false;
  const items = useMemo(() => {
    if (block.closed && Array.isArray(block.meta.parsed)) {
      return block.meta.parsed;
    }
    return parseListItems(block.content);
  }, [block.closed, block.content, block.meta.parsed]);
  const Tag = ordered ? "ol" : "ul";
  return /* @__PURE__ */ jsx(
    Tag,
    {
      className: `smd-list smd-list-${ordered ? "ol" : "ul"}`,
      ...ordered && block.meta.start && block.meta.start !== 1 ? { start: block.meta.start } : {},
      children: items.map((item, i) => /* @__PURE__ */ jsx(
        ListItem,
        {
          item,
          ...overrides ? { overrides } : {},
          ...inlinePlugins ? { inlinePlugins } : {}
        },
        i
      ))
    }
  );
});
function ListItem({ item, overrides, inlinePlugins }) {
  return /* @__PURE__ */ jsxs("li", { className: "smd-list-item", children: [
    item.isTask !== void 0 && /* @__PURE__ */ jsx(
      "input",
      {
        type: "checkbox",
        checked: !!item.taskChecked,
        readOnly: true,
        "aria-label": item.taskChecked ? "completed task" : "incomplete task",
        className: "smd-task-checkbox"
      }
    ),
    /* @__PURE__ */ jsx(
      InlineRenderer,
      {
        text: item.text,
        ...overrides ? { overrides } : {},
        ...inlinePlugins ? { inlinePlugins } : {}
      }
    ),
    item.children && item.children.length > 0 && /* @__PURE__ */ jsx("ul", { className: "smd-list smd-list-ul", children: item.children.map((child, i) => /* @__PURE__ */ jsx(
      ListItem,
      {
        item: child,
        ...overrides ? { overrides } : {},
        ...inlinePlugins ? { inlinePlugins } : {}
      },
      i
    )) })
  ] });
}
var TableBlock = memo(function TableBlock2({
  block,
  overrides,
  inlinePlugins
}) {
  const parsed = useMemo(() => {
    if (block.closed && block.meta.parsed && typeof block.meta.parsed === "object") {
      return block.meta.parsed;
    }
    return parseTable(block.content);
  }, [block.closed, block.content, block.meta.parsed]);
  const { headers, rows, alignments } = parsed;
  const Tbl = overrides?.table;
  if (Tbl) return /* @__PURE__ */ jsx(Tbl, { block, headers, rows, alignments });
  const alignClass = (a) => a && a !== "none" ? `smd-align-${a}` : "";
  return /* @__PURE__ */ jsx("div", { className: "smd-table-wrapper", children: /* @__PURE__ */ jsxs("table", { className: "smd-table", children: [
    headers.length > 0 && /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: headers.map((h, i) => /* @__PURE__ */ jsx("th", { className: alignClass(alignments[i]), children: /* @__PURE__ */ jsx(
      InlineRenderer,
      {
        text: h,
        ...overrides ? { overrides } : {},
        ...inlinePlugins ? { inlinePlugins } : {}
      }
    ) }, i)) }) }),
    /* @__PURE__ */ jsx("tbody", { children: rows.map((row, ri) => /* @__PURE__ */ jsx("tr", { children: row.map((cell, ci) => /* @__PURE__ */ jsx("td", { className: alignClass(alignments[ci]), children: /* @__PURE__ */ jsx(
      InlineRenderer,
      {
        text: cell,
        ...overrides ? { overrides } : {},
        ...inlinePlugins ? { inlinePlugins } : {}
      }
    ) }, ci)) }, ri)) })
  ] }) });
});
var BlockquoteBlock = memo(function BlockquoteBlock2({
  block,
  overrides,
  inlinePlugins
}) {
  return /* @__PURE__ */ jsx("blockquote", { className: "smd-blockquote", children: /* @__PURE__ */ jsx(
    InlineRenderer,
    {
      text: block.content,
      ...overrides ? { overrides } : {},
      ...inlinePlugins ? { inlinePlugins } : {}
    }
  ) });
});
var HorizontalRuleBlock = memo(function HorizontalRuleBlock2() {
  return /* @__PURE__ */ jsx("hr", { className: "smd-hr" });
});
var HtmlBlock = memo(function HtmlBlock2({ block }) {
  return /* @__PURE__ */ jsx("div", { className: "smd-html-block", children: /* @__PURE__ */ jsx("pre", { children: block.content }) });
});
var ParserStore = class {
  constructor(opts) {
    this.listeners = /* @__PURE__ */ new Set();
    this.snapshot = {
      blocks: [],
      activeIndex: -1,
      incompleteLine: ""
    };
    this.lastText = "";
    this.push = (text) => {
      if (text === this.lastText) return;
      const result = this.parser.push(text);
      this.lastText = text;
      this.snapshot = {
        blocks: result.blocks.slice(),
        activeIndex: result.activeIndex,
        incompleteLine: this.parser.getIncompleteLine()
      };
      for (const l of this.listeners) l();
    };
    this.subscribe = (listener) => {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    };
    this.getSnapshot = () => this.snapshot;
    this.getServerSnapshot = () => this.snapshot;
    this.getParser = () => this.parser;
    this.parser = new StreamParser(opts);
  }
};
function StreamMD({
  text,
  className,
  theme = "dark",
  components,
  onBlockComplete,
  limits,
  highlighter,
  blockPlugins,
  inlinePlugins,
  showCursor = true
}) {
  const storeRef = useRef(null);
  if (!storeRef.current) {
    storeRef.current = new ParserStore({
      ...onBlockComplete ? { onBlockComplete } : {},
      ...limits ? { limits } : {},
      ...blockPlugins ? { blockPlugins } : {}
    });
  }
  const store = storeRef.current;
  useEffect(() => {
    store.push(text);
  }, [text, store]);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const stableOverrides = useStable(components);
  const stablePlugins = useStable(inlinePlugins);
  const stableHighlighter = useStable(highlighter);
  const themeClass = theme === "none" ? "" : `smd-theme-${theme}`;
  const showCursorClass = showCursor ? "" : " smd-no-cursor";
  const { blocks, activeIndex, incompleteLine } = snapshot;
  return /* @__PURE__ */ jsxs("div", { className: `stream-md ${themeClass}${showCursorClass} ${className ?? ""}`.trim(), children: [
    blocks.map((block, idx) => {
      const isActive = idx === activeIndex && !block.closed;
      const displayBlock = isActive && incompleteLine ? {
        ...block,
        content: block.content + (block.content ? "\n" : "") + incompleteLine
      } : block;
      return /* @__PURE__ */ jsx(
        BlockRenderer,
        {
          block: displayBlock,
          isActive,
          overrides: stableOverrides,
          inlinePlugins: stablePlugins,
          highlighter: stableHighlighter,
          blockPlugins
        },
        block.id
      );
    }),
    incompleteLine && (blocks.length === 0 || blocks[blocks.length - 1].closed) && /* @__PURE__ */ jsx("div", { className: "smd-block smd-block-active", children: /* @__PURE__ */ jsx(
      ParagraphBlock,
      {
        block: {
          id: "_pending",
          type: "paragraph",
          content: incompleteLine,
          closed: false,
          meta: {}
        },
        ...stableOverrides ? { overrides: stableOverrides } : {},
        ...stablePlugins ? { inlinePlugins: stablePlugins } : {}
      }
    ) })
  ] });
}
function useStable(value) {
  const ref = useRef(value);
  return useMemo(() => {
    if (shallowEqual(ref.current, value)) return ref.current;
    ref.current = value;
    return value;
  }, [value]);
}
function shallowEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}
function BlockRenderer({
  block,
  isActive,
  overrides,
  inlinePlugins,
  highlighter,
  blockPlugins
}) {
  const wrapperClass = isActive ? "smd-block smd-block-active" : "smd-block";
  return /* @__PURE__ */ jsx("div", { className: wrapperClass, children: /* @__PURE__ */ jsx(
    BlockContent,
    {
      block,
      overrides,
      inlinePlugins,
      highlighter,
      blockPlugins,
      isActive
    }
  ) });
}
function BlockContent({
  block,
  overrides,
  inlinePlugins,
  highlighter,
  blockPlugins,
  isActive
}) {
  if (block.meta.pluginName && blockPlugins) {
    const plugin = blockPlugins.find((p) => p.name === block.meta.pluginName);
    if (plugin) return /* @__PURE__ */ jsx(Fragment, { children: plugin.render(block) });
  }
  switch (block.type) {
    case "heading":
      return /* @__PURE__ */ jsx(HeadingBlock, { block, ...overrides ? { overrides } : {}, ...inlinePlugins ? { inlinePlugins } : {} });
    case "paragraph":
      return /* @__PURE__ */ jsx(ParagraphBlock, { block, ...overrides ? { overrides } : {}, ...inlinePlugins ? { inlinePlugins } : {} });
    case "code":
      return /* @__PURE__ */ jsx(
        CodeBlockComponent,
        {
          block,
          isActive,
          ...overrides ? { overrides } : {},
          ...highlighter ? { highlighter } : {}
        }
      );
    case "list":
      return /* @__PURE__ */ jsx(ListBlock, { block, ...overrides ? { overrides } : {}, ...inlinePlugins ? { inlinePlugins } : {} });
    case "table":
      return /* @__PURE__ */ jsx(TableBlock, { block, ...overrides ? { overrides } : {}, ...inlinePlugins ? { inlinePlugins } : {} });
    case "blockquote":
      return /* @__PURE__ */ jsx(BlockquoteBlock, { block, ...overrides ? { overrides } : {}, ...inlinePlugins ? { inlinePlugins } : {} });
    case "hr":
      return /* @__PURE__ */ jsx(HorizontalRuleBlock, {});
    case "html":
      return /* @__PURE__ */ jsx(HtmlBlock, { block });
    case "math":
      return /* @__PURE__ */ jsx(ParagraphBlock, { block, ...overrides ? { overrides } : {}, ...inlinePlugins ? { inlinePlugins } : {} });
    default:
      return /* @__PURE__ */ jsx(ParagraphBlock, { block, ...overrides ? { overrides } : {}, ...inlinePlugins ? { inlinePlugins } : {} });
  }
}
function useStreamMD(options) {
  const parserRef = useRef(null);
  if (!parserRef.current) {
    parserRef.current = new StreamParser(options);
  }
  const [snapshot, setSnapshot] = useState({ blocks: [], activeIndex: -1, incompleteLine: "" });
  const push = useCallback((fullText) => {
    const parser = parserRef.current;
    const result = parser.push(fullText);
    setSnapshot({
      blocks: result.blocks.slice(),
      activeIndex: result.activeIndex,
      incompleteLine: parser.getIncompleteLine()
    });
  }, []);
  const reset = useCallback(() => {
    parserRef.current?.reset();
    setSnapshot({ blocks: [], activeIndex: -1, incompleteLine: "" });
  }, []);
  return useMemo(
    () => ({
      blocks: snapshot.blocks,
      activeIndex: snapshot.activeIndex,
      incompleteLine: snapshot.incompleteLine,
      push,
      reset
    }),
    [snapshot, push, reset]
  );
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
function StreamMDServer({
  text,
  className,
  theme = "dark"
}) {
  const blocks = parseToBlocks(text);
  const themeClass = theme === "none" ? "" : `smd-theme-${theme}`;
  return /* @__PURE__ */ jsx("div", { className: `stream-md ${themeClass} ${className ?? ""}`.trim(), children: blocks.map((b) => /* @__PURE__ */ jsx(ServerBlock, { block: b }, b.id)) });
}
function ServerBlock({ block }) {
  switch (block.type) {
    case "heading": {
      const level = block.meta.level ?? 1;
      const Tag = `h${level}`;
      return /* @__PURE__ */ jsx(Tag, { className: `smd-heading smd-h${level}`, children: /* @__PURE__ */ jsx(ServerInline, { text: block.content }) });
    }
    case "paragraph":
      return /* @__PURE__ */ jsx("p", { className: "smd-paragraph", children: /* @__PURE__ */ jsx(ServerInline, { text: block.content }) });
    case "code": {
      const lang = block.meta.language ?? "";
      const code = block.content.endsWith("\n") ? block.content.slice(0, -1) : block.content;
      const tokens = highlight(code, lang);
      return /* @__PURE__ */ jsxs("div", { className: "smd-code-block", children: [
        /* @__PURE__ */ jsx("div", { className: "smd-code-header", children: lang && /* @__PURE__ */ jsx("span", { className: "smd-code-lang", children: lang }) }),
        /* @__PURE__ */ jsx("pre", { className: "smd-pre", children: /* @__PURE__ */ jsx("code", { className: `smd-code language-${lang}`, children: tokens.map(
          (t, i) => t.className ? /* @__PURE__ */ jsx("span", { className: t.className, children: t.text }, i) : /* @__PURE__ */ jsx(React.Fragment, { children: t.text }, i)
        ) }) })
      ] });
    }
    case "list": {
      const items = parseListItems(block.content);
      const ordered = block.meta.ordered ?? false;
      const Tag = ordered ? "ol" : "ul";
      const renderItem = (item, i) => /* @__PURE__ */ jsxs("li", { className: "smd-list-item", children: [
        item.isTask !== void 0 && /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: !!item.taskChecked,
            readOnly: true,
            "aria-label": item.taskChecked ? "completed task" : "incomplete task",
            className: "smd-task-checkbox"
          }
        ),
        /* @__PURE__ */ jsx(ServerInline, { text: item.text }),
        item.children && item.children.length > 0 && /* @__PURE__ */ jsx("ul", { className: "smd-list smd-list-ul", children: item.children.map(renderItem) })
      ] }, i);
      return /* @__PURE__ */ jsx(
        Tag,
        {
          className: `smd-list smd-list-${ordered ? "ol" : "ul"}`,
          ...ordered && block.meta.start && block.meta.start !== 1 ? { start: block.meta.start } : {},
          children: items.map(renderItem)
        }
      );
    }
    case "table": {
      const { headers, rows, alignments } = parseTable(block.content);
      return /* @__PURE__ */ jsx("div", { className: "smd-table-wrapper", children: /* @__PURE__ */ jsxs("table", { className: "smd-table", children: [
        headers.length > 0 && /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: headers.map((h, i) => /* @__PURE__ */ jsx(
          "th",
          {
            className: alignments[i] && alignments[i] !== "none" ? `smd-align-${alignments[i]}` : "",
            children: /* @__PURE__ */ jsx(ServerInline, { text: h })
          },
          i
        )) }) }),
        /* @__PURE__ */ jsx("tbody", { children: rows.map((row, ri) => /* @__PURE__ */ jsx("tr", { children: row.map((cell, ci) => /* @__PURE__ */ jsx(
          "td",
          {
            className: alignments[ci] && alignments[ci] !== "none" ? `smd-align-${alignments[ci]}` : "",
            children: /* @__PURE__ */ jsx(ServerInline, { text: cell })
          },
          ci
        )) }, ri)) })
      ] }) });
    }
    case "blockquote":
      return /* @__PURE__ */ jsx("blockquote", { className: "smd-blockquote", children: /* @__PURE__ */ jsx(ServerInline, { text: block.content }) });
    case "hr":
      return /* @__PURE__ */ jsx("hr", { className: "smd-hr" });
    default:
      return /* @__PURE__ */ jsx("p", { className: "smd-paragraph", children: /* @__PURE__ */ jsx(ServerInline, { text: block.content }) });
  }
}
function ServerInline({ text }) {
  const tokens = parseInline(text, { tentative: false });
  return /* @__PURE__ */ jsx(Fragment, { children: tokens.map((t, i) => renderInline(t, i)) });
}
function renderInline(token, key) {
  switch (token.type) {
    case "text":
      return /* @__PURE__ */ jsx(React.Fragment, { children: token.content }, key);
    case "br":
      return /* @__PURE__ */ jsx("br", {}, key);
    case "bold":
      return /* @__PURE__ */ jsx("strong", { children: token.children ? token.children.map((t, i) => renderInline(t, i)) : token.content }, key);
    case "italic":
      return /* @__PURE__ */ jsx("em", { children: token.children ? token.children.map((t, i) => renderInline(t, i)) : token.content }, key);
    case "bolditalic":
      return /* @__PURE__ */ jsx("strong", { children: /* @__PURE__ */ jsx("em", { children: token.children ? token.children.map((t, i) => renderInline(t, i)) : token.content }) }, key);
    case "code":
      return /* @__PURE__ */ jsx("code", { className: "smd-inline-code", children: token.content }, key);
    case "link": {
      const safe = sanitizeUrl(token.href);
      if (!safe) return /* @__PURE__ */ jsx(React.Fragment, { children: token.content }, key);
      const isExternal = /^(https?:|mailto:|tel:)/i.test(safe);
      return /* @__PURE__ */ jsx(
        "a",
        {
          href: safe,
          ...token.title !== void 0 ? { title: token.title } : {},
          ...isExternal ? {
            target: "_blank",
            rel: "noopener noreferrer",
            referrerPolicy: "no-referrer"
          } : {},
          className: "smd-link",
          children: token.children ? token.children.map((t, i) => renderInline(t, i)) : token.content
        },
        key
      );
    }
    case "strikethrough":
      return /* @__PURE__ */ jsx("del", { children: token.children ? token.children.map((t, i) => renderInline(t, i)) : token.content }, key);
    case "image": {
      const safe = sanitizeImageUrl(token.href);
      if (!safe) return /* @__PURE__ */ jsx(React.Fragment, { children: token.content }, key);
      return /* @__PURE__ */ jsx(
        "img",
        {
          src: safe,
          alt: token.alt ?? "",
          ...token.title !== void 0 ? { title: token.title } : {},
          className: "smd-image",
          loading: "lazy",
          decoding: "async"
        },
        key
      );
    }
    default:
      return /* @__PURE__ */ jsx(React.Fragment, { children: token.content }, key);
  }
}
function AssistantMarkdown({
  message,
  always = false,
  ...rest
}) {
  if (!always && message.role !== "assistant") return null;
  const text = extractText(message);
  return /* @__PURE__ */ jsx(StreamMD, { text, ...rest });
}
function extractText(m) {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.parts)) {
    return m.parts.map((p) => {
      if (p && typeof p === "object" && "type" in p && p.type === "text") {
        return p.text ?? "";
      }
      return "";
    }).join("");
  }
  return "";
}

export { AssistantMarkdown, StreamMD, StreamMDServer, parseToBlocks, useStreamMD };
//# sourceMappingURL=next.js.map
//# sourceMappingURL=next.js.map