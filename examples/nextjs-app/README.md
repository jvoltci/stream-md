# stream-md · Next.js example

App Router + Vercel AI SDK + Edge runtime.

```bash
cd examples/nextjs-app
npm install
echo 'OPENAI_API_KEY=sk-...' > .env.local
npm run dev
```

Files:

- [app/page.tsx](app/page.tsx) — client chat UI using `<AssistantMarkdown>` from `stream-md/next`
- [app/api/chat/route.ts](app/api/chat/route.ts) — Edge route handler streaming via Vercel AI SDK
- [app/layout.tsx](app/layout.tsx) — imports `stream-md/styles.css`

This example shows the **default React entry working in a server component file** — the `"use client"` banner is baked into `<StreamMD>` so you don't need ceremony.
