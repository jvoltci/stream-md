import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      core: "src/core/index.ts",
      server: "src/server/index.ts",
      next: "src/next/index.ts",
      strict: "src/strict/index.ts",
      shiki: "src/shiki/index.ts",
      katex: "src/katex/index.tsx",
      mermaid: "src/mermaid/index.tsx",
      plugins: "src/plugins/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "shiki",
      "katex",
      "mermaid",
      "micromark",
      "micromark-extension-gfm",
    ],
    treeshake: true,
    splitting: false,
    target: "es2020",
    onSuccess: async () => {
      const themesIn = resolve("src/themes");
      const themesOut = resolve("dist/themes");
      mkdirSync(themesOut, { recursive: true });
      for (const f of [
        "catppuccin.css",
        "tokyo-night.css",
        "github.css",
        "solarized.css",
      ]) {
        const src = resolve(themesIn, f);
        if (existsSync(src)) copyFileSync(src, resolve(themesOut, f));
      }
    },
  },
  {
    entry: { "stream-md": "src/styles/stream-md.css" },
    outDir: "dist",
  },
]);
