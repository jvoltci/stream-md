// ═══════════════════════════════════════════════════════════════
// StreamMD — Inline Markdown Parser
// ═══════════════════════════════════════════════════════════════

import type { InlineToken } from "./types";

/**
 * Parse inline markdown tokens from raw text content.
 * Handles: **bold**, *italic*, `code`, [link](url),
 * ~~strikethrough~~, ![image](url)
 *
 * Gracefully handles partial/unclosed tokens by showing raw text.
 */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let currentText = "";

  const flush = () => {
    if (currentText) {
      tokens.push({ type: "text", content: currentText });
      currentText = "";
    }
  };

  while (i < text.length) {
    const ch = text[i]!;
    const next = text[i + 1];
    const rest = text.slice(i);

    // ── Escaped character ──
    if (ch === "\\" && i + 1 < text.length) {
      currentText += text[i + 1];
      i += 2;
      continue;
    }

    // ── Image ![alt](url) ──
    if (ch === "!" && next === "[") {
      const imgMatch = rest.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        flush();
        tokens.push({
          type: "image",
          content: imgMatch[1]!,
          alt: imgMatch[1]!,
          href: imgMatch[2]!,
        });
        i += imgMatch[0].length;
        continue;
      }
    }

    // ── Link [text](url) ──
    if (ch === "[") {
      const linkMatch = rest.match(/^\[([^\]]*)\]\(([^)]+)\)/);
      if (linkMatch) {
        flush();
        tokens.push({
          type: "link",
          content: linkMatch[1]!,
          href: linkMatch[2]!,
        });
        i += linkMatch[0].length;
        continue;
      }
    }

    // ── Inline code ──
    if (ch === "`") {
      // Count backticks
      let ticks = 0;
      let j = i;
      while (j < text.length && text[j] === "`") { ticks++; j++; }

      // Find closing backticks
      const closeIdx = text.indexOf("`".repeat(ticks), j);
      if (closeIdx !== -1) {
        flush();
        tokens.push({
          type: "code",
          content: text.slice(j, closeIdx),
        });
        i = closeIdx + ticks;
        continue;
      }
      // No close — treat as raw text
      currentText += ch;
      i++;
      continue;
    }

    // ── Bold + Italic (***text***) ──
    if ((ch === "*" || ch === "_") && next === ch && text[i + 2] === ch) {
      const marker = ch.repeat(3);
      const closeIdx = text.indexOf(marker, i + 3);
      if (closeIdx !== -1) {
        flush();
        tokens.push({
          type: "bolditalic",
          content: text.slice(i + 3, closeIdx),
          children: parseInline(text.slice(i + 3, closeIdx)),
        });
        i = closeIdx + 3;
        continue;
      }
    }

    // ── Bold (**text** or __text__) ──
    if ((ch === "*" || ch === "_") && next === ch) {
      const marker = ch.repeat(2);
      const closeIdx = text.indexOf(marker, i + 2);
      if (closeIdx !== -1 && closeIdx > i + 2) {
        flush();
        tokens.push({
          type: "bold",
          content: text.slice(i + 2, closeIdx),
          children: parseInline(text.slice(i + 2, closeIdx)),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // ── Italic (*text* or _text_) ──
    if (ch === "*" || ch === "_") {
      const closeIdx = text.indexOf(ch, i + 1);
      if (closeIdx !== -1 && closeIdx > i + 1) {
        // Don't match if surrounded by spaces (for _ only)
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
          children: parseInline(text.slice(i + 1, closeIdx)),
        });
        i = closeIdx + 1;
        continue;
      }
    }

    // ── Strikethrough ~~text~~ ──
    if (ch === "~" && next === "~") {
      const closeIdx = text.indexOf("~~", i + 2);
      if (closeIdx !== -1) {
        flush();
        tokens.push({
          type: "strikethrough",
          content: text.slice(i + 2, closeIdx),
          children: parseInline(text.slice(i + 2, closeIdx)),
        });
        i = closeIdx + 2;
        continue;
      }
    }

    // ── Plain text ──
    currentText += ch;
    i++;
  }

  flush();
  return tokens;
}
