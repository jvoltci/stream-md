/**
 * Inline markdown parser.
 *
 * Handles **bold**, *italic*, ***bolditalic***, `code`, [text](url),
 * ![alt](url), ~~strike~~, hard breaks, and a tentative-close mode for
 * unclosed runs at the trailing edge of the stream (so `**bo` renders as
 * partially-bold rather than as raw asterisks, eliminating flicker when
 * the closing `**` arrives).
 *
 * Recursion is hard-capped to defend against adversarial input; URLs are
 * sanitized via `core/sanitize`.
 */

import type { InlineToken, InlinePlugin } from "./types";
import { sanitizeUrl, sanitizeImageUrl } from "../core/sanitize";
import { DEFAULT_LIMITS } from "../core/limits";

export interface ParseInlineOptions {
  /** Recursion depth (internal). */
  depth?: number;
  /** Max recursion depth. */
  maxDepth?: number;
  /** Treat trailing unclosed runs as tentative tokens (default true). */
  tentative?: boolean;
  /** Inline plugins (math, custom triggers). */
  plugins?: InlinePlugin[];
}

export function parseInline(
  text: string,
  options: ParseInlineOptions = {},
): InlineToken[] {
  const depth = options.depth ?? 0;
  const maxDepth = options.maxDepth ?? DEFAULT_LIMITS.maxInlineDepth;
  const tentative = options.tentative ?? true;
  const plugins = options.plugins;

  if (depth >= maxDepth) {
    return [{ type: "text", content: text }];
  }

  const tokens: InlineToken[] = [];
  const len = text.length;
  let i = 0;
  let buf = "";

  const flush = () => {
    if (buf) {
      tokens.push({ type: "text", content: buf });
      buf = "";
    }
  };

  // CommonMark flank rules: a `*` run is left-flanking if not followed by
  // whitespace and not (followed by punct AND preceded by alnum/punct).
  const isWhitespace = (c: string | undefined) =>
    c === undefined || /\s/.test(c);
  const isPunct = (c: string | undefined) =>
    c !== undefined && /[!-/:-@[-`{-~]/.test(c);
  const isLeftFlanking = (before: string | undefined, after: string | undefined) => {
    if (isWhitespace(after)) return false;
    if (!isPunct(after)) return true;
    return isWhitespace(before) || isPunct(before);
  };
  const isRightFlanking = (before: string | undefined, after: string | undefined) => {
    if (isWhitespace(before)) return false;
    if (!isPunct(before)) return true;
    return isWhitespace(after) || isPunct(after);
  };

  // Find a matching balanced ")" for "[text](" — supports nested parens.
  const findLinkClose = (start: number): number => {
    let pdepth = 1;
    for (let k = start; k < len; k++) {
      const ch = text[k]!;
      if (ch === "\\" && k + 1 < len) {
        k++;
        continue;
      }
      if (ch === "(") pdepth++;
      else if (ch === ")") {
        pdepth--;
        if (pdepth === 0) return k;
      }
    }
    return -1;
  };

  // Parse `[text](url "title")` / `![alt](url "title")` link/image.
  const tryLinkOrImage = (isImage: boolean): boolean => {
    const start = i;
    const open = isImage ? i + 2 : i + 1; // skip `![` or `[`
    let bdepth = 1;
    let close = -1;
    for (let k = open; k < len; k++) {
      const ch = text[k]!;
      if (ch === "\\" && k + 1 < len) {
        k++;
        continue;
      }
      if (ch === "[") bdepth++;
      else if (ch === "]") {
        bdepth--;
        if (bdepth === 0) {
          close = k;
          break;
        }
      }
    }
    if (close === -1) return false;
    if (text[close + 1] !== "(") return false;
    const urlStart = close + 2;
    const urlEnd = findLinkClose(urlStart);
    if (urlEnd === -1) return false;

    const inner = text.slice(open, close);
    const dest = text.slice(urlStart, urlEnd).trim();

    // Optional title: `url "title"` or `url 'title'` or `url (title)`.
    let url = dest;
    let title: string | undefined;
    const titleMatch = dest.match(/^(\S+)\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/);
    if (titleMatch) {
      url = titleMatch[1]!;
      title = titleMatch[2] ?? titleMatch[3] ?? titleMatch[4];
    }

    const safeUrl = isImage ? sanitizeImageUrl(url) : sanitizeUrl(url);
    if (safeUrl === null) {
      // Render raw text — sanitizer rejected.
      return false;
    }

    flush();
    if (isImage) {
      const tok: InlineToken = {
        type: "image",
        content: inner,
        alt: inner,
        href: safeUrl,
      };
      if (title !== undefined) tok.title = title;
      tokens.push(tok);
    } else {
      const tok: InlineToken = {
        type: "link",
        content: inner,
        href: safeUrl,
        children: parseInline(inner, { ...options, depth: depth + 1, tentative: false }),
      };
      if (title !== undefined) tok.title = title;
      tokens.push(tok);
    }
    i = urlEnd + 1;
    void start;
    return true;
  };

  // Inline code: smallest matching backtick run per CommonMark.
  const tryCode = (): boolean => {
    let ticks = 0;
    let j = i;
    while (j < len && text[j] === "`") {
      ticks++;
      j++;
    }
    // Look for a run of *exactly* `ticks` backticks.
    let k = j;
    while (k < len) {
      if (text[k] === "`") {
        let n = 0;
        const runStart = k;
        while (k < len && text[k] === "`") {
          n++;
          k++;
        }
        if (n === ticks) {
          flush();
          let content = text.slice(j, runStart);
          // CommonMark: single leading + trailing space stripped if not all-space.
          if (
            content.length >= 2 &&
            content.startsWith(" ") &&
            content.endsWith(" ") &&
            content.trim().length > 0
          ) {
            content = content.slice(1, -1);
          }
          tokens.push({ type: "code", content });
          i = k;
          return true;
        }
      } else {
        k++;
      }
    }
    return false;
  };

  // Emphasis: handles `*` and `_` runs, including bold (**) and bold+italic (***).
  const tryEmphasis = (marker: "*" | "_"): boolean => {
    let runLen = 0;
    let j = i;
    while (j < len && text[j] === marker) {
      runLen++;
      j++;
    }
    if (runLen === 0) return false;

    const before = i > 0 ? text[i - 1] : undefined;
    const after = text[j];
    const leftFlank = isLeftFlanking(before, after);
    const rightFlank = isRightFlanking(before, after);

    // CommonMark: `_` opener also requires (NOT right-flanking) OR preceded
    // by punctuation. This is the intraword rule that prevents `foo_bar_baz`
    // from being italic.
    const canOpen =
      leftFlank && (marker === "*" || !rightFlank || isPunct(before));

    if (!canOpen) {
      buf += text.slice(i, j);
      i = j;
      return true;
    }

    // Look for a closing run.
    let k = j;
    while (k < len) {
      if (text[k] === "\\" && k + 1 < len) {
        k += 2;
        continue;
      }
      if (text[k] === "`") {
        // Skip code spans so we don't match emphasis inside them.
        let n = 0;
        while (k < len && text[k] === "`") {
          n++;
          k++;
        }
        // Find closing
        let m = k;
        while (m < len) {
          if (text[m] === "`") {
            let n2 = 0;
            while (m < len && text[m] === "`") {
              n2++;
              m++;
            }
            if (n2 === n) break;
          } else m++;
        }
        k = m;
        continue;
      }
      if (text[k] === marker) {
        let closeRun = 0;
        const closeStart = k;
        while (k < len && text[k] === marker) {
          closeRun++;
          k++;
        }
        const cBefore = closeStart > 0 ? text[closeStart - 1] : undefined;
        const cAfter = text[k];
        const rightFlank = isRightFlanking(cBefore, cAfter);
        if (!rightFlank) continue;

        // Match: pick smallest of runLen and closeRun (CommonMark)
        const consumed = Math.min(runLen, closeRun);
        if (consumed === 0) continue;

        const innerStart = i + consumed;
        const innerEnd = closeStart + (closeRun - consumed);
        const inner = text.slice(innerStart, innerEnd);

        flush();

        let type: "bold" | "italic" | "bolditalic";
        if (consumed >= 3) type = "bolditalic";
        else if (consumed === 2) type = "bold";
        else type = "italic";

        tokens.push({
          type,
          content: inner,
          children: parseInline(inner, { ...options, depth: depth + 1, tentative: false }),
        });

        i = innerEnd + consumed;
        return true;
      }
      k++;
    }

    // No close found — speculative tentative emit at the trailing edge.
    if (tentative && depth === 0 && runLen <= 3) {
      // Only do this if this run is at/near the end of the buffer.
      // Specifically: there's no further content OR remaining content has
      // no whitespace and no other markers — still tentative.
      const remaining = text.slice(j);
      // Tentative is risky for whole document — only apply if remaining is the
      // *trailing fragment* (no newlines).
      if (!remaining.includes("\n")) {
        flush();
        const innerText = remaining;
        let type: "bold" | "italic" | "bolditalic";
        if (runLen >= 3) type = "bolditalic";
        else if (runLen === 2) type = "bold";
        else type = "italic";
        tokens.push({
          type,
          content: innerText,
          children: parseInline(innerText, {
            ...options,
            depth: depth + 1,
            tentative: false,
          }),
          tentative: true,
        });
        i = len;
        return true;
      }
    }

    // No close — render the marker run as literal text and continue.
    buf += text.slice(i, j);
    i = j;
    return true;
  };

  // Strikethrough: ~~text~~
  const tryStrike = (): boolean => {
    if (text[i] !== "~" || text[i + 1] !== "~") return false;
    const start = i + 2;
    let k = start;
    while (k < len - 1) {
      if (text[k] === "\\" && k + 1 < len) {
        k += 2;
        continue;
      }
      if (text[k] === "~" && text[k + 1] === "~") {
        const inner = text.slice(start, k);
        flush();
        tokens.push({
          type: "strikethrough",
          content: inner,
          children: parseInline(inner, { ...options, depth: depth + 1, tentative: false }),
        });
        i = k + 2;
        return true;
      }
      k++;
    }

    if (tentative && depth === 0) {
      const remaining = text.slice(start);
      if (!remaining.includes("\n")) {
        flush();
        tokens.push({
          type: "strikethrough",
          content: remaining,
          children: parseInline(remaining, {
            ...options,
            depth: depth + 1,
            tentative: false,
          }),
          tentative: true,
        });
        i = len;
        return true;
      }
    }
    return false;
  };

  // Autolink: <https://...> or <user@host>
  const tryAutolink = (): boolean => {
    if (text[i] !== "<") return false;
    const close = text.indexOf(">", i + 1);
    if (close === -1) return false;
    const inner = text.slice(i + 1, close);
    const isUrl = /^[a-z][a-z0-9+.-]*:[^\s<>]+$/i.test(inner);
    const isEmail =
      /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
        inner,
      );
    if (!isUrl && !isEmail) return false;
    const url = isEmail ? `mailto:${inner}` : inner;
    const safe = sanitizeUrl(url);
    if (safe === null) return false;
    flush();
    tokens.push({ type: "link", content: inner, href: safe });
    i = close + 1;
    return true;
  };

  // Hard line break: two trailing spaces or backslash-newline.
  const tryHardBreak = (): boolean => {
    if (text[i] === "\\" && text[i + 1] === "\n") {
      flush();
      tokens.push({ type: "br", content: "" });
      i += 2;
      return true;
    }
    if (
      text[i] === " " &&
      text[i + 1] === " " &&
      (text[i + 2] === "\n" || i + 2 === len)
    ) {
      flush();
      tokens.push({ type: "br", content: "" });
      i = text[i + 2] === "\n" ? i + 3 : i + 2;
      return true;
    }
    return false;
  };

  while (i < len) {
    const ch = text[i]!;

    // Plugin triggers — checked first so plugins can override builtins.
    if (plugins?.length) {
      let pluginMatched = false;
      for (const p of plugins) {
        if (p.triggers && !p.triggers.includes(ch)) continue;
        const m = p.match(text, i);
        if (m) {
          flush();
          tokens.push(m.token);
          i += m.consumed;
          pluginMatched = true;
          break;
        }
      }
      if (pluginMatched) continue;
    }

    // Backslash escape.
    if (ch === "\\" && i + 1 < len) {
      // \n hard break already handled above
      if (text[i + 1] === "\n") {
        if (tryHardBreak()) continue;
      }
      buf += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === "<" && tryAutolink()) continue;
    if ((ch === " " || ch === "\\") && tryHardBreak()) continue;

    if (ch === "!" && text[i + 1] === "[") {
      if (tryLinkOrImage(true)) continue;
      // Fall through to text.
    }
    if (ch === "[") {
      if (tryLinkOrImage(false)) continue;
    }

    if (ch === "`") {
      if (tryCode()) continue;
      // Tentative inline code.
      if (tentative && depth === 0) {
        const remaining = text.slice(i + 1);
        if (!remaining.includes("\n") && remaining.length > 0) {
          flush();
          tokens.push({ type: "code", content: remaining, tentative: true });
          i = len;
          continue;
        }
      }
      buf += ch;
      i++;
      continue;
    }

    if (ch === "*" || ch === "_") {
      if (tryEmphasis(ch as "*" | "_")) continue;
    }

    if (ch === "~" && text[i + 1] === "~") {
      if (tryStrike()) continue;
      buf += ch;
      i++;
      continue;
    }

    buf += ch;
    i++;
  }

  flush();
  return tokens;
}
