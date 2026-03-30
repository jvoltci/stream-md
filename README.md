<div align="center">

# StreamMD

**Streaming markdown renderer for LLM token streams.**

Zero flicker · Incremental parsing · Built-in syntax highlighting

[![npm version](https://img.shields.io/npm/v/stream-md)](https://www.npmjs.com/package/stream-md)
[![bundle size](https://img.shields.io/bundlephobia/minzip/stream-md)](https://bundlephobia.com/package/stream-md)
[![license](https://img.shields.io/npm/l/stream-md)](https://github.com/jvoltci/stream-md/blob/main/LICENSE)

[Demo](https://altrusian.com/streammd) · [Docs](#usage) · [GitHub](https://github.com/jvoltci/stream-md)

</div>

---

## The Problem

Every AI chat app has the same bug. When tokens stream in, `react-markdown` re-parses and re-renders the **entire document** on every single token:

```tsx
// ❌ The approach every AI app uses
function Chat({ text }) {
  // Re-parses ALL markdown, re-renders ALL components — per token
  return <ReactMarkdown>{text}</ReactMarkdown>;
}
```

At 50 tokens/second, that's 50 full re-renders with code blocks re-highlighted, tables rebuilt, and lists re-measured. The result: visible flicker, dropped frames, and wasted CPU.

## The Solution

StreamMD parses markdown **incrementally**. Only the currently-streaming block re-renders. Completed blocks are frozen via `React.memo`.

```tsx
// ✅ StreamMD — only the active block updates
import { StreamMD } from 'stream-md';
import 'stream-md/styles.css';

function Chat({ text }) {
  return <StreamMD text={text} theme="dark" />;
}
```

**That's it.** Drop-in replacement. Your streaming goes from janky to buttery.

---

## Install

```bash
npm install stream-md
```

## Usage

### Basic Component

```tsx
import { StreamMD } from 'stream-md';
import 'stream-md/styles.css';

function ChatMessage({ streamingText }) {
  return <StreamMD text={streamingText} theme="dark" />;
}
```

### With Vercel AI SDK

```tsx
'use client';
import { useChat } from '@ai-sdk/react';
import { StreamMD } from 'stream-md';
import 'stream-md/styles.css';

export default function Chat() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();

  return (
    <div>
      {messages.map((m) => (
        <div key={m.id}>
          {m.role === 'assistant' ? (
            <StreamMD text={m.content} theme="dark" />
          ) : (
            <p>{m.content}</p>
          )}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input value={input} onChange={handleInputChange} />
      </form>
    </div>
  );
}
```

### Hook API (Advanced)

```tsx
import { useStreamMD } from 'stream-md';

function CustomRenderer() {
  const { blocks, activeIndex, push, reset } = useStreamMD();

  useEffect(() => {
    const sse = new EventSource('/api/chat');
    let text = '';
    sse.onmessage = (e) => {
      text += e.data;
      push(text);
    };
    return () => sse.close();
  }, [push]);

  return (
    <div>
      {blocks.map((block, i) => (
        <div key={block.id} className={i === activeIndex ? 'active' : ''}>
          {/* Custom rendering per block.type */}
        </div>
      ))}
    </div>
  );
}
```

---

## How It Works

```
Token Stream
    │
    ▼
StreamParser (incremental — only processes new tokens)
    │
    ├── Completed Blocks → React.memo'd (NEVER re-render)
    │
    └── Active Block → Re-renders per token (only 1 component)
```

| | react-markdown | StreamMD |
|---|---|---|
| Parse per token | Full document | New content only |
| Re-renders | All blocks | Active block only |
| Syntax highlighting | Re-highlights all code | Highlights once, frozen |
| Complexity | O(n) per token | O(1) per token |
| Flicker | Visible at >30 tok/s | None |

---

## Features

### Markdown Support

- **Headings** — `#` through `######`
- **Paragraphs** — Automatic block detection
- **Code blocks** — Fenced with language detection + **built-in syntax highlighting** (15 languages)
- **Inline code** — Backtick-wrapped
- **Bold / Italic** — `**bold**`, `*italic*`, `***both***`
- **Links** — `[text](url)`
- **Images** — `![alt](url)`
- **Lists** — Ordered, unordered, nested, task lists (`- [x]`)
- **Tables** — With column alignment (`---:`, `:---:`)
- **Blockquotes** — `>`
- **Horizontal rules** — `---`, `***`, `___`
- **Strikethrough** — `~~deleted~~`

### Syntax Highlighting

Built-in lightweight highlighter (~3kB) for:

JavaScript · TypeScript · Python · Rust · Go · Java · C/C++ · Bash · JSON · HTML · CSS · SQL · YAML · Diff · Markdown

### Theming

```tsx
<StreamMD text={text} theme="dark" />   {/* Dark preset */}
<StreamMD text={text} theme="light" />  {/* Light preset */}
<StreamMD text={text} theme="none" />   {/* Bring your own */}
```

Full control via CSS custom properties:

```css
.stream-md {
  --smd-text: #e2e8f0;
  --smd-heading: #ffffff;
  --smd-link: #818cf8;
  --smd-code-bg: rgba(0, 0, 0, 0.3);
  --smd-hl-keyword: #c084fc;
  --smd-hl-string: #86efac;
  --smd-cursor: #818cf8;
  /* ... see stream-md.css for all tokens */
}
```

### Component Overrides

```tsx
<StreamMD
  text={text}
  components={{
    pre: ({ code, language }) => <MyCodeBlock code={code} lang={language} />,
    a: ({ href, children }) => <MyLink href={href}>{children}</MyLink>,
    table: ({ headers, rows }) => <MyTable headers={headers} rows={rows} />,
  }}
/>
```

---

## API

### `<StreamMD />`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | Required | Current streamed markdown text |
| `theme` | `'dark' \| 'light' \| 'none'` | `'dark'` | Theme preset |
| `className` | `string` | — | Additional CSS class |
| `components` | `Partial<ComponentOverrides>` | — | Custom renderers |
| `onBlockComplete` | `(block: Block) => void` | — | Called when a block is finalized |

### `useStreamMD(options?)`

Returns `{ blocks, activeIndex, push, reset }`.

### `StreamParser`

Low-level parser class for non-React usage.

---

## Companion: ZeroJitter

For **plain text** streaming that bypasses the DOM entirely, check out [ZeroJitter](https://www.npmjs.com/package/zero-jitter) — canvas-based rendering with zero layout reflows.

```
stream-md     → streaming markdown (smart DOM, incremental parsing)
zero-jitter   → streaming plain text (canvas, zero reflows)
```

Together, they own the "streaming LLM display" category.

---

## License

MIT © [Jai](https://altrusian.com)
