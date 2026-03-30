// ═══════════════════════════════════════════════════════════════
// StreamMD — Incremental Streaming Markdown Parser
// ═══════════════════════════════════════════════════════════════

import type { Block, BlockType, BlockMeta, ParseResult, StreamMDOptions } from "./types";



export class StreamParser {
  private blocks: Block[] = [];
  private buffer = "";
  private prevLength = 0;
  private inCodeFence = false;
  private codeFenceChar = "";
  private codeFenceCount = 0;
  private options: StreamMDOptions;
  private _incompleteLine = "";
  private _blockId = 0;

  private nextId(): string {
    return "smd-" + (++this._blockId);
  }

  constructor(options: StreamMDOptions = {}) {
    this.options = options;
  }

  /**
   * Push new text. Accepts the FULL accumulated text each time
   * (not just the delta). Internally diffs to find new content.
   */
  push(fullText: string): ParseResult {
    if (fullText.length <= this.prevLength) {
      return { blocks: this.blocks, activeIndex: this.blocks.length - 1 };
    }

    const newContent = fullText.slice(this.prevLength);
    this.prevLength = fullText.length;
    this.buffer += newContent;

    this.parseBuffer();

    return {
      blocks: this.blocks,
      activeIndex: this.blocks.length > 0 ? this.blocks.length - 1 : -1,
    };
  }

  /** Get the current incomplete line (not yet committed to a block) */
  getIncompleteLine(): string {
    return this._incompleteLine;
  }

  /** Reset all state */
  reset(): void {
    this.blocks = [];
    this.buffer = "";
    this.prevLength = 0;
    this.inCodeFence = false;
    this.codeFenceChar = "";
    this.codeFenceCount = 0;
    this._incompleteLine = "";
  }

  /** Get current blocks */
  getBlocks(): Block[] {
    return this.blocks;
  }

  // ── Internal parsing ──────────────────────────────────────

  private parseBuffer(): void {
    const lines = this.buffer.split("\n");

    // The last element might be an incomplete line (no trailing \n)
    // Keep it in the buffer for next push — DON'T add to block content
    const incompleteLine = this.buffer.endsWith("\n") ? "" : lines.pop()!;

    for (const line of lines) {
      this.processLine(line);
    }

    // Store incomplete line separately — NOT in block content
    this._incompleteLine = incompleteLine;
    this.buffer = incompleteLine;
  }

  private processLine(line: string): void {
    // ── Inside a code fence ──
    if (this.inCodeFence) {
      const trimmed = line.trimStart();
      if (this.isClosingFence(trimmed)) {
        this.inCodeFence = false;
        const active = this.getActiveBlock();
        if (active && active.type === "code") {
          active.closed = true;
          this.options.onBlockComplete?.(active);
        }
        return;
      }
      // Append line to code block content
      const active = this.getActiveBlock();
      if (active) {
        active.content += line + "\n";
      }
      return;
    }

    // ── Blank line — closes current block ──
    if (line.trim() === "") {
      this.closeActiveBlock();
      return;
    }

    // ── Code fence opening ──
    const fenceMatch = line.match(/^(`{3,}|~{3,})\s*([\w+-]*)/);
    if (fenceMatch) {
      this.closeActiveBlock();
      this.inCodeFence = true;
      this.codeFenceChar = fenceMatch[1]![0]!;
      this.codeFenceCount = fenceMatch[1]!.length;
      const language = fenceMatch[2] || "";
      this.startBlock("code", "", { language });
      return;
    }

    // ── Heading ──
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      this.closeActiveBlock();
      const level = headingMatch[1]!.length;
      this.startBlock("heading", headingMatch[2]!, { level });
      const active = this.getActiveBlock();
      if (active) {
        active.closed = true;
        this.options.onBlockComplete?.(active);
      }
      return;
    }

    // ── Horizontal rule ──
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      this.closeActiveBlock();
      this.startBlock("hr", "", {});
      const active = this.getActiveBlock();
      if (active) {
        active.closed = true;
        this.options.onBlockComplete?.(active);
      }
      return;
    }

    // ── Blockquote ──
    const bqMatch = line.match(/^>\s?(.*)/);
    if (bqMatch) {
      const active = this.getActiveBlock();
      if (active && active.type === "blockquote" && !active.closed) {
        active.content += (active.content ? "\n" : "") + bqMatch[1];
      } else {
        this.closeActiveBlock();
        this.startBlock("blockquote", bqMatch[1]!, {});
      }
      return;
    }

    // ── Unordered list ──
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.*)/);
    if (ulMatch) {
      const active = this.getActiveBlock();
      if (active && active.type === "list" && !active.meta.ordered && !active.closed) {
        active.content += "\n" + line;
      } else {
        this.closeActiveBlock();
        this.startBlock("list", line, { ordered: false });
      }
      return;
    }

    // ── Ordered list ──
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)/);
    if (olMatch) {
      const active = this.getActiveBlock();
      if (active && active.type === "list" && active.meta.ordered && !active.closed) {
        active.content += "\n" + line;
      } else {
        this.closeActiveBlock();
        this.startBlock("list", line, { ordered: true });
      }
      return;
    }

    // ── Table ──
    if (line.includes("|")) {
      const active = this.getActiveBlock();
      if (active && active.type === "table" && !active.closed) {
        active.content += "\n" + line;
        return;
      }
      if (active && active.type === "paragraph" && !active.closed && active.content.includes("|")) {
        active.type = "table";
        active.content += "\n" + line;
        return;
      }
      if (line.trim().startsWith("|") || (line.includes("|") && line.trim().match(/^[|:\-\s]+$/))) {
        this.closeActiveBlock();
        this.startBlock("table", line, {});
        return;
      }
    }

    // ── Paragraph (default) ──
    const active = this.getActiveBlock();
    if (active && active.type === "paragraph" && !active.closed) {
      active.content += "\n" + line;
    } else {
      this.closeActiveBlock();
      this.startBlock("paragraph", line, {});
    }
  }

  private isClosingFence(trimmed: string): boolean {
    if (trimmed.length < this.codeFenceCount) return false;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] !== this.codeFenceChar) {
        return trimmed.slice(i).trim() === "";
      }
    }
    return true;
  }

  private getActiveBlock(): Block | null {
    if (this.blocks.length === 0) return null;
    const last = this.blocks[this.blocks.length - 1]!;
    return last.closed ? null : last;
  }

  private closeActiveBlock(): void {
    const active = this.getActiveBlock();
    if (active) {
      active.closed = true;
      this.options.onBlockComplete?.(active);
    }
  }

  private startBlock(type: BlockType, content: string, meta: BlockMeta): void {
    this.blocks.push({
      id: this.nextId(),
      type,
      content,
      closed: false,
      meta,
    });
  }

  /** Reset ID counter (for tests) */
  resetIdCounter(): void {
    this._blockId = 0;
  }
}

