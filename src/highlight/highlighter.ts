// ═══════════════════════════════════════════════════════════════
// StreamMD — Lightweight Syntax Highlighter
// Top 15 languages, regex-based, ~3kB
// ═══════════════════════════════════════════════════════════════

export interface HighlightToken {
  text: string;
  className: string;
}

interface LanguageRules {
  keywords: string[];
  builtins?: string[];
  operators?: RegExp;
  strings: RegExp;
  comments: RegExp;
  numbers: RegExp;
}

const LANGS: Record<string, LanguageRules> = {
  javascript: {
    keywords: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new", "this", "class", "extends", "import", "export", "from", "default", "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of", "yield", "delete", "void", "null", "undefined", "true", "false"],
    builtins: ["console", "Promise", "Array", "Object", "Map", "Set", "JSON", "Math", "Date", "Error", "RegExp", "setTimeout", "setInterval", "fetch", "window", "document"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i,
  },
  typescript: {
    keywords: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new", "this", "class", "extends", "import", "export", "from", "default", "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "in", "of", "yield", "delete", "void", "null", "undefined", "true", "false", "type", "interface", "enum", "namespace", "declare", "abstract", "implements", "keyof", "readonly", "as", "is", "infer", "satisfies"],
    builtins: ["console", "Promise", "Array", "Object", "Map", "Set", "JSON", "Math", "Date", "Error", "RegExp", "Partial", "Required", "Pick", "Omit", "Record", "Exclude", "Extract", "ReturnType"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i,
  },
  python: {
    keywords: ["def", "class", "return", "if", "elif", "else", "for", "while", "break", "continue", "import", "from", "as", "try", "except", "finally", "raise", "with", "yield", "lambda", "pass", "del", "global", "nonlocal", "assert", "async", "await", "True", "False", "None", "and", "or", "not", "in", "is"],
    builtins: ["print", "len", "range", "type", "int", "str", "float", "list", "dict", "set", "tuple", "bool", "input", "open", "map", "filter", "zip", "enumerate", "super", "self"],
    strings: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|f"(?:[^"\\]|\\.)*"|f'(?:[^'\\]|\\.)*')/,
    comments: /(#.*$)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?|0x[\da-f]+|0b[01]+|0o[0-7]+)\b/i,
  },
  bash: {
    keywords: ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "return", "in", "select", "until", "export", "source", "local", "readonly", "declare", "unset", "set"],
    builtins: ["echo", "cd", "ls", "grep", "sed", "awk", "cat", "chmod", "chown", "cp", "mv", "rm", "mkdir", "touch", "find", "xargs", "curl", "wget", "git", "npm", "npx", "node", "python", "pip"],
    strings: /("(?:[^"\\]|\\.)*"|'[^']*')/,
    comments: /(#.*$)/m,
    numbers: /\b(\d+\.?\d*)\b/,
  },
  json: {
    keywords: ["true", "false", "null"],
    strings: /("(?:[^"\\]|\\.)*")/,
    comments: /((?:never)x)/,  // JSON has no comments
    numbers: /\b(-?\d+\.?\d*(?:e[+-]?\d+)?)\b/i,
  },
  html: {
    keywords: [],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
    comments: /(<!--[\s\S]*?-->)/,
    numbers: /\b(\d+\.?\d*)\b/,
  },
  css: {
    keywords: ["important", "inherit", "initial", "unset", "none", "auto", "block", "flex", "grid", "inline", "relative", "absolute", "fixed", "sticky"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
    comments: /(\/\*[\s\S]*?\*\/)/,
    numbers: /\b(\d+\.?\d*(?:px|em|rem|%|vh|vw|fr|s|ms|deg)?)\b/,
  },
  rust: {
    keywords: ["fn", "let", "mut", "const", "if", "else", "for", "while", "loop", "match", "return", "use", "mod", "pub", "struct", "enum", "impl", "trait", "type", "where", "async", "await", "move", "ref", "self", "super", "crate", "unsafe", "extern", "dyn", "true", "false"],
    builtins: ["println", "eprintln", "format", "vec", "String", "Vec", "Option", "Result", "Some", "None", "Ok", "Err", "Box", "Rc", "Arc"],
    strings: /("(?:[^"\\]|\\.)*")/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:_\d+)*(?:f32|f64|u8|u16|u32|u64|i8|i16|i32|i64|usize|isize)?)\b/,
  },
  go: {
    keywords: ["func", "return", "if", "else", "for", "range", "switch", "case", "default", "break", "continue", "goto", "var", "const", "type", "struct", "interface", "map", "chan", "select", "defer", "go", "package", "import", "true", "false", "nil"],
    builtins: ["fmt", "make", "len", "cap", "append", "copy", "delete", "new", "panic", "recover", "close", "error", "string", "int", "float64", "bool", "byte", "rune"],
    strings: /("(?:[^"\\]|\\.)*"|`[^`]*`)/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/i,
  },
  java: {
    keywords: ["public", "private", "protected", "static", "final", "abstract", "class", "interface", "extends", "implements", "new", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "try", "catch", "finally", "throw", "throws", "import", "package", "void", "int", "long", "double", "float", "boolean", "char", "byte", "short", "null", "true", "false", "this", "super", "instanceof"],
    builtins: ["System", "String", "Integer", "List", "ArrayList", "Map", "HashMap", "Set", "HashSet", "Optional", "Stream", "Arrays", "Collections"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
    comments: /(\/\/.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*(?:e[+-]?\d+)?[lLfFdD]?)\b/i,
  },
  sql: {
    keywords: ["SELECT", "FROM", "WHERE", "INSERT", "INTO", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "TABLE", "INDEX", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "AND", "OR", "NOT", "IN", "LIKE", "BETWEEN", "EXISTS", "NULL", "IS", "AS", "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "UNION", "ALL", "DISTINCT", "SET", "VALUES", "DEFAULT", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "CASCADE", "CONSTRAINT", "CHECK", "UNIQUE", "select", "from", "where", "insert", "into", "update", "delete", "create", "drop", "alter", "table", "join", "left", "right", "inner", "outer", "on", "and", "or", "not", "in", "like", "between", "order", "by", "group", "having", "limit", "as", "set", "values", "null", "is"],
    strings: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/,
    comments: /(--.*$|\/\*[\s\S]*?\*\/)/m,
    numbers: /\b(\d+\.?\d*)\b/,
  },
  yaml: {
    keywords: ["true", "false", "null", "yes", "no", "on", "off"],
    strings: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/,
    comments: /(#.*$)/m,
    numbers: /\b(\d+\.?\d*)\b/,
  },
  diff: {
    keywords: [],
    strings: /((?:never)x)/,
    comments: /((?:never)x)/,
    numbers: /((?:never)x)/,
  },
  markdown: {
    keywords: [],
    strings: /((?:never)x)/,
    comments: /((?:never)x)/,
    numbers: /((?:never)x)/,
  },
};

// Aliases
LANGS.js = LANGS.javascript!;
LANGS.ts = LANGS.typescript!;
LANGS.tsx = LANGS.typescript!;
LANGS.jsx = LANGS.javascript!;
LANGS.py = LANGS.python!;
LANGS.sh = LANGS.bash!;
LANGS.shell = LANGS.bash!;
LANGS.zsh = LANGS.bash!;
LANGS.yml = LANGS.yaml!;
LANGS.rs = LANGS.rust!;
LANGS.c = LANGS.java!; // Close enough for basic highlighting
LANGS.cpp = LANGS.java!;
LANGS["c++"] = LANGS.java!;

/**
 * Highlight a code string for a given language.
 * Returns an array of tokens with text + CSS class.
 */
export function highlight(code: string, language: string): HighlightToken[] {
  const lang = LANGS[language.toLowerCase()];
  if (!lang) {
    return [{ text: code, className: "" }];
  }

  // Special handling for diff
  if (language.toLowerCase() === "diff") {
    return highlightDiff(code);
  }

  const tokens: HighlightToken[] = [];
  const lines = code.split("\n");

  for (let li = 0; li < lines.length; li++) {
    if (li > 0) tokens.push({ text: "\n", className: "" });

    let line = lines[li]!;
    let pos = 0;

    while (pos < line.length) {
      const sub = line.slice(pos);
      let matched = false;

      // Comments
      const commentMatch = sub.match(lang.comments);
      if (commentMatch && commentMatch.index === 0) {
        tokens.push({ text: commentMatch[0], className: "smd-hl-comment" });
        pos += commentMatch[0].length;
        matched = true;
        continue;
      }

      // Strings
      const stringMatch = sub.match(lang.strings);
      if (stringMatch && stringMatch.index === 0) {
        tokens.push({ text: stringMatch[0], className: "smd-hl-string" });
        pos += stringMatch[0].length;
        matched = true;
        continue;
      }

      // Numbers
      const numMatch = sub.match(lang.numbers);
      if (numMatch && numMatch.index === 0) {
        tokens.push({ text: numMatch[0], className: "smd-hl-number" });
        pos += numMatch[0].length;
        continue;
      }

      // Keywords and builtins
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

      // Operators and punctuation
      if (!matched) {
        tokens.push({ text: sub[0]!, className: "smd-hl-punctuation" });
        pos++;
      }
    }
  }

  return tokens;
}

function highlightDiff(code: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) tokens.push({ text: "\n", className: "" });
    const line = lines[i]!;
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
