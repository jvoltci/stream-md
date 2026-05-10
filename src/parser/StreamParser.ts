/**
 * Streaming markdown block parser.
 *
 * Accepts the full accumulated text on each `push()`, diffs internally,
 * and produces a `Block[]` AST plus the index of the currently active
 * (still-streaming) block. Closed blocks are immutable so React can
 * memoize them safely.
 *
 * Supports: ATX + setext headings, paragraphs, fenced + indented code,
 * blockquotes, ordered/unordered/task lists with nesting, GFM tables
 * (committed only on separator-row), thematic breaks, horizontal rules,
 * hard limits, and prefix-change detection (auto-reset when the input
 * is no longer a prefix of what was last seen).
 */

import type {
  Block,
  BlockType,
  BlockMeta,
  ParseResult,
  StreamMDOptions,
  BlockPlugin,
} from "./types";
import { DEFAULT_LIMITS, type Limits } from "../core/limits";

interface ParserOptions extends StreamMDOptions {
  blockPlugins?: BlockPlugin[];
}

export class StreamParser {
  private blocks: Block[] = [];
  private prevText = "";
  private inCodeFence = false;
  private codeFenceChar = "";
  private codeFenceCount = 0;
  private codeFenceIndent = 0;
  private incompleteLine = "";
  private blockId = 0;
  private limits: Limits;
  private opts: ParserOptions;

  constructor(options: ParserOptions = {}) {
    this.opts = options;
    this.limits = { ...DEFAULT_LIMITS, ...(options.limits ?? {}) };
  }

  /**
   * Push the full accumulated text. The parser internally diffs against
   * the previous push to process only new content. If the new text is
   * not a prefix of the previous text (e.g. consumer cleared / replaced
   * the buffer), the parser resets and reparses from scratch.
   */
  push(fullText: string): ParseResult {
    // Hard length cap to defend against pathological input.
    if (fullText.length > this.limits.maxDocLength) {
      fullText = fullText.slice(0, this.limits.maxDocLength);
    }

    if (fullText === this.prevText) {
      return {
        blocks: this.blocks,
        activeIndex: this.blocks.length > 0 ? this.blocks.length - 1 : -1,
      };
    }

    // Detect non-prefix change → reset.
    const isPrefixGrow =
      fullText.length >= this.prevText.length &&
      fullText.startsWith(this.prevText);

    if (!isPrefixGrow) {
      this.reset();
    }

    const startedAt = this.prevText.length;
    const newContent = fullText.slice(startedAt);
    this.prevText = fullText;

    // Re-process: keep any incompleteLine carry-over, append new content.
    const buffer = this.incompleteLine + newContent;
    const lines = buffer.split("\n");
    // After splitting on \n, the LAST element is either:
    //   - the incomplete trailing text (no terminating \n)
    //   - the empty string "" left over from the final \n
    // Either way we must pop it; if it's the incomplete fragment, save it.
    const lastIsIncomplete = !buffer.endsWith("\n");
    const popped = lines.pop();
    this.incompleteLine = lastIsIncomplete ? (popped ?? "") : "";

    for (let li = 0; li < lines.length; li++) {
      this.processLine(lines[li]!, lines, li);
    }

    return {
      blocks: this.blocks,
      activeIndex: this.blocks.length > 0 ? this.blocks.length - 1 : -1,
    };
  }

  /** Get the current incomplete trailing line (for streaming display). */
  getIncompleteLine(): string {
    return this.incompleteLine;
  }

  /** Reset all state. */
  reset(): void {
    this.blocks = [];
    this.prevText = "";
    this.inCodeFence = false;
    this.codeFenceChar = "";
    this.codeFenceCount = 0;
    this.codeFenceIndent = 0;
    this.incompleteLine = "";
    // blockId intentionally not reset so React keys remain stable across resets.
  }

  /** Get current blocks. */
  getBlocks(): Block[] {
    return this.blocks;
  }

  // ── Internals ──

  private nextId(): string {
    return "smd-" + ++this.blockId;
  }

  private getActive(): Block | null {
    if (this.blocks.length === 0) return null;
    const last = this.blocks[this.blocks.length - 1]!;
    return last.closed ? null : last;
  }

  private closeActive(): void {
    const a = this.getActive();
    if (a) {
      a.closed = true;
      this.cacheParsed(a);
      this.opts.onBlockComplete?.(a);
    }
  }

  private startBlock(type: BlockType, content: string, meta: BlockMeta): Block {
    const block: Block = {
      id: this.nextId(),
      type,
      content,
      closed: false,
      meta,
    };
    this.blocks.push(block);
    return block;
  }

  /**
   * Cache parsed structure (e.g. table cells, list items) on close so
   * components don't re-parse on every render.
   */
  private cacheParsed(block: Block): void {
    if (block.type === "table") {
      block.meta.parsed = parseTable(block.content);
    } else if (block.type === "list") {
      block.meta.parsed = parseListItems(block.content);
    }
  }

  private processLine(line: string, allLines: string[], idx: number): void {
    // ── Inside fenced code ──
    if (this.inCodeFence) {
      const stripped = line.replace(/^ {0,3}/, "");
      if (this.isClosingFence(stripped)) {
        this.inCodeFence = false;
        this.closeActive();
        return;
      }
      const a = this.getActive();
      if (a && a.type === "code") {
        // Strip up to fence-indent of leading spaces (CommonMark).
        const indented = line.replace(
          new RegExp(`^ {0,${this.codeFenceIndent}}`),
          "",
        );
        a.content += (a.content ? "\n" : "") + indented;
      }
      return;
    }

    // ── Plugin block matchers (run before builtins so they can override) ──
    if (this.opts.blockPlugins?.length) {
      for (const plugin of this.opts.blockPlugins) {
        const m = plugin.openMatch(line);
        if (m) {
          this.closeActive();
          const block = this.startBlock(m.type, m.content ?? "", {
            ...(m.meta ?? {}),
            pluginName: plugin.name,
          });
          if (m.closeImmediately) {
            block.closed = true;
            this.cacheParsed(block);
            this.opts.onBlockComplete?.(block);
          }
          return;
        }
      }
    }

    // ── Blank line ──
    if (line.trim() === "") {
      this.closeActive();
      return;
    }

    // ── Code fence opening ──
    const fenceMatch = line.match(/^( {0,3})(`{3,}|~{3,})\s*([^`]*)$/);
    if (fenceMatch) {
      // ` fences cannot contain ` in info string.
      const fence = fenceMatch[2]!;
      if (fence.startsWith("`") && fenceMatch[3]!.includes("`")) {
        // fall through
      } else {
        this.closeActive();
        this.inCodeFence = true;
        this.codeFenceChar = fence[0]!;
        this.codeFenceCount = fence.length;
        this.codeFenceIndent = fenceMatch[1]!.length;
        const info = fenceMatch[3]!.trim();
        const spaceIdx = info.search(/\s/);
        const language = spaceIdx >= 0 ? info.slice(0, spaceIdx) : info;
        const attributes = spaceIdx >= 0 ? info.slice(spaceIdx + 1) : "";
        this.startBlock("code", "", {
          language,
          ...(attributes ? { attributes } : {}),
        });
        return;
      }
    }

    // ── ATX heading ──
    const atxMatch = line.match(/^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/);
    if (atxMatch) {
      this.closeActive();
      const level = atxMatch[1]!.length;
      const text = (atxMatch[2] ?? "").trim();
      const block = this.startBlock("heading", text, { level });
      // Headings are always single-line — close immediately. (Premature
      // closure of in-progress streaming heading lines is avoided because
      // ATX-headings can only match on a fully complete line — incomplete
      // lines stay in `incompleteLine` and don't reach processLine.)
      block.closed = true;
      this.opts.onBlockComplete?.(block);
      return;
    }

    // ── Setext heading (look-back) ──
    const setextMatch = line.match(/^ {0,3}(=+|-+)\s*$/);
    if (setextMatch) {
      const active = this.getActive();
      if (active && active.type === "paragraph" && !active.closed) {
        active.type = "heading";
        active.meta = { level: setextMatch[1]!.startsWith("=") ? 1 : 2 };
        active.closed = true;
        this.opts.onBlockComplete?.(active);
        return;
      }
      // Not setext → continue checking thematic break.
    }

    // ── Thematic break (HR) ──
    if (/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      this.closeActive();
      const block = this.startBlock("hr", "", {});
      block.closed = true;
      this.opts.onBlockComplete?.(block);
      return;
    }

    // ── Blockquote ──
    const bqMatch = line.match(/^ {0,3}>\s?(.*)$/);
    if (bqMatch) {
      const a = this.getActive();
      if (a && a.type === "blockquote") {
        a.content += "\n" + bqMatch[1]!;
      } else {
        this.closeActive();
        this.startBlock("blockquote", bqMatch[1]!, {});
      }
      return;
    }

    // ── Lists (ordered + unordered, with nesting via indent) ──
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    const olMatch = line.match(/^(\s*)(\d{1,9})([.)])\s+(.*)$/);
    if (ulMatch || olMatch) {
      const indent = (ulMatch ? ulMatch[1]! : olMatch![1]!).length;
      const ordered = !!olMatch;
      const a = this.getActive();
      if (a && a.type === "list" && a.meta.ordered === ordered) {
        a.content += "\n" + line;
        return;
      }
      this.closeActive();
      const meta: BlockMeta = { ordered, indent };
      if (ordered) meta.start = parseInt(olMatch![2]!, 10);
      this.startBlock("list", line, meta);
      return;
    }

    // ── List continuation (indented line under a list) ──
    {
      const a = this.getActive();
      if (a && a.type === "list" && /^\s+\S/.test(line)) {
        a.content += "\n" + line;
        return;
      }
    }

    // ── Indented code block (4 spaces, only when no active paragraph) ──
    if (/^ {4}/.test(line)) {
      const a = this.getActive();
      if (!a || a.type === "paragraph" || a.type === "code") {
        if (a && a.type === "code") {
          a.content += "\n" + line.slice(4);
          return;
        }
        if (!a) {
          this.startBlock("code", line.slice(4), { language: "" });
          return;
        }
      }
      // Inside paragraph — fall through to paragraph append (lazy continuation).
    }

    // ── Table detection: only commits on separator row ──
    if (line.includes("|")) {
      const a = this.getActive();
      // Existing table → append.
      if (a && a.type === "table") {
        a.content += "\n" + line;
        return;
      }
      // Active paragraph + this line is a separator row matching column count?
      if (
        a &&
        a.type === "paragraph" &&
        a.content.includes("|") &&
        !a.content.includes("\n") &&
        isTableSeparatorRow(line)
      ) {
        const headers = splitTableRow(a.content);
        const seps = splitTableRow(line);
        if (headers.length === seps.length && headers.length > 0) {
          a.type = "table";
          a.content += "\n" + line;
          return;
        }
      }
      // Look-ahead: this line is a header and *next* line is a separator.
      if (
        !a ||
        (a.type === "paragraph" && a.content.includes("\n") === false)
      ) {
        const next = allLines[idx + 1];
        if (
          next !== undefined &&
          next.includes("|") &&
          isTableSeparatorRow(next)
        ) {
          const headers = splitTableRow(line);
          const seps = splitTableRow(next);
          if (headers.length === seps.length && headers.length > 0) {
            this.closeActive();
            this.startBlock("table", line, {});
            return;
          }
        }
      }
      // else fall through to paragraph
    }

    // ── HTML block (very limited; controlled by allowHtml) ──
    if (this.opts.allowHtml && /^ {0,3}<[a-z!]/i.test(line)) {
      const a = this.getActive();
      if (a && a.type === "html") {
        a.content += "\n" + line;
      } else {
        this.closeActive();
        this.startBlock("html", line, {});
      }
      return;
    }

    // ── Paragraph (default) ──
    const a = this.getActive();
    if (a && a.type === "paragraph") {
      a.content += "\n" + line;
    } else {
      this.closeActive();
      this.startBlock("paragraph", line, {});
    }
  }

  private isClosingFence(line: string): boolean {
    if (line.length < this.codeFenceCount) return false;
    let n = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === this.codeFenceChar) n++;
      else if (line[i] === " " && n >= this.codeFenceCount) {
        // trailing spaces ok
        for (let j = i; j < line.length; j++) {
          if (line[j] !== " ") return false;
        }
        return true;
      } else return false;
    }
    return n >= this.codeFenceCount;
  }
}

// ── Helpers (also used by Blocks.tsx via meta.parsed cache) ──

export function isTableSeparatorRow(line: string): boolean {
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

export function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\||\|$/g, "");
  if (!trimmed) return [];
  // Split on `|` but respect escaped `\|`.
  const out: string[] = [];
  let buf = "";
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]!;
    if (c === "\\" && trimmed[i + 1] === "|") {
      buf += "|";
      i++;
    } else if (c === "|") {
      out.push(buf.trim());
      buf = "";
    } else {
      buf += c;
    }
  }
  out.push(buf.trim());
  return out;
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  alignments: Array<"left" | "center" | "right" | "none">;
}

export function parseTable(content: string): ParsedTable {
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [], alignments: [] };

  const headers = splitTableRow(lines[0]!);
  let alignments: ParsedTable["alignments"] = headers.map(() => "none");
  let dataStart = 1;

  if (lines.length > 1 && isTableSeparatorRow(lines[1]!)) {
    const aligns = splitTableRow(lines[1]!);
    alignments = aligns.map((a) => {
      const t = a.trim();
      const left = t.startsWith(":");
      const right = t.endsWith(":");
      if (left && right) return "center";
      if (right) return "right";
      if (left) return "left";
      return "none";
    });
    dataStart = 2;
  }

  const rows = lines.slice(dataStart).map(splitTableRow);
  return { headers, rows, alignments };
}

export interface ParsedListItem {
  text: string;
  isTask?: boolean;
  taskChecked?: boolean;
  indent: number;
  children?: ParsedListItem[];
}

export function parseListItems(content: string): ParsedListItem[] {
  const lines = content.split("\n");
  const flat: ParsedListItem[] = [];

  for (const line of lines) {
    const m = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (!m) {
      // Continuation line — append to last item's text.
      const last = flat[flat.length - 1];
      if (last) last.text += "\n" + line.trim();
      continue;
    }
    const indent = m[1]!.length;
    let text = m[2]!;
    let isTask: boolean | undefined;
    let taskChecked: boolean | undefined;
    const tm = text.match(/^\[([ xX])\]\s+(.*)$/);
    if (tm) {
      isTask = true;
      taskChecked = tm[1] !== " ";
      text = tm[2]!;
    }
    const item: ParsedListItem = { text, indent };
    if (isTask !== undefined) {
      item.isTask = isTask;
      item.taskChecked = taskChecked;
    }
    flat.push(item);
  }

  // Build nested tree from indents.
  return nestListItems(flat);
}

function nestListItems(flat: ParsedListItem[]): ParsedListItem[] {
  const root: ParsedListItem[] = [];
  const stack: { indent: number; list: ParsedListItem[] }[] = [
    { indent: -1, list: root },
  ];
  for (const item of flat) {
    while (stack.length > 1 && item.indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1]!.list;
    parent.push(item);
    stack.push({
      indent: item.indent,
      list: (item.children = item.children ?? []),
    });
  }
  // Strip empty `children` arrays for cleanliness.
  const strip = (items: ParsedListItem[]): ParsedListItem[] => {
    for (const it of items) {
      if (it.children && it.children.length === 0) delete it.children;
      else if (it.children) strip(it.children);
    }
    return items;
  };
  return strip(root);
}
