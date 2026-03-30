// ═══════════════════════════════════════════════════════════════
// StreamMD — Block Components
// ═══════════════════════════════════════════════════════════════

import React, { memo, useState, useCallback } from "react";
import type { Block, ComponentOverrides } from "../parser/types";
import { InlineRenderer } from "./InlineRenderer";
import { highlight } from "../highlight/highlighter";

// ── Heading ──────────────────────────────────────────────────

interface HeadingProps {
  block: Block;
  overrides?: Partial<ComponentOverrides>;
}

export const HeadingBlock = memo(function HeadingBlock({ block, overrides }: HeadingProps) {
  const level = block.meta.level || 1;
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  const className = `smd-heading smd-h${level}`;

  return (
    <Tag className={className}>
      <InlineRenderer text={block.content} overrides={overrides} />
    </Tag>
  );
});

// ── Paragraph ────────────────────────────────────────────────

interface ParagraphProps {
  block: Block;
  overrides?: Partial<ComponentOverrides>;
}

export const ParagraphBlock = memo(function ParagraphBlock({ block, overrides }: ParagraphProps) {
  return (
    <p className="smd-paragraph">
      <InlineRenderer text={block.content} overrides={overrides} />
    </p>
  );
});

// ── Code Block ───────────────────────────────────────────────

interface CodeBlockComponentProps {
  block: Block;
  overrides?: Partial<ComponentOverrides>;
}

export const CodeBlockComponent = memo(function CodeBlockComponent({ block, overrides }: CodeBlockComponentProps) {
  const language = block.meta.language || "";
  const code = block.content.endsWith("\n")
    ? block.content.slice(0, -1)
    : block.content;

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  // Use custom override if provided
  const Pre = overrides?.pre;
  if (Pre) {
    return <Pre block={block} language={language} code={code} />;
  }

  const tokens = highlight(code, language);

  return (
    <div className="smd-code-block">
      <div className="smd-code-header">
        {language && <span className="smd-code-lang">{language}</span>}
        <button
          className="smd-code-copy"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="smd-pre">
        <code className={`smd-code language-${language}`}>
          {tokens.map((t, i) =>
            t.className ? (
              <span key={i} className={t.className}>{t.text}</span>
            ) : (
              <React.Fragment key={i}>{t.text}</React.Fragment>
            )
          )}
        </code>
      </pre>
    </div>
  );
});

// ── List ─────────────────────────────────────────────────────

interface ListProps {
  block: Block;
  overrides?: Partial<ComponentOverrides>;
}

export const ListBlock = memo(function ListBlock({ block, overrides }: ListProps) {
  const ordered = block.meta.ordered || false;
  const items = parseListItems(block.content);
  const Tag = ordered ? "ol" : "ul";

  return (
    <Tag className={`smd-list smd-list-${ordered ? "ol" : "ul"}`}>
      {items.map((item, i) => (
        <li key={i} className="smd-list-item">
          {item.isTask !== undefined && (
            <input
              type="checkbox"
              checked={item.isTask}
              readOnly
              className="smd-task-checkbox"
            />
          )}
          <InlineRenderer text={item.text} overrides={overrides} />
        </li>
      ))}
    </Tag>
  );
});

interface ListItem {
  text: string;
  isTask?: boolean;
}

function parseListItems(content: string): ListItem[] {
  const lines = content.split("\n");
  const items: ListItem[] = [];

  for (const line of lines) {
    // Strip the list marker
    const match = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)/);
    if (match) {
      let text = match[1]!;
      let isTask: boolean | undefined;

      // Task list
      const taskMatch = text.match(/^\[([ xX])\]\s+(.*)/);
      if (taskMatch) {
        isTask = taskMatch[1] !== " ";
        text = taskMatch[2]!;
      }

      items.push({ text, isTask });
    }
  }

  return items;
}

// ── Table ────────────────────────────────────────────────────

interface TableProps {
  block: Block;
  overrides?: Partial<ComponentOverrides>;
}

export const TableBlock = memo(function TableBlock({ block, overrides }: TableProps) {
  const { headers, rows, alignments } = parseTable(block.content);

  const Tbl = overrides?.table;
  if (Tbl) {
    return <Tbl block={block} headers={headers} rows={rows} alignments={alignments} />;
  }

  return (
    <div className="smd-table-wrapper">
      <table className="smd-table">
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{ textAlign: alignments[i] || "left" }}>
                  <InlineRenderer text={h} overrides={overrides} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ textAlign: alignments[ci] || "left" }}>
                  <InlineRenderer text={cell} overrides={overrides} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

function parseTable(content: string): {
  headers: string[];
  rows: string[][];
  alignments: ("left" | "center" | "right")[];
} {
  const lines = content.split("\n").filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], alignments: [] };

  const parseCells = (line: string): string[] =>
    line.split("|").map(s => s.trim()).filter((_, i, arr) =>
      // Filter empty first/last from leading/trailing |
      !((i === 0 || i === arr.length - 1) && arr[i]?.trim() === "")
    );

  const headers = parseCells(lines[0]!);

  // Check for alignment row
  let alignments: ("left" | "center" | "right")[] = [];
  let dataStart = 1;

  if (lines.length > 1 && /^[\s|:\-]+$/.test(lines[1]!)) {
    const aligns = parseCells(lines[1]!);
    alignments = aligns.map(a => {
      const t = a.trim();
      if (t.startsWith(":") && t.endsWith(":")) return "center";
      if (t.endsWith(":")) return "right";
      return "left";
    });
    dataStart = 2;
  }

  const rows = lines.slice(dataStart).map(parseCells);

  return { headers, rows, alignments };
}

// ── Blockquote ───────────────────────────────────────────────

interface BlockquoteProps {
  block: Block;
  overrides?: Partial<ComponentOverrides>;
}

export const BlockquoteBlock = memo(function BlockquoteBlock({ block, overrides }: BlockquoteProps) {
  return (
    <blockquote className="smd-blockquote">
      <InlineRenderer text={block.content} overrides={overrides} />
    </blockquote>
  );
});

// ── Horizontal Rule ──────────────────────────────────────────

export const HorizontalRuleBlock = memo(function HorizontalRuleBlock() {
  return <hr className="smd-hr" />;
});
