/**
 * Lightweight regex-based syntax highlighter (~3kB).
 *
 * Trades absolute correctness for tiny bundle size. For production-grade
 * highlighting, opt into the Shiki adapter via `stream-md/shiki`.
 *
 * Design notes:
 * - `Set`-based keyword/builtin lookup (O(1) per word).
 * - Keywords are suppressed after `.` so `obj.return` stays plain.
 * - Per-line tokenization, but multi-line strings (Python `"""…"""`,
 *   JS template literals, JSDoc comments) are detected before line split.
 */

export interface HighlightToken {
  text: string;
  className: string;
}

interface LangSpec {
  keywords: Set<string>;
  builtins?: Set<string>;
  /** Regex matched at the start of `sub` (i.e. anchored at current pos). */
  comments: RegExp[];
  strings: RegExp[];
  numbers: RegExp;
  /** True for languages where `.` precedes a property access. */
  memberAccess?: boolean;
  /** Optional JSX/TSX tag detection. */
  jsx?: boolean;
}

const set = (...arr: string[]): Set<string> => new Set(arr);

const JS_KW = set(
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "do", "switch", "case", "break", "continue", "new", "this", "class",
  "extends", "import", "export", "from", "default", "async", "await", "try",
  "catch", "finally", "throw", "typeof", "instanceof", "in", "of", "yield",
  "delete", "void", "null", "undefined", "true", "false", "static", "super",
  "get", "set",
);
const JS_BI = set(
  "console", "Promise", "Array", "Object", "Map", "Set", "WeakMap", "WeakSet",
  "JSON", "Math", "Date", "Error", "RegExp", "Symbol", "BigInt", "setTimeout",
  "setInterval", "clearTimeout", "clearInterval", "fetch", "window", "document",
  "globalThis", "process", "Buffer",
);
const TS_KW = set(
  ...JS_KW, "type", "interface", "enum", "namespace", "declare", "abstract",
  "implements", "keyof", "readonly", "as", "is", "infer", "satisfies", "public",
  "private", "protected", "override", "out", "never", "unknown", "any",
);
const TS_BI = set(
  ...JS_BI, "Partial", "Required", "Pick", "Omit", "Record", "Exclude",
  "Extract", "ReturnType", "Awaited", "Readonly", "NonNullable", "Parameters",
  "ConstructorParameters", "InstanceType", "ThisType",
);

const JS_LIKE: Pick<LangSpec, "comments" | "strings" | "numbers" | "memberAccess" | "jsx"> = {
  comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
  strings: [
    /^"(?:[^"\\\n]|\\.)*"/,
    /^'(?:[^'\\\n]|\\.)*'/,
    /^`(?:[^`\\]|\\.)*`/,
  ],
  numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i,
  memberAccess: true,
};

const PY_KW = set(
  "def", "class", "return", "if", "elif", "else", "for", "while", "break",
  "continue", "import", "from", "as", "try", "except", "finally", "raise",
  "with", "yield", "lambda", "pass", "del", "global", "nonlocal", "assert",
  "async", "await", "True", "False", "None", "and", "or", "not", "in", "is",
);
const PY_BI = set(
  "print", "len", "range", "type", "int", "str", "float", "list", "dict",
  "set", "tuple", "bool", "input", "open", "map", "filter", "zip",
  "enumerate", "super", "self", "cls", "isinstance", "hasattr", "getattr",
  "setattr", "abs", "min", "max", "sum", "any", "all", "sorted", "reversed",
);

const RUST_KW = set(
  "fn", "let", "mut", "const", "static", "if", "else", "for", "while", "loop",
  "match", "return", "use", "mod", "pub", "struct", "enum", "impl", "trait",
  "type", "where", "async", "await", "move", "ref", "self", "Self", "super",
  "crate", "unsafe", "extern", "dyn", "true", "false", "as", "in", "break",
  "continue",
);
const RUST_BI = set(
  "println", "eprintln", "print", "format", "vec", "String", "Vec", "Option",
  "Result", "Some", "None", "Ok", "Err", "Box", "Rc", "Arc", "RefCell", "Mutex",
  "HashMap", "HashSet", "BTreeMap", "BTreeSet", "i8", "i16", "i32", "i64",
  "i128", "u8", "u16", "u32", "u64", "u128", "f32", "f64", "bool", "char",
  "usize", "isize", "str",
);

const GO_KW = set(
  "func", "return", "if", "else", "for", "range", "switch", "case", "default",
  "break", "continue", "goto", "var", "const", "type", "struct", "interface",
  "map", "chan", "select", "defer", "go", "package", "import", "true", "false",
  "nil",
);
const GO_BI = set(
  "fmt", "make", "len", "cap", "append", "copy", "delete", "new", "panic",
  "recover", "close", "error", "string", "int", "int32", "int64", "float32",
  "float64", "bool", "byte", "rune", "uint", "uint8", "uint16", "uint32",
  "uint64", "complex64", "complex128",
);

const JAVA_KW = set(
  "public", "private", "protected", "static", "final", "abstract", "class",
  "interface", "extends", "implements", "new", "return", "if", "else", "for",
  "while", "do", "switch", "case", "default", "break", "continue", "try",
  "catch", "finally", "throw", "throws", "import", "package", "void", "int",
  "long", "double", "float", "boolean", "char", "byte", "short", "null",
  "true", "false", "this", "super", "instanceof", "synchronized", "volatile",
  "transient", "enum", "record", "sealed", "non-sealed", "permits", "yield",
);
const JAVA_BI = set(
  "System", "String", "Integer", "Long", "Double", "Float", "Boolean",
  "Character", "List", "ArrayList", "Map", "HashMap", "Set", "HashSet",
  "Optional", "Stream", "Arrays", "Collections", "Math", "Object",
);

const C_KW = set(
  "auto", "break", "case", "char", "const", "continue", "default", "do",
  "double", "else", "enum", "extern", "float", "for", "goto", "if", "inline",
  "int", "long", "register", "restrict", "return", "short", "signed", "sizeof",
  "static", "struct", "switch", "typedef", "union", "unsigned", "void",
  "volatile", "while", "_Bool", "_Complex", "_Imaginary",
);
const CPP_KW = set(
  ...C_KW, "alignas", "alignof", "and", "and_eq", "asm", "atomic_cancel",
  "atomic_commit", "atomic_noexcept", "auto", "bitand", "bitor", "bool",
  "catch", "char16_t", "char32_t", "class", "compl", "concept", "constexpr",
  "const_cast", "co_await", "co_return", "co_yield", "decltype", "delete",
  "dynamic_cast", "explicit", "export", "false", "friend", "mutable",
  "namespace", "new", "noexcept", "not", "not_eq", "nullptr", "operator",
  "or", "or_eq", "private", "protected", "public", "reinterpret_cast",
  "requires", "static_assert", "static_cast", "synchronized", "template",
  "this", "thread_local", "throw", "true", "try", "typeid", "typename",
  "using", "virtual", "wchar_t", "xor", "xor_eq",
);
const C_BI = set(
  "printf", "scanf", "fprintf", "fscanf", "sprintf", "sscanf", "fopen",
  "fclose", "fread", "fwrite", "malloc", "calloc", "realloc", "free", "memcpy",
  "memset", "strlen", "strcpy", "strncpy", "strcmp", "strncmp", "strcat",
  "size_t", "ssize_t", "FILE", "NULL", "stdin", "stdout", "stderr",
);

const BASH_KW = set(
  "if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case",
  "esac", "function", "return", "in", "select", "until", "export", "source",
  "local", "readonly", "declare", "unset", "set",
);
const BASH_BI = set(
  "echo", "cd", "ls", "grep", "sed", "awk", "cat", "chmod", "chown", "cp",
  "mv", "rm", "mkdir", "touch", "find", "xargs", "curl", "wget", "git", "npm",
  "npx", "node", "python", "pip", "docker", "kubectl", "ssh", "scp", "tar",
  "zip", "unzip", "head", "tail", "less", "more", "wc", "sort", "uniq", "tr",
);

const SQL_KW = set(
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "UPDATE", "DELETE", "CREATE",
  "DROP", "ALTER", "TABLE", "INDEX", "VIEW", "JOIN", "LEFT", "RIGHT", "INNER",
  "OUTER", "FULL", "CROSS", "ON", "USING", "AND", "OR", "NOT", "IN", "LIKE",
  "ILIKE", "BETWEEN", "EXISTS", "NULL", "IS", "AS", "ORDER", "BY", "GROUP",
  "HAVING", "LIMIT", "OFFSET", "UNION", "INTERSECT", "EXCEPT", "ALL",
  "DISTINCT", "SET", "VALUES", "DEFAULT", "PRIMARY", "KEY", "FOREIGN",
  "REFERENCES", "CASCADE", "CONSTRAINT", "CHECK", "UNIQUE", "WITH", "CASE",
  "WHEN", "THEN", "END", "ELSE",
);

const YAML_KW = set("true", "false", "null", "yes", "no", "on", "off", "True", "False", "Null", "None", "TRUE", "FALSE", "NULL");

const CSS_KW = set(
  "important", "inherit", "initial", "unset", "revert", "auto", "none",
  "block", "inline", "flex", "grid", "inline-block", "inline-flex",
  "inline-grid", "relative", "absolute", "fixed", "sticky", "static",
);

const LANGS: Record<string, LangSpec> = {
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
      /^[rRbBuUfF]?'(?:[^'\\\n]|\\.)*'/,
    ],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?(?:j|J)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i,
    memberAccess: true,
  },
  rust: {
    keywords: RUST_KW,
    builtins: RUST_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^r#"[\s\S]*?"#/, /^b"(?:[^"\\\n]|\\.)*"/],
    numbers: /^(\d+(?:_\d+)*\.?\d*(?:e[+-]?\d+)?(?:f32|f64|u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize)?)\b/i,
    memberAccess: true,
  },
  go: {
    keywords: GO_KW,
    builtins: GO_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^`[\s\S]*?`/],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?)\b/i,
    memberAccess: true,
  },
  java: {
    keywords: JAVA_KW,
    builtins: JAVA_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?[lLfFdD]?)\b/i,
    memberAccess: true,
  },
  c: {
    keywords: C_KW,
    builtins: C_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?[uUlLfF]*|0x[\da-f]+[uUlL]*)\b/i,
    memberAccess: true,
  },
  cpp: {
    keywords: CPP_KW,
    builtins: C_BI,
    comments: [/^\/\/[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/, /^R"\([\s\S]*?\)"/],
    numbers: /^(\d+\.?\d*(?:e[+-]?\d+)?[uUlLfF]*|0x[\da-f]+[uUlL]*)\b/i,
    memberAccess: true,
  },
  bash: {
    keywords: BASH_KW,
    builtins: BASH_BI,
    comments: [/^#[^\n]*/],
    strings: [/^"(?:[^"\\]|\\.)*"/, /^'[^']*'/],
    numbers: /^(\d+\.?\d*)\b/,
  },
  sql: {
    keywords: new Set([...SQL_KW, ...Array.from(SQL_KW).map((k) => k.toLowerCase())]),
    comments: [/^--[^\n]*/, /^\/\*[\s\S]*?\*\//],
    strings: [/^'(?:[^'\\\n]|\\.)*'/, /^"(?:[^"\\\n]|\\.)*"/],
    numbers: /^(\d+\.?\d*)\b/,
  },
  yaml: {
    keywords: YAML_KW,
    comments: [/^#[^\n]*/],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/i,
  },
  json: {
    keywords: set("true", "false", "null"),
    comments: [],
    strings: [/^"(?:[^"\\\n]|\\.)*"/],
    numbers: /^(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/i,
  },
  html: {
    keywords: new Set<string>(),
    comments: [/^<!--[\s\S]*?-->/],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(\d+\.?\d*)\b/,
  },
  css: {
    keywords: CSS_KW,
    comments: [/^\/\*[\s\S]*?\*\//],
    strings: [/^"(?:[^"\\\n]|\\.)*"/, /^'(?:[^'\\\n]|\\.)*'/],
    numbers: /^(-?\d+\.?\d*(?:px|em|rem|%|vh|vw|vmin|vmax|fr|s|ms|deg|rad|turn|pt|cm|mm|in)?)\b/,
  },
  markdown: {
    keywords: new Set<string>(),
    comments: [],
    strings: [],
    numbers: /^a^/,
  },
};

const ALIASES: Record<string, string> = {
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
  md: "markdown",
};

/** Highlight a code string for a given language. */
export function highlight(code: string, language: string): HighlightToken[] {
  if (!code) return [];
  const lang = (language || "").toLowerCase().trim();
  const resolved = ALIASES[lang] ?? lang;

  if (resolved === "diff") {
    // Loaded lazily to keep this file tree-shakeable.
    // Importing here would create a cycle; use the dedicated entry instead.
    return highlightDiff(code);
  }
  if (resolved === "markdown") {
    return highlightMarkdown(code);
  }

  const spec = LANGS[resolved];
  if (!spec) return [{ text: code, className: "" }];

  const tokens: HighlightToken[] = [];
  let pos = 0;
  let lastWasDot = false;

  while (pos < code.length) {
    const sub = code.slice(pos);

    // Newline → preserve verbatim.
    if (sub.startsWith("\n")) {
      tokens.push({ text: "\n", className: "" });
      pos++;
      lastWasDot = false;
      continue;
    }

    // Whitespace.
    const wsMatch = sub.match(/^[ \t]+/);
    if (wsMatch) {
      tokens.push({ text: wsMatch[0], className: "" });
      pos += wsMatch[0].length;
      continue;
    }

    // Comments.
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

    // Strings.
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

    // JSX tags.
    if (spec.jsx) {
      const tagOpen = sub.match(/^<\/?[A-Za-z][\w.-]*/);
      if (tagOpen) {
        tokens.push({ text: tagOpen[0], className: "smd-hl-tag" });
        pos += tagOpen[0].length;
        lastWasDot = false;
        continue;
      }
    }

    // Numbers.
    const numMatch = sub.match(spec.numbers);
    if (numMatch && numMatch.index === 0) {
      tokens.push({ text: numMatch[0], className: "smd-hl-number" });
      pos += numMatch[0].length;
      lastWasDot = false;
      continue;
    }

    // Words: keywords + builtins (with member-access suppression).
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

    // Punctuation / operators.
    const ch = sub[0]!;
    if (ch === ".") {
      lastWasDot = true;
    } else if (ch !== " " && ch !== "\t") {
      lastWasDot = false;
    }
    tokens.push({ text: ch, className: "smd-hl-punctuation" });
    pos++;
  }

  return tokens;
}

import { highlightDiff } from "./diff";

function highlightMarkdown(code: string): HighlightToken[] {
  const out: HighlightToken[] = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) out.push({ text: "\n", className: "" });
    const line = lines[i]!;
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
