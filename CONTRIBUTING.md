# Contributing

Thanks for considering a contribution!

## Development

```bash
npm install
npm run dev       # tsup watch build
npm run test:watch
```

### Useful scripts

| Script | What it does |
|---|---|
| `npm run typecheck` | TypeScript no-emit check |
| `npm run lint` | ESLint flat config |
| `npm run test` | Vitest run |
| `npm run test:cov` | With coverage |
| `npm run build` | tsup build for all sub-paths |
| `npm run size` | size-limit budgets |
| `npm run bench` | Benchmarks |
| `npm run changeset` | Add a changeset for the release workflow |

## Testing changes

Every PR should:

1. Pass `typecheck`, `lint`, and `test`
2. Stay under all `size-limit` budgets (or update them with justification)
3. Add or update tests under `tests/` for any user-visible behavior change
4. Add a changeset (`npm run changeset`) if the change is user-facing

The streaming-equivalence property test (`tests/parser/streaming-equivalence.test.ts`) is the most important — any parser change must preserve the invariant that **streaming a document char-by-char produces the same final AST as parsing it atomically**.

## Folder structure

```
src/
├── core/              # Framework-agnostic — no React imports
├── parser/            # Stream + inline parsers
├── highlight/         # Built-in regex highlighter
├── plugins/           # Public plugin API + helpers
├── components/        # React layer (default entry)
├── hooks/             # React hooks
├── server/            # RSC-safe server parser
├── next/              # Next.js helpers (StreamMDServer, AssistantMarkdown)
├── strict/            # Opt-in micromark adapter
├── shiki/             # Opt-in Shiki adapter
├── katex/             # Opt-in KaTeX math
├── mermaid/           # Opt-in Mermaid diagrams
├── styles/            # Default stylesheet
└── themes/            # Additional named themes
```

`core/` and `server/` must stay free of React imports — they're meant to run in any JS runtime including Node, Edge, and workers.

`components/`, `hooks/`, and `next/ai-sdk.tsx` carry `"use client"` so they work as drop-in imports inside Next.js server components.

## Releases

Maintainers tag releases via the Changesets workflow. Don't bump `package.json#version` by hand.
