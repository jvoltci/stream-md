<div align="center">

# StreamMD

**The streaming-markdown library that doesn't flicker.**

Incremental block parsing · Speculative inline closure · React 19 + Next.js App Router · Built-in syntax highlighting · Optional Shiki, KaTeX, Mermaid

[![npm](https://img.shields.io/npm/v/stream-md?color=8a2be2)](https://www.npmjs.com/package/stream-md)
[![bundle](https://img.shields.io/bundlephobia/minzip/stream-md?color=22c55e)](https://bundlephobia.com/package/stream-md)
[![types](https://img.shields.io/npm/types/stream-md?color=3178c6)](#)
[![ci](https://github.com/jvoltci/stream-md/actions/workflows/ci.yml/badge.svg)](https://github.com/jvoltci/stream-md/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/stream-md)](LICENSE)

[Live demo](https://altrusian.com/stream-md) · [API](#api) · [Plugin guide](#extensions) · [Threat model](SECURITY.md)

</div>

---

## Why this exists

Every AI chat app has the same bug. When tokens stream in, `react-markdown` re-parses and re-renders the **entire document on every token**. At 100 tok/s that's 100 full re-renders per second — code blocks re-highlighted, tables rebuilt, lists re-measured. The result: visible flicker, dropped frames, and wasted CPU.

```tsx
// ❌ The approach every AI app ships with
function Chat({ text }) {
  // Re-parses ALL markdown, re-renders ALL components — per token
  return <ReactMarkdown>{text}</ReactMarkdown>;
}
```

StreamMD parses **incrementally**. Only the currently-streaming block re-renders. Closed blocks freeze via `React.memo`. Code blocks highlight **once**, on close. Unclosed `**bo` renders as bold *now* with `data-tentative="true"` — so when `**` arrives there's nothing to repaint.

```tsx
// ✅ StreamMD — only the active block updates
import { StreamMD } from 'stream-md';
import 'stream-md/styles.css';

function Chat({ text }) {
  return <StreamMD text={text} theme="dark" />;
}
```

Drop-in replacement. Streaming goes from janky to smooth.

---

## Install

```bash
npm install stream-md
# Optional adapters (lazy-loaded; install only what you use):
npm install shiki   # real syntax highlighting
npm install katex   # math
npm install mermaid # diagrams
```

Peer deps: `react@>=18`, `react-dom@>=18`. Works with React 19 + Next.js App Router out of the box.

---

## How it compares

| | react-markdown | streamdown | **StreamMD** |
|---|:---:|:---:|:---:|
| Parse cost per token | Full doc | Full doc | New tokens only |
| Closed blocks re-render | ✓ every token | ✓ every token | Memoized |
| Syntax highlighting per token | Re-runs | Re-runs | Once on close |
| Speculative inline closure (no flicker) | ✗ | ✗ | ✓ |
| `"use client"` baked in | n/a | ✓ | ✓ |
| RSC server parser | ✗ | ✗ | ✓ (`stream-md/server`) |
| Plugin API | rehype/remark | ✗ | ✓ first-class |
| URL sanitizer (`javascript:` blocked) | requires plugin | ✓ | ✓ default |
| CSP-safe (no inline styles) | ✗ | ✗ | ✓ |
| Bundle (gz, default) | ~70 KB | ~22 KB | **~10 KB** |

(Bundle numbers are approximate; verify with bundlephobia. Run the suite under `bench/` to reproduce parse-cost numbers locally.)

---

## Quickstart

```tsx
import { StreamMD } from 'stream-md';
import 'stream-md/styles.css';

export function ChatBubble({ text }: { text: string }) {
  return <StreamMD text={text} theme="dark" />;
}
```

That's it. Pass the *full accumulated text* — StreamMD diffs internally.

---

## Next.js + Vercel AI SDK (the headline recipe)

`app/page.tsx`:

```tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { AssistantMarkdown } from 'stream-md/next';
import 'stream-md/styles.css';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <main>
      {messages.map((m) =>
        m.role === 'assistant' ? (
          <AssistantMarkdown key={m.id} message={m} theme="dark" />
        ) : (
          <p key={m.id}>{m.content}</p>
        ),
      )}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </main>
  );
}
```

`app/api/chat/route.ts`:

```ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = 'edge'; // works on Edge — stream-md/server is Edge-safe

export async function POST(req: Request) {
  const { messages } = await req.json();
  const result = streamText({ model: openai('gpt-4o-mini'), messages });
  return result.toDataStreamResponse();
}
```

---

## React Server Components (RSC)

Server-render saved messages on first paint, then upgrade to live streaming on the client:

```tsx
// app/messages/[id]/page.tsx — a Server Component
import { StreamMDServer } from 'stream-md/next';
import 'stream-md/styles.css';
import { getMessage } from '@/lib/db';

export default async function MessagePage({ params }: { params: { id: string } }) {
  const message = await getMessage(params.id);
  return <StreamMDServer text={message.body} theme="dark" />;
}
```

`<StreamMDServer>` emits pure HTML — zero client JS for static content. For *live* streaming use the client `<StreamMD>` from `stream-md` or `stream-md/next`.

---

## Edge runtime

Pure parser sub-path that works in Cloudflare Workers, Vercel Edge, etc.:

```ts
import { parseToBlocks } from 'stream-md/server';

export const runtime = 'edge';

export async function GET() {
  const blocks = parseToBlocks('# Hello\n\n**world**\n');
  return Response.json(blocks); // serializable Block[]
}
```

---

## Hook API (advanced)

For full control over rendering — useful with EventSource, custom transports, or when you don't want the React component:

```tsx
import { useStreamMD } from 'stream-md';

function CustomRenderer() {
  const { blocks, activeIndex, push, reset } = useStreamMD();

  useEffect(() => {
    const sse = new EventSource('/api/chat');
    let acc = '';
    sse.onmessage = (e) => {
      acc += e.data;
      push(acc);
    };
    return () => sse.close();
  }, [push]);

  return blocks.map((block, i) => (
    <MyBlock key={block.id} block={block} active={i === activeIndex} />
  ));
}
```

---

## Extensions

All extensions are **lazy-loaded** sub-paths — you pay zero bundle cost unless you import them.

### Shiki (production-grade syntax highlighting)

```tsx
import { StreamMD } from 'stream-md';
import { createShikiHighlighter } from 'stream-md/shiki';

const highlighter = await createShikiHighlighter({
  theme: 'github-dark',
  langs: ['ts', 'tsx', 'python', 'rust'],
});

<StreamMD text={text} highlighter={highlighter} />
```

### KaTeX (math)

```tsx
import 'katex/dist/katex.min.css';
import { StreamMD } from 'stream-md';
import { katexInlinePlugin, katexBlockPlugin } from 'stream-md/katex';

<StreamMD
  text={text}
  inlinePlugins={[katexInlinePlugin]}
  blockPlugins={[katexBlockPlugin]}
/>
```

Renders `$E = mc^2$` inline and `$$\int_0^\infty e^{-x^2}\,dx$$` as a block.

### Mermaid (diagrams)

````tsx
import { StreamMD } from 'stream-md';
import { mermaidBlockPlugin } from 'stream-md/mermaid';

<StreamMD text={text} blockPlugins={[mermaidBlockPlugin]} />

// Triggers on:
// ```mermaid
// graph TD; A-->B
// ```
````

### Strict CommonMark + GFM

If you need full spec compliance and don't mind a larger bundle:

```ts
import { StrictStreamParser } from 'stream-md/strict';

const parser = new StrictStreamParser();
await parser.pushAsync(text);
const blocks = parser.getBlocks();
```

Backed by `micromark` + GFM extensions. Useful for round-tripping authored content; the default hand-rolled parser is sufficient for LLM streaming.

---

## Plugin authoring

```ts
import type { BlockPlugin } from 'stream-md/plugins';
import { fencedBlockPlugin } from 'stream-md/plugins';

export const csvBlock: BlockPlugin = fencedBlockPlugin({
  name: 'csv',
  openLine: /^```csv\s*$/,
  closeLine: /^```\s*$/,
  render: (block) => <CsvTable source={block.content} />,
});

<StreamMD text={text} blockPlugins={[csvBlock]} />
```

For inline tokens (e.g. `@mentions`, `:emoji:`, hashtags):

```ts
import { delimitedInlinePlugin } from 'stream-md/plugins';

export const mention = delimitedInlinePlugin({
  name: 'mention',
  open: '@',
  close: ' ',
  tokenType: 'text',
  triggers: '@',
});
```

---

## Theming

Three built-in presets, four extra themes, full CSS-variable control.

```tsx
<StreamMD theme="dark" />     {/* default */}
<StreamMD theme="light" />
<StreamMD theme="none" />     {/* bring your own */}
```

Named themes (separate stylesheet imports):

```tsx
import 'stream-md/themes/catppuccin.css';
// then:
<div className="smd-theme-catppuccin-mocha">
  <StreamMD text={text} theme="none" />
</div>
```

Available: `catppuccin-mocha`, `catppuccin-latte`, `tokyo-night`, `tokyo-night-storm`, `github-dark`, `github-light`, `solarized-dark`, `solarized-light`.

Or write your own via custom properties:

```css
.stream-md {
  --smd-text: #e2e8f0;
  --smd-heading: #ffffff;
  --smd-link: #818cf8;
  --smd-code-bg: rgba(0, 0, 0, 0.3);
  --smd-hl-keyword: #c084fc;
  --smd-hl-string: #86efac;
  --smd-cursor: #818cf8;
  /* see src/styles/stream-md.css for the full list */
}
```

---

## Component overrides

Replace any built-in renderer:

```tsx
<StreamMD
  text={text}
  components={{
    pre: ({ code, language, streaming }) => (
      <MyCodeBlock code={code} lang={language} live={streaming} />
    ),
    a: ({ href, children }) => <NextLink href={href}>{children}</NextLink>,
    table: ({ headers, rows, alignments }) => (
      <MyTable headers={headers} rows={rows} alignments={alignments} />
    ),
  }}
/>
```

---

## API

### `<StreamMD />`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | required | Current streamed markdown text |
| `theme` | `'dark' \| 'light' \| 'none'` | `'dark'` | Theme preset |
| `className` | `string` | — | Additional CSS class |
| `components` | `Partial<ComponentOverrides>` | — | Custom renderers |
| `onBlockComplete` | `(block: Block) => void` | — | Called when a block is finalized |
| `limits` | `Partial<Limits>` | defaults | Override doc/recursion caps |
| `highlighter` | `HighlighterFn` | built-in | Custom syntax highlighter (e.g. Shiki) |
| `blockPlugins` | `BlockPlugin[]` | — | Custom block types |
| `inlinePlugins` | `InlinePlugin[]` | — | Custom inline tokens |
| `showCursor` | `boolean` | `true` | Blinking cursor on the active block |

### `useStreamMD(options?)`

Returns `{ blocks, activeIndex, incompleteLine, push, reset }`.

### Server / RSC

```ts
import { parseToBlocks } from 'stream-md/server';

const blocks: Block[] = parseToBlocks(text); // JSON-serializable
```

### `<StreamMDServer />` (RSC)

```tsx
import { StreamMDServer } from 'stream-md/next';
<StreamMDServer text={savedMessage} theme="dark" />
```

### `<AssistantMarkdown />` (Vercel AI SDK)

```tsx
import { AssistantMarkdown } from 'stream-md/next';
<AssistantMarkdown message={m} theme="dark" />
```

Full type signatures are exported from each entry — your IDE will autocomplete.

---

## Security

LLM output is untrusted. StreamMD's defaults reflect that:

- `javascript:`, `vbscript:`, and unsafe `data:` URLs are **rejected by default**, in links, images, and autolinks. Control characters can't smuggle a dangerous scheme.
- Recursion cap on inline parser (default 4 levels)
- Document length cap (default 1 MB)
- External links: `target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"`
- Tables avoid inline `style` attributes — works under strict CSP

See [SECURITY.md](SECURITY.md) for the full threat model.

---

## Performance methodology

We make three claims:

1. **Closed blocks don't re-render** — verified by `React.memo` and `tests/components/StreamMD.test.tsx` (snapshot stability).
2. **Code is highlighted once, on close** — verified by inspecting the DOM during streaming (active code blocks render plain `<code>`).
3. **Streaming a doc char-by-char produces the same final AST as atomic parsing** — verified by a fast-check property test in `tests/parser/streaming-equivalence.test.ts`. This is what makes "incremental" actually safe.

Reproduce locally:

```bash
npm run bench   # tinybench atomic + streaming benchmarks
npm run test    # full Vitest + property suite
npm run size    # bundle budgets
```

---

## Migration from `react-markdown`

```diff
- import ReactMarkdown from 'react-markdown';
+ import { StreamMD } from 'stream-md';
+ import 'stream-md/styles.css';

- <ReactMarkdown>{text}</ReactMarkdown>
+ <StreamMD text={text} theme="dark" />
```

That's it for 90% of cases. If you used `remark-gfm` for tables/strikethrough/task-lists, those are built in. If you used `rehype-katex`, swap to `stream-md/katex`. If you used `rehype-highlight`, swap to `stream-md/shiki`.

---

## Roadmap

- v0.3: Vue, Svelte, Solid bindings (re-using `stream-md/core`)
- v0.3: web component (`<stream-md>`)
- v0.4: SSE/fetch-stream helper
- v0.4: editor mode (round-trip via contenteditable)

---

## Companion: ZeroJitter

For **plain text** streaming that bypasses the DOM entirely, see [ZeroJitter](https://www.npmjs.com/package/zero-jitter) — canvas-based rendering with zero layout reflows.

```
stream-md     → streaming markdown (smart DOM, incremental parsing)
zero-jitter   → streaming plain text (canvas, zero reflows)
```

Together, they own the streaming-LLM display category.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome — the streaming-equivalence property test is the most important guardrail.

## License

MIT © [Jai](https://altrusian.com)
