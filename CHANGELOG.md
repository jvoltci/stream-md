# Changelog

This file is maintained by [Changesets](https://github.com/changesets/changesets).
Entries are appended automatically on release.

## 0.2.0 — Unreleased

### Major changes

- **Architecture**: split into sub-paths so consumers tree-shake what they don't use:
  - `stream-md` (default — React)
  - `stream-md/core` (framework-agnostic, no React)
  - `stream-md/server` (RSC-safe parser)
  - `stream-md/next` (Next.js helpers)
  - `stream-md/strict` (opt-in micromark adapter for full CommonMark + GFM)
  - `stream-md/shiki`, `stream-md/katex`, `stream-md/mermaid` (lazy adapters)
  - `stream-md/plugins` (public plugin API)
- **First-class Next.js**: `"use client"` banners on every client entry; `<StreamMDServer>` for RSC; `<AssistantMarkdown>` for Vercel AI SDK; Edge-runtime safe.
- **Plugin API**: public `BlockPlugin` + `InlinePlugin` interfaces for math/diagrams/custom blocks.
- **Speculative inline closure**: unclosed `**`/`*`/`` ` ``/`~~` at the trailing edge render as tentative formatting (`data-tentative="true"`), eliminating flicker when the closing run finally arrives.

### Security

- **URL sanitizer** rejects `javascript:`, `vbscript:`, and unsafe `data:` URIs by default. Control characters can no longer smuggle a dangerous scheme.
- **`data:image/...;base64,...`** is the only `data:` form allowed (for images only).
- **Hard limits**: 1 MB document cap, 4-level inline recursion cap, defended against parser DoS.
- **CSP-safe**: table cell alignment via classes, no inline `style` attributes.
- **External links** get `referrerPolicy="no-referrer"` in addition to `rel="noopener noreferrer"`.

### Correctness

- Setext headings (`===` / `---` underline)
- HR vs setext-H2 disambiguation
- Tables only commit when the separator row arrives (no more spurious tables from a paragraph containing `|`)
- Headings stay open until the next block (no more snap-closing mid-stream)
- Lists capture nesting via indent
- Indented code blocks (4-space)
- Hard line breaks (`  \n` and `\\\n`)
- Code-fence info string supports attributes (`ts {1,3}`, `python title="x.py"`)
- Inline code: smallest-matching backtick run per CommonMark
- Bold/italic: CommonMark left/right flank rules
- Link URLs: balanced parens, optional title
- Autolinks `<https://...>` and `<user@host>`
- Backslash escapes
- Streaming-equivalence property: streaming a document char-by-char produces the same final AST as atomic parsing (verified by fast-check property test).

### Performance

- Active code block renders plain `<code>` while streaming; highlights only once on close.
- Block memoization is now actually working (overrides + plugin arrays are identity-stabilized in the React layer).
- `useSyncExternalStore` replaces side-effecting `useMemo` (StrictMode-safe).
- Parsed structure (table cells, list items) cached on `block.meta.parsed` once on close.

### Highlighting

- `Set`-based keyword/builtin lookup
- Member-access keyword suppression (`obj.return` no longer highlights `return`)
- Real C/C++ tables (no longer aliased to Java)
- Real Markdown highlighter
- JSX/TSX tag detection
- Multi-line strings handled (Python `"""..."""`, JS template literals, JSDoc)

### Themes

- New: Catppuccin (Mocha + Latte), Tokyo Night (+ Storm), GitHub (Dark + Light), Solarized (Dark + Light)

### Tooling

- Vitest + RTL + jsdom test setup
- fast-check property tests for streaming equivalence
- ESLint flat config
- Prettier
- size-limit budgets (12 KB gz default, 5 KB gz /core)
- GitHub Actions CI: typecheck, lint, test, build, size on Node 18/20/22
- Changesets-based release workflow with `--provenance`

## 0.1.0

Initial release.
