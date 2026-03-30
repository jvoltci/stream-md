'use strict';

var React = require('react');
var jsxRuntime = require('react/jsx-runtime');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var React__default = /*#__PURE__*/_interopDefault(React);

// src/components/StreamMD.tsx

// src/parser/StreamParser.ts
var StreamParser = class {
  constructor(options = {}) {
    this.blocks = [];
    this.buffer = "";
    this.prevLength = 0;
    this.inCodeFence = false;
    this.codeFenceChar = "";
    this.codeFenceCount = 0;
    this._incompleteLine = "";
    this._blockId = 0;
    this.options = options;
  }
  nextId() {
    return "smd-" + ++this._blockId;
  }
  /**
   * Push new text. Accepts the FULL accumulated text each time
   * (not just the delta). Internally diffs to find new content.
   */
  push(fullText) {
    if (fullText.length <= this.prevLength) {
      return { blocks: this.blocks, activeIndex: this.blocks.length - 1 };
    }
    const newContent = fullText.slice(this.prevLength);
    this.prevLength = fullText.length;
    this.buffer += newContent;
    this.parseBuffer();
    return {
      blocks: this.blocks,
      activeIndex: this.blocks.length > 0 ? this.blocks.length - 1 : -1
    };
  }
  /** Get the current incomplete line (not yet committed to a block) */
  getIncompleteLine() {
    return this._incompleteLine;
  }
  /** Reset all state */
  reset() {
    this.blocks = [];
    this.buffer = "";
    this.prevLength = 0;
    this.inCodeFence = false;
    this.codeFenceChar = "";
    this.codeFenceCount = 0;
    this._incompleteLine = "";
  }
  /** Get current blocks */
  getBlocks() {
    return this.blocks;
  }
  // ── Internal parsing ──────────────────────────────────────
  parseBuffer() {
    const lines = this.buffer.split("\n");
    const incompleteLine = this.buffer.endsWith("\n") ? "" : lines.pop();
    for (const line of lines) {
      this.processLine(line);
    }
    this._incompleteLine = incompleteLine;
    this.buffer = incompleteLine;
  }
  processLine(line) {
    if (this.inCodeFence) {
      const trimmed = line.trimStart();
      if (this.isClosingFence(trimmed)) {
        this.inCodeFence = false;
        const active3 = this.getActiveBlock();
        if (active3 && active3.type === "code") {
          active3.closed = true;
          this.options.onBlockComplete?.(active3);
        }
        return;
      }
      const active2 = this.getActiveBlock();
      if (active2) {
        active2.content += line + "\n";
      }
      return;
    }
    if (line.trim() === "") {
      this.closeActiveBlock();
      return;
    }
    const fenceMatch = line.match(/^(`{3,}|~{3,})\s*([\w+-]*)/);
    if (fenceMatch) {
      this.closeActiveBlock();
      this.inCodeFence = true;
      this.codeFenceChar = fenceMatch[1][0];
      this.codeFenceCount = fenceMatch[1].length;
      const language = fenceMatch[2] || "";
      this.startBlock("code", "", { language });
      return;
    }
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      this.closeActiveBlock();
      const level = headingMatch[1].length;
      this.startBlock("heading", headingMatch[2], { level });
      const active2 = this.getActiveBlock();
      if (active2) {
        active2.closed = true;
        this.options.onBlockComplete?.(active2);
      }
      return;
    }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      this.closeActiveBlock();
      this.startBlock("hr", "", {});
      const active2 = this.getActiveBlock();
      if (active2) {
        active2.closed = true;
        this.options.onBlockComplete?.(active2);
      }
      return;
    }
    const bqMatch = line.match(/^>\s?(.*)/);
    if (bqMatch) {
      const active2 = this.getActiveBlock();
      if (active2 && active2.type === "blockquote" && !active2.closed) {
        active2.content += (active2.content ? "\n" : "") + bqMatch[1];
      } else {
        this.closeActiveBlock();
        this.startBlock("blockquote", bqMatch[1], {});
      }
      return;
    }
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
    if (ulMatch) {
      const active2 = this.getActiveBlock();
      if (active2 && active2.type === "list" && !active2.meta.ordered && !active2.closed) {
        active2.content += "\n" + line;
      } else {
        this.closeActiveBlock();
        this.startBlock("list", line, { ordered: false });
      }
      return;
    }
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)/);
    if (olMatch) {
      const active2 = this.getActiveBlock();
      if (active2 && active2.type === "list" && active2.meta.ordered && !active2.closed) {
        active2.content += "\n" + line;
      } else {
        this.closeActiveBlock();
        this.startBlock("list", line, { ordered: true });
      }
      return;
    }
    if (line.includes("|")) {
      const active2 = this.getActiveBlock();
      if (active2 && active2.type === "table" && !active2.closed) {
        active2.content += "\n" + line;
        return;
      }
      if (active2 && active2.type === "paragraph" && !active2.closed && active2.content.includes("|")) {
        active2.type = "table";
        active2.content += "\n" + line;
        return;
      }
      if (line.trim().startsWith("|") || line.includes("|") && line.trim().match(/^[|:\-\s]+$/)) {
        this.closeActiveBlock();
        this.startBlock("table", line, {});
        return;
      }
    }
    const active = this.getActiveBlock();
    if (active && active.type === "paragraph" && !active.closed) {
      active.content += "\n" + line;
    } else {
      this.closeActiveBlock();
      this.startBlock("paragraph", line, {});
    }
  }
  isClosingFence(trimmed) {
    if (trimmed.length < this.codeFenceCount) return false;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] !== this.codeFenceChar) {
        return trimmed.slice(i).trim() === "";
      }
    }
    return true;
  }
  getActiveBlock() {
    if (this.blocks.length === 0) return null;
    const last = this.blocks[this.blocks.length - 1];
    return last.closed ? null : last;
  }
  closeActiveBlock() {
    const active = this.getActiveBlock();
    if (active) {
      active.closed = true;
      this.options.onBlockComplete?.(active);
    }
  }
  startBlock(type, content, meta) {
    this.blocks.push({
      id: this.nextId(),
      type,
      content,
      closed: false,
      meta
    });
  }
  /** Reset ID counter (for tests) */
  resetIdCounter() {
    this._blockId = 0;
  }
};

// src/parser/InlineParser.ts
function parseInline(text) {
  const tokens = [];
  let i = 0;
  let currentText = "";
  const flush = () => {
    if (currentText) {
      tokens.push({ type: "text", content: currentText });
      currentText = "";
    }
  };
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    const rest = text.slice(i);
    if (ch === "\\" && i + 1 < text.length) {
      currentText += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === "!" && next === "[") {
      const imgMatch = rest.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        flush();
        tokens.push({
          type: "image",
          content: imgMatch[1],
          alt: imgMatch[1],
          href: imgMatch[2]
        });
        i += imgMatch[0].length;
        continue;
      }
    }
    if (ch === "[") {
      const linkMatch = rest.match(/^\[([^\]]*)\]\(([^)]+)\)/);
      if (linkMatch) {
        flush();
        tokens.push({
          type: "link",
          content: linkMatch[1],
          href: linkMatch[2]
        });
        i += linkMatch[0].length;
        continue;
      }
    }
    if (ch === "`") {
      let ticks = 0;
      let j = i;
      while (j < text.length && text[j] === "`") {
        ticks++;
        j++;
      }
      const closeIdx = text.indexOf("`".repeat(ticks), j);
      if (closeIdx !== -1) {
        flush();
        tokens.push({
          type: "code",
          content: text.slice(j, closeIdx)
        });
        i = closeIdx + ticks;
        continue;
      }
      currentText += ch;
      i++;
      continue;
    }
    if ((ch === "*" || ch === "_") && next === ch && text[i + 2] === ch) {
      const marker = ch.repeat(3);
      const closeIdx = text.indexOf(marker, i + 3);
      if (closeIdx !== -1) {
        flush();
        tokens.push({
          type: "bolditalic",
          content: text.slice(i + 3, closeIdx),
          children: parseInline(text.slice(i + 3, closeIdx))
        });
        i = closeIdx + 3;
        continue;
      }
    }
    if ((ch === "*" || ch === "_") && next === ch) {
      const marker = ch.repeat(2);
      const closeIdx = text.indexOf(marker, i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        flush();
        tokens.push({
          type: "bold",
          content: text.slice(i + 2, closeIdx),
          children: parseInline(text.slice(i + 2, closeIdx))
        });
        i = closeIdx + 2;
        continue;
      }
    }
    if (ch === "*" || ch === "_") {
      const closeIdx = text.indexOf(ch, i + 1);
      if (closeIdx !== -1 && closeIdx > i + 1) {
        if (ch === "_") {
          const before = i > 0 ? text[i - 1] : " ";
          const after = closeIdx + 1 < text.length ? text[closeIdx + 1] : " ";
          if (before === " " && after === " ") {
            currentText += ch;
            i++;
            continue;
          }
        }
        flush();
        tokens.push({
          type: "italic",
          content: text.slice(i + 1, closeIdx),
          children: parseInline(text.slice(i + 1, closeIdx))
        });
        i = closeIdx + 1;
        continue;
      }
    }
    if (ch === "~" && next === "~") {
      const closeIdx = text.indexOf("~~", i + 2);
      if (closeIdx !== -1) {
        flush();
        tokens.push({
          type: "strikethrough",
          content: text.slice(i + 2, closeIdx),
          children: parseInline(text.slice(i + 2, closeIdx))
        });
        i = closeIdx + 2;
        continue;
      }
    }
    currentText += ch;
    i++;
  }
  flush();
  return tokens;
}
function InlineRenderer({ text, overrides }) {
  const tokens = parseInline(text);
  return /* @__PURE__ */ jsxRuntime.jsx(jsxRuntime.Fragment, { children: tokens.map((token, i) => renderToken(token, i, overrides)) });
}
function renderToken(token, key, overrides) {
  switch (token.type) {
    case "text":
      return /* @__PURE__ */ jsxRuntime.jsx(React__default.default.Fragment, { children: token.content }, key);
    case "bold": {
      const Strong = overrides?.strong;
      const inner = token.children ? token.children.map((t, i) => renderToken(t, i, overrides)) : token.content;
      return Strong ? /* @__PURE__ */ jsxRuntime.jsx(Strong, { children: inner }, key) : /* @__PURE__ */ jsxRuntime.jsx("strong", { children: inner }, key);
    }
    case "italic": {
      const Em = overrides?.em;
      const inner = token.children ? token.children.map((t, i) => renderToken(t, i, overrides)) : token.content;
      return Em ? /* @__PURE__ */ jsxRuntime.jsx(Em, { children: inner }, key) : /* @__PURE__ */ jsxRuntime.jsx("em", { children: inner }, key);
    }
    case "bolditalic": {
      const inner = token.children ? token.children.map((t, i) => renderToken(t, i, overrides)) : token.content;
      return /* @__PURE__ */ jsxRuntime.jsx("strong", { children: /* @__PURE__ */ jsxRuntime.jsx("em", { children: inner }) }, key);
    }
    case "code": {
      const Code = overrides?.code;
      return Code ? /* @__PURE__ */ jsxRuntime.jsx(Code, { children: token.content }, key) : /* @__PURE__ */ jsxRuntime.jsx("code", { className: "smd-inline-code", children: token.content }, key);
    }
    case "link": {
      const A = overrides?.a;
      return A ? /* @__PURE__ */ jsxRuntime.jsx(A, { href: token.href, children: token.content }, key) : /* @__PURE__ */ jsxRuntime.jsx("a", { href: token.href, target: "_blank", rel: "noopener noreferrer", className: "smd-link", children: token.content }, key);
    }
    case "strikethrough": {
      const Del = overrides?.del;
      const inner = token.children ? token.children.map((t, i) => renderToken(t, i, overrides)) : token.content;
      return Del ? /* @__PURE__ */ jsxRuntime.jsx(Del, { children: inner }, key) : /* @__PURE__ */ jsxRuntime.jsx("del", { children: inner }, key);
    }
    case "image": {
      const Img = overrides?.img;
      return Img ? /* @__PURE__ */ jsxRuntime.jsx(Img, { src: token.href, alt: token.alt || "" }, key) : /* @__PURE__ */ jsxRuntime.jsx("img", { src: token.href, alt: token.alt || "", className: "smd-image" }, key);
    }
    default:
      return /* @__PURE__ */ jsxRuntime.jsx(React__default.default.Fragment, { children: token.content }, key);
  }
}

// src/highlight/highlighter.ts
var LANGS = {
  javascript: {
    keywords: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new", "this", "class", "extends", "import", "export", "from", "default", "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of", "yield", "delete", "void", "null", "undefined", "true", "false"],
    builtins: ["console", "Promise", "Array", "Object", "Map", "Set", "JSON", "Math", "Date", "Error", "RegExp", "setTimeout", "setInterval", "fetch", "window", "document"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i
  },
  typescript: {
    keywords: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new", "this", "class", "extends", "import", "export", "from", "default", "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of", "yield", "delete", "void", "null", "undefined", "true", "false", "type", "interface", "enum", "namespace", "declare", "abstract", "implements", "keyof", "readonly", "as", "is", "infer", "satisfies"],
    builtins: ["console", "Promise", "Array", "Object", "Map", "Set", "JSON", "Math", "Date", "Error", "RegExp", "Partial", "Required", "Pick", "Omit", "Record", "Exclude", "Extract", "ReturnType"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i
  },
  python: {
    keywords: ["def", "class", "return", "if", "elif", "else", "for", "while", "break", "continue", "import", "from", "as", "try", "except", "finally", "raise", "with", "yield", "lambda", "pass", "del", "global", "nonlocal", "assert", "async", "await", "True", "False", "None", "and", "or", "not", "in", "is"],
    builtins: ["print", "len", "range", "type", "int", "str", "float", "list", "dict", "set", "tuple", "bool", "input", "open", "map", "filter", "zip", "enumerate", "super", "self"],
    strings: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|f"(?:[^"\\]|\\.)*"|f'(?:[^'\\]|\\.)*')/,
    comments: /(#.*$)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i
  },
  bash: {
    keywords: ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "return", "in", "select", "until", "export", "source", "local", "readonly", "declare", "unset", "set"],
    builtins: ["echo", "cd", "ls", "grep", "sed", "awk", "cat", "chmod", "chown", "cp", "mv", "rm", "mkdir", "touch", "find", "xargs", "curl", "wget", "git", "npm", "npx", "node", "python", "pip"],
    strings: /("(?:[^"\\]|\\.)*"|'[^']*')/,
    comments: /(#.*$)/m,
    numbers: /\b(\d+\.?\d*)\b/
  },
  json: {
    keywords: ["true", "false", "null"],
    strings: /("(?:[^"\\]|\\.)*")/,
    comments: /((?:never)x)/,
    // JSON has no comments
    numbers: /\b(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/i
  },
  html: {
    keywords: [],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
    comments: /(<!--[\s\S]*?-->)/,
    numbers: /\b(\d+\.?\d*)\b/
  },
  css: {
    keywords: ["important", "inherit", "initial", "unset", "none", "auto", "block", "flex", "grid", "inline", "relative", "absolute", "fixed", "sticky"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
    comments: /(\/\*[\s\S]*?\*\/)/,
    numbers: /\b(\d+\.?\d*(?:px|em|rem|%|vh|vw|fr|s|ms|deg)?)\b/
  },
  rust: {
    keywords: ["fn", "let", "mut", "const", "if", "else", "for", "while", "loop", "match", "return", "use", "mod", "pub", "struct", "enum", "impl", "trait", "type", "where", "async", "await", "move", "ref", "self", "super", "crate", "unsafe", "extern", "dyn", "true", "false"],
    builtins: ["println", "eprintln", "format", "vec", "String", "Vec", "Option", "Result", "Some", "None", "Ok", "Err", "Box", "Rc", "Arc"],
    strings: /("(?:[^"\\]|\\.)*")/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:_\d+)*(?:f32|f64|u8|u16|u32|u64|i8|i16|i32|i64|usize|isize)?)\b/
  },
  go: {
    keywords: ["func", "return", "if", "else", "for", "range", "switch", "case", "default", "break", "continue", "goto", "var", "const", "type", "struct", "interface", "map", "chan", "select", "defer", "go", "package", "import", "true", "false", "nil"],
    builtins: ["fmt", "make", "len", "cap", "append", "copy", "delete", "new", "panic", "recover", "close", "error", "string", "int", "float64", "bool", "byte", "rune"],
    strings: /("(?:[^"\\]|\\.)*"|`[^`]*`)/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/i
  },
  java: {
    keywords: ["public", "private", "protected", "static", "final", "abstract", "class", "interface", "extends", "implements", "new", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "try", "catch", "finally", "throw", "throws", "import", "package", "void", "int", "long", "double", "float", "boolean", "char", "byte", "short", "null", "true", "false", "this", "super", "instanceof"],
    builtins: ["System", "String", "Integer", "List", "ArrayList", "Map", "HashMap", "Set", "HashSet", "Optional", "Stream", "Arrays", "Collections"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?[lLfFdD]?)\b/i
  },
  sql: {
    keywords: ["SELECT", "FROM", "WHERE", "INSERT", "INTO", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "TABLE", "INDEX", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN", "EXISTS", "NULL", "IS", "AS", "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT", "SET", "VALUES", "DEFAULT", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CASCADE", "CONSTRAINT", "CHECK", "UNIQUE", "select", "from", "where", "insert", "into", "update", "delete", "create", "drop", "alter", "table", "join", "left", "right", "inner", "outer", "on", "and", "or", "not", "in", "like", "between", "order", "by", "group", "having", "limit", "as", "set", "values", "null", "is"],
    strings: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/,
    comments: /(--.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*)\b/
  },
  yaml: {
    keywords: ["true", "false", "null", "yes", "no", "on", "off"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
    comments: /(#.*$)/m,
    numbers: /\b(\d+\.?\d*)\b/
  },
  diff: {
    keywords: [],
    strings: /((?:never)x)/,
    comments: /((?:never)x)/,
    numbers: /((?:never)x)/
  },
  markdown: {
    keywords: [],
    strings: /((?:never)x)/,
    comments: /((?:never)x)/,
    numbers: /((?:never)x)/
  }
};
LANGS.js = LANGS.javascript;
LANGS.ts = LANGS.typescript;
LANGS.tsx = LANGS.typescript;
LANGS.jsx = LANGS.javascript;
LANGS.py = LANGS.python;
LANGS.sh = LANGS.bash;
LANGS.shell = LANGS.bash;
LANGS.zsh = LANGS.bash;
LANGS.yml = LANGS.yaml;
LANGS.rs = LANGS.rust;
LANGS.c = LANGS.java;
LANGS.cpp = LANGS.java;
LANGS["c++"] = LANGS.java;
function highlight(code, language) {
  const lang = LANGS[language.toLowerCase()];
  if (!lang) {
    return [{ text: code, className: "" }];
  }
  if (language.toLowerCase() === "diff") {
    return highlightDiff(code);
  }
  const tokens = [];
  const lines = code.split("\n");
  for (let li = 0; li < lines.length; li++) {
    if (li > 0) tokens.push({ text: "\n", className: "" });
    let line = lines[li];
    let pos = 0;
    while (pos < line.length) {
      const sub = line.slice(pos);
      let matched = false;
      const commentMatch = sub.match(lang.comments);
      if (commentMatch && commentMatch.index === 0) {
        tokens.push({ text: commentMatch[0], className: "smd-hl-comment" });
        pos += commentMatch[0].length;
        matched = true;
        continue;
      }
      const stringMatch = sub.match(lang.strings);
      if (stringMatch && stringMatch.index === 0) {
        tokens.push({ text: stringMatch[0], className: "smd-hl-string" });
        pos += stringMatch[0].length;
        matched = true;
        continue;
      }
      const numMatch = sub.match(lang.numbers);
      if (numMatch && numMatch.index === 0) {
        tokens.push({ text: numMatch[0], className: "smd-hl-number" });
        pos += numMatch[0].length;
        continue;
      }
      const wordMatch = sub.match(/^[\w$]+/);
      if (wordMatch) {
        const word = wordMatch[0];
        if (lang.keywords.includes(word)) {
          tokens.push({ text: word, className: "smd-hl-keyword" });
        } else if (lang.builtins?.includes(word)) {
          tokens.push({ text: word, className: "smd-hl-builtin" });
        } else {
          tokens.push({ text: word, className: "" });
        }
        pos += word.length;
        continue;
      }
      if (!matched) {
        tokens.push({ text: sub[0], className: "smd-hl-punctuation" });
        pos++;
      }
    }
  }
  return tokens;
}
function highlightDiff(code) {
  const tokens = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) tokens.push({ text: "\n", className: "" });
    const line = lines[i];
    if (line.startsWith("+")) {
      tokens.push({ text: line, className: "smd-hl-inserted" });
    } else if (line.startsWith("-")) {
      tokens.push({ text: line, className: "smd-hl-deleted" });
    } else if (line.startsWith("@@")) {
      tokens.push({ text: line, className: "smd-hl-info" });
    } else {
      tokens.push({ text: line, className: "" });
    }
  }
  return tokens;
}
var HeadingBlock = React.memo(function HeadingBlock2({ block, overrides }) {
  const level = block.meta.level || 1;
  const Tag = `h${level}`;
  const className = `smd-heading smd-h${level}`;
  return /* @__PURE__ */ jsxRuntime.jsx(Tag, { className, children: /* @__PURE__ */ jsxRuntime.jsx(InlineRenderer, { text: block.content, overrides }) });
});
var ParagraphBlock = React.memo(function ParagraphBlock2({ block, overrides }) {
  return /* @__PURE__ */ jsxRuntime.jsx("p", { className: "smd-paragraph", children: /* @__PURE__ */ jsxRuntime.jsx(InlineRenderer, { text: block.content, overrides }) });
});
var CodeBlockComponent = React.memo(function CodeBlockComponent2({ block, overrides }) {
  const language = block.meta.language || "";
  const code = block.content.endsWith("\n") ? block.content.slice(0, -1) : block.content;
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    });
  }, [code]);
  const Pre = overrides?.pre;
  if (Pre) {
    return /* @__PURE__ */ jsxRuntime.jsx(Pre, { block, language, code });
  }
  const tokens = highlight(code, language);
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "smd-code-block", children: [
    /* @__PURE__ */ jsxRuntime.jsxs("div", { className: "smd-code-header", children: [
      language && /* @__PURE__ */ jsxRuntime.jsx("span", { className: "smd-code-lang", children: language }),
      /* @__PURE__ */ jsxRuntime.jsx(
        "button",
        {
          className: "smd-code-copy",
          onClick: handleCopy,
          "aria-label": "Copy code",
          children: copied ? "\u2713 Copied" : "Copy"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntime.jsx("pre", { className: "smd-pre", children: /* @__PURE__ */ jsxRuntime.jsx("code", { className: `smd-code language-${language}`, children: tokens.map(
      (t, i) => t.className ? /* @__PURE__ */ jsxRuntime.jsx("span", { className: t.className, children: t.text }, i) : /* @__PURE__ */ jsxRuntime.jsx(React__default.default.Fragment, { children: t.text }, i)
    ) }) })
  ] });
});
var ListBlock = React.memo(function ListBlock2({ block, overrides }) {
  const ordered = block.meta.ordered || false;
  const items = parseListItems(block.content);
  const Tag = ordered ? "ol" : "ul";
  return /* @__PURE__ */ jsxRuntime.jsx(Tag, { className: `smd-list smd-list-${ordered ? "ol" : "ul"}`, children: items.map((item, i) => /* @__PURE__ */ jsxRuntime.jsxs("li", { className: "smd-list-item", children: [
    item.isTask !== void 0 && /* @__PURE__ */ jsxRuntime.jsx(
      "input",
      {
        type: "checkbox",
        checked: item.isTask,
        readOnly: true,
        className: "smd-task-checkbox"
      }
    ),
    /* @__PURE__ */ jsxRuntime.jsx(InlineRenderer, { text: item.text, overrides })
  ] }, i)) });
});
function parseListItems(content) {
  const lines = content.split("\n");
  const items = [];
  for (const line of lines) {
    const match = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)/);
    if (match) {
      let text = match[1];
      let isTask;
      const taskMatch = text.match(/^\[([ xX])\]\s+(.*)/);
      if (taskMatch) {
        isTask = taskMatch[1] !== " ";
        text = taskMatch[2];
      }
      items.push({ text, isTask });
    }
  }
  return items;
}
var TableBlock = React.memo(function TableBlock2({ block, overrides }) {
  const { headers, rows, alignments } = parseTable(block.content);
  const Tbl = overrides?.table;
  if (Tbl) {
    return /* @__PURE__ */ jsxRuntime.jsx(Tbl, { block, headers, rows, alignments });
  }
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: "smd-table-wrapper", children: /* @__PURE__ */ jsxRuntime.jsxs("table", { className: "smd-table", children: [
    headers.length > 0 && /* @__PURE__ */ jsxRuntime.jsx("thead", { children: /* @__PURE__ */ jsxRuntime.jsx("tr", { children: headers.map((h, i) => /* @__PURE__ */ jsxRuntime.jsx("th", { style: { textAlign: alignments[i] || "left" }, children: /* @__PURE__ */ jsxRuntime.jsx(InlineRenderer, { text: h, overrides }) }, i)) }) }),
    /* @__PURE__ */ jsxRuntime.jsx("tbody", { children: rows.map((row, ri) => /* @__PURE__ */ jsxRuntime.jsx("tr", { children: row.map((cell, ci) => /* @__PURE__ */ jsxRuntime.jsx("td", { style: { textAlign: alignments[ci] || "left" }, children: /* @__PURE__ */ jsxRuntime.jsx(InlineRenderer, { text: cell, overrides }) }, ci)) }, ri)) })
  ] }) });
});
function parseTable(content) {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], alignments: [] };
  const parseCells = (line) => line.split("|").map((s) => s.trim()).filter(
    (_, i, arr) => (
      // Filter empty first/last from leading/trailing |
      !((i === 0 || i === arr.length - 1) && arr[i]?.trim() === "")
    )
  );
  const headers = parseCells(lines[0]);
  let alignments = [];
  let dataStart = 1;
  if (lines.length > 1 && /^[\s|:\-]+$/.test(lines[1])) {
    const aligns = parseCells(lines[1]);
    alignments = aligns.map((a) => {
      const t = a.trim();
      if (t.startsWith(":") && t.endsWith(":")) return "center";
      if (t.endsWith(":")) return "right";
      return "left";
    });
    dataStart = 2;
  }
  const rows = lines.slice(dataStart).map(parseCells);
  return { headers, rows, alignments };
}
var BlockquoteBlock = React.memo(function BlockquoteBlock2({ block, overrides }) {
  return /* @__PURE__ */ jsxRuntime.jsx("blockquote", { className: "smd-blockquote", children: /* @__PURE__ */ jsxRuntime.jsx(InlineRenderer, { text: block.content, overrides }) });
});
var HorizontalRuleBlock = React.memo(function HorizontalRuleBlock2() {
  return /* @__PURE__ */ jsxRuntime.jsx("hr", { className: "smd-hr" });
});
function StreamMD({
  text,
  className,
  theme = "dark",
  components,
  onBlockComplete
}) {
  const parserRef = React.useRef(null);
  if (!parserRef.current) {
    parserRef.current = new StreamParser({ onBlockComplete });
  }
  const { blocks, activeIndex, incompleteLine } = React.useMemo(() => {
    const parser = parserRef.current;
    const result = parser.push(text);
    return {
      ...result,
      incompleteLine: parser.getIncompleteLine()
    };
  }, [text]);
  const themeClass = theme === "none" ? "" : `smd-theme-${theme}`;
  return /* @__PURE__ */ jsxRuntime.jsxs("div", { className: `stream-md ${themeClass} ${className || ""}`.trim(), children: [
    blocks.map((block, idx) => {
      const isActive = idx === activeIndex && !block.closed;
      const displayBlock = isActive && incompleteLine ? { ...block, content: block.content + (block.content ? "\n" : "") + incompleteLine } : block;
      return /* @__PURE__ */ jsxRuntime.jsx(
        BlockRenderer,
        {
          block: displayBlock,
          isActive,
          overrides: components
        },
        block.id
      );
    }),
    incompleteLine && (blocks.length === 0 || blocks[blocks.length - 1].closed) && /* @__PURE__ */ jsxRuntime.jsx("div", { className: "smd-block smd-block-active", children: /* @__PURE__ */ jsxRuntime.jsx(
      ParagraphBlock,
      {
        block: { id: "_pending", type: "paragraph", content: incompleteLine, closed: false, meta: {} },
        overrides: components
      }
    ) })
  ] });
}
function BlockRenderer({ block, isActive, overrides }) {
  const wrapperClass = isActive ? "smd-block smd-block-active" : "smd-block";
  return /* @__PURE__ */ jsxRuntime.jsx("div", { className: wrapperClass, children: /* @__PURE__ */ jsxRuntime.jsx(BlockContent, { block, overrides }) });
}
function BlockContent({
  block,
  overrides
}) {
  switch (block.type) {
    case "heading":
      return /* @__PURE__ */ jsxRuntime.jsx(HeadingBlock, { block, overrides });
    case "paragraph":
      return /* @__PURE__ */ jsxRuntime.jsx(ParagraphBlock, { block, overrides });
    case "code":
      return /* @__PURE__ */ jsxRuntime.jsx(CodeBlockComponent, { block, overrides });
    case "list":
      return /* @__PURE__ */ jsxRuntime.jsx(ListBlock, { block, overrides });
    case "table":
      return /* @__PURE__ */ jsxRuntime.jsx(TableBlock, { block, overrides });
    case "blockquote":
      return /* @__PURE__ */ jsxRuntime.jsx(BlockquoteBlock, { block, overrides });
    case "hr":
      return /* @__PURE__ */ jsxRuntime.jsx(HorizontalRuleBlock, {});
    default:
      return /* @__PURE__ */ jsxRuntime.jsx(ParagraphBlock, { block, overrides });
  }
}
function useStreamMD(options) {
  const parserRef = React.useRef(null);
  const [result, setResult] = React.useState({
    blocks: [],
    activeIndex: -1,
    incompleteLine: ""
  });
  if (!parserRef.current) {
    parserRef.current = new StreamParser(options);
  }
  const push = React.useCallback((fullText) => {
    const parser = parserRef.current;
    const newResult = parser.push(fullText);
    setResult({
      blocks: [...newResult.blocks],
      activeIndex: newResult.activeIndex,
      incompleteLine: parser.getIncompleteLine()
    });
  }, []);
  const reset = React.useCallback(() => {
    parserRef.current?.reset();
    setResult({ blocks: [], activeIndex: -1, incompleteLine: "" });
  }, []);
  return React.useMemo(
    () => ({
      blocks: result.blocks,
      activeIndex: result.activeIndex,
      incompleteLine: result.incompleteLine,
      push,
      reset
    }),
    [result, push, reset]
  );
}

exports.StreamMD = StreamMD;
exports.StreamParser = StreamParser;
exports.highlight = highlight;
exports.parseInline = parseInline;
exports.useStreamMD = useStreamMD;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map