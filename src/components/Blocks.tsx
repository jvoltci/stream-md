import * as React from "react";
import { memo, useState, useCallback, useMemo } from "react";
import type {
  Block,
  ComponentOverrides,
  HighlighterFn,
  InlinePlugin,
} from "../parser/types";
import { InlineRenderer } from "./InlineRenderer";
import { highlight as defaultHighlight } from "../highlight/highlighter";
import {
  parseTable,
  parseListItems,
  type ParsedListItem,
  type ParsedTable,
} from "../parser/StreamParser";

// ── Heading ──

interface BlockProps {
  block: Block;
  overrides?: Partial<ComponentOverrides>;
  inlinePlugins?: InlinePlugin[];
  isActive?: boolean;
}

export const HeadingBlock = memo(function HeadingBlock({
  block,
  overrides,
  inlinePlugins,
}: BlockProps) {
  const level = block.meta.level ?? 1;
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  const className = `smd-heading smd-h${level}`;
  return (
    <Tag className={className}>
      <InlineRenderer
        text={block.content}
        {...(overrides ? { overrides } : {})}
        {...(inlinePlugins ? { inlinePlugins } : {})}
      />
    </Tag>
  );
});

// ── Paragraph ──

export const ParagraphBlock = memo(function ParagraphBlock({
  block,
  overrides,
  inlinePlugins,
}: BlockProps) {
  return (
    <p className="smd-paragraph">
      <InlineRenderer
        text={block.content}
        {...(overrides ? { overrides } : {})}
        {...(inlinePlugins ? { inlinePlugins } : {})}
      />
    </p>
  );
});

// ── Code Block ──
// Streaming-aware: while active, render plain code (no highlight per token).
// On `closed`, run the highlighter once. This is the core of the "highlight
// once, frozen" performance promise.

interface CodeProps extends BlockProps {
  highlighter?: HighlighterFn | undefined;
}

export const CodeBlockComponent = memo(function CodeBlockComponent({
  block,
  overrides,
  isActive,
  highlighter,
}: CodeProps) {
  const language = block.meta.language ?? "";
  const code = block.content.endsWith("\n")
    ? block.content.slice(0, -1)
    : block.content;
  const streaming = !!isActive && !block.closed;

  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  // Memoize highlighting on the closed code only. Hook must be unconditional.
  const tokens = useMemo(() => {
    if (streaming) return null; // render plain while streaming
    const fn = highlighter ?? defaultHighlight;
    return fn(code, language);
  }, [streaming, code, language, highlighter]);

  const Pre = overrides?.pre;
  if (Pre) {
    return <Pre block={block} language={language} code={code} streaming={streaming} />;
  }

  return (
    <div className={`smd-code-block${streaming ? " smd-code-streaming" : ""}`}>
      <div className="smd-code-header">
        {language && <span className="smd-code-lang">{language}</span>}
        <button
          type="button"
          className="smd-code-copy"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="smd-pre">
        <code className={`smd-code language-${language}`}>
          {tokens === null
            ? code
            : tokens.map((t, i) =>
                t.className ? (
                  <span key={i} className={t.className}>
                    {t.text}
                  </span>
                ) : (
                  <React.Fragment key={i}>{t.text}</React.Fragment>
                ),
              )}
        </code>
      </pre>
    </div>
  );
});

// ── List ──

export const ListBlock = memo(function ListBlock({
  block,
  overrides,
  inlinePlugins,
}: BlockProps) {
  const ordered = block.meta.ordered ?? false;
  const items = useMemo<ParsedListItem[]>(() => {
    if (block.closed && Array.isArray(block.meta.parsed)) {
      return block.meta.parsed as ParsedListItem[];
    }
    return parseListItems(block.content);
  }, [block.closed, block.content, block.meta.parsed]);

  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={`smd-list smd-list-${ordered ? "ol" : "ul"}`}
      {...(ordered && block.meta.start && block.meta.start !== 1
        ? { start: block.meta.start }
        : {})}
    >
      {items.map((item, i) => (
        <ListItem
          key={i}
          item={item}
          {...(overrides ? { overrides } : {})}
          {...(inlinePlugins ? { inlinePlugins } : {})}
        />
      ))}
    </Tag>
  );
});

interface ListItemProps {
  item: ParsedListItem;
  overrides?: Partial<ComponentOverrides>;
  inlinePlugins?: InlinePlugin[];
}

function ListItem({ item, overrides, inlinePlugins }: ListItemProps) {
  return (
    <li className="smd-list-item">
      {item.isTask !== undefined && (
        <input
          type="checkbox"
          checked={!!item.taskChecked}
          readOnly
          aria-label={item.taskChecked ? "completed task" : "incomplete task"}
          className="smd-task-checkbox"
        />
      )}
      <InlineRenderer
        text={item.text}
        {...(overrides ? { overrides } : {})}
        {...(inlinePlugins ? { inlinePlugins } : {})}
      />
      {item.children && item.children.length > 0 && (
        <ul className="smd-list smd-list-ul">
          {item.children.map((child, i) => (
            <ListItem
              key={i}
              item={child}
              {...(overrides ? { overrides } : {})}
              {...(inlinePlugins ? { inlinePlugins } : {})}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Table ──

export const TableBlock = memo(function TableBlock({
  block,
  overrides,
  inlinePlugins,
}: BlockProps) {
  const parsed = useMemo<ParsedTable>(() => {
    if (block.closed && block.meta.parsed && typeof block.meta.parsed === "object") {
      return block.meta.parsed as ParsedTable;
    }
    return parseTable(block.content);
  }, [block.closed, block.content, block.meta.parsed]);
  const { headers, rows, alignments } = parsed;

  const Tbl = overrides?.table;
  if (Tbl) return <Tbl block={block} headers={headers} rows={rows} alignments={alignments} />;

  const alignClass = (a: "left" | "center" | "right" | "none" | undefined) =>
    a && a !== "none" ? `smd-align-${a}` : "";

  return (
    <div className="smd-table-wrapper">
      <table className="smd-table">
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className={alignClass(alignments[i])}>
                  <InlineRenderer
                    text={h}
                    {...(overrides ? { overrides } : {})}
                    {...(inlinePlugins ? { inlinePlugins } : {})}
                  />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className={alignClass(alignments[ci])}>
                  <InlineRenderer
                    text={cell}
                    {...(overrides ? { overrides } : {})}
                    {...(inlinePlugins ? { inlinePlugins } : {})}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

// ── Blockquote ──

export const BlockquoteBlock = memo(function BlockquoteBlock({
  block,
  overrides,
  inlinePlugins,
}: BlockProps) {
  return (
    <blockquote className="smd-blockquote">
      <InlineRenderer
        text={block.content}
        {...(overrides ? { overrides } : {})}
        {...(inlinePlugins ? { inlinePlugins } : {})}
      />
    </blockquote>
  );
});

// ── Horizontal Rule ──

export const HorizontalRuleBlock = memo(function HorizontalRuleBlock() {
  return <hr className="smd-hr" />;
});

// ── HTML (sanitized — only when allowHtml=true at parser level; else won't reach here) ──

export const HtmlBlock = memo(function HtmlBlock({ block }: BlockProps) {
  // Without DOMPurify, we still escape and render as preformatted text rather
  // than risk injecting raw HTML. Users who genuinely want raw HTML must wire
  // a custom override.
  return (
    <div className="smd-html-block">
      <pre>{block.content}</pre>
    </div>
  );
});
