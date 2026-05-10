// Server component — runs on the server only. Do NOT add a client directive here.
import * as React from "react";
import { parseToBlocks } from "../server";
import { highlight as defaultHighlight } from "../highlight/highlighter";
import { parseTable, parseListItems } from "../parser/StreamParser";
import { sanitizeUrl, sanitizeImageUrl } from "../core/sanitize";
import { parseInline } from "../parser/InlineParser";
import type { Block, InlineToken } from "../parser/types";

export interface StreamMDServerProps {
  text: string;
  className?: string;
  theme?: "dark" | "light" | "none";
}

/**
 * Server-rendered streaming markdown.
 *
 * Use this in RSC for the first paint of a saved assistant message — emits
 * pure HTML (no client JS needed). For *live* streaming, use the client
 * `<StreamMD>` from `stream-md` or `stream-md/next`.
 */
export function StreamMDServer({
  text,
  className,
  theme = "dark",
}: StreamMDServerProps): React.JSX.Element {
  const blocks = parseToBlocks(text);
  const themeClass = theme === "none" ? "" : `smd-theme-${theme}`;
  return (
    <div className={`stream-md ${themeClass} ${className ?? ""}`.trim()}>
      {blocks.map((b) => (
        <ServerBlock key={b.id} block={b} />
      ))}
    </div>
  );
}

function ServerBlock({ block }: { block: Block }): React.JSX.Element {
  switch (block.type) {
    case "heading": {
      const level = block.meta.level ?? 1;
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      return (
        <Tag className={`smd-heading smd-h${level}`}>
          <ServerInline text={block.content} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p className="smd-paragraph">
          <ServerInline text={block.content} />
        </p>
      );
    case "code": {
      const lang = block.meta.language ?? "";
      const code = block.content.endsWith("\n")
        ? block.content.slice(0, -1)
        : block.content;
      const tokens = defaultHighlight(code, lang);
      return (
        <div className="smd-code-block">
          <div className="smd-code-header">
            {lang && <span className="smd-code-lang">{lang}</span>}
          </div>
          <pre className="smd-pre">
            <code className={`smd-code language-${lang}`}>
              {tokens.map((t, i) =>
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
    }
    case "list": {
      const items = parseListItems(block.content);
      const ordered = block.meta.ordered ?? false;
      const Tag = ordered ? "ol" : "ul";
      const renderItem = (item: ReturnType<typeof parseListItems>[number], i: number): React.JSX.Element => (
        <li key={i} className="smd-list-item">
          {item.isTask !== undefined && (
            <input
              type="checkbox"
              checked={!!item.taskChecked}
              readOnly
              aria-label={item.taskChecked ? "completed task" : "incomplete task"}
              className="smd-task-checkbox"
            />
          )}
          <ServerInline text={item.text} />
          {item.children && item.children.length > 0 && (
            <ul className="smd-list smd-list-ul">
              {item.children.map(renderItem)}
            </ul>
          )}
        </li>
      );
      return (
        <Tag
          className={`smd-list smd-list-${ordered ? "ol" : "ul"}`}
          {...(ordered && block.meta.start && block.meta.start !== 1
            ? { start: block.meta.start }
            : {})}
        >
          {items.map(renderItem)}
        </Tag>
      );
    }
    case "table": {
      const { headers, rows, alignments } = parseTable(block.content);
      return (
        <div className="smd-table-wrapper">
          <table className="smd-table">
            {headers.length > 0 && (
              <thead>
                <tr>
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className={
                        alignments[i] && alignments[i] !== "none"
                          ? `smd-align-${alignments[i]}`
                          : ""
                      }
                    >
                      <ServerInline text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={
                        alignments[ci] && alignments[ci] !== "none"
                          ? `smd-align-${alignments[ci]}`
                          : ""
                      }
                    >
                      <ServerInline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case "blockquote":
      return (
        <blockquote className="smd-blockquote">
          <ServerInline text={block.content} />
        </blockquote>
      );
    case "hr":
      return <hr className="smd-hr" />;
    default:
      return (
        <p className="smd-paragraph">
          <ServerInline text={block.content} />
        </p>
      );
  }
}

function ServerInline({ text }: { text: string }): React.JSX.Element {
  // No tentative-close on the server: by definition the input is complete.
  const tokens = parseInline(text, { tentative: false });
  return <>{tokens.map((t, i) => renderInline(t, i))}</>;
}

function renderInline(token: InlineToken, key: number): React.ReactNode {
  switch (token.type) {
    case "text":
      return <React.Fragment key={key}>{token.content}</React.Fragment>;
    case "br":
      return <br key={key} />;
    case "bold":
      return (
        <strong key={key}>
          {token.children
            ? token.children.map((t, i) => renderInline(t, i))
            : token.content}
        </strong>
      );
    case "italic":
      return (
        <em key={key}>
          {token.children
            ? token.children.map((t, i) => renderInline(t, i))
            : token.content}
        </em>
      );
    case "bolditalic":
      return (
        <strong key={key}>
          <em>
            {token.children
              ? token.children.map((t, i) => renderInline(t, i))
              : token.content}
          </em>
        </strong>
      );
    case "code":
      return (
        <code key={key} className="smd-inline-code">
          {token.content}
        </code>
      );
    case "link": {
      const safe = sanitizeUrl(token.href);
      if (!safe) return <React.Fragment key={key}>{token.content}</React.Fragment>;
      const isExternal = /^(https?:|mailto:|tel:)/i.test(safe);
      return (
        <a
          key={key}
          href={safe}
          {...(token.title !== undefined ? { title: token.title } : {})}
          {...(isExternal
            ? {
                target: "_blank",
                rel: "noopener noreferrer",
                referrerPolicy: "no-referrer" as const,
              }
            : {})}
          className="smd-link"
        >
          {token.children
            ? token.children.map((t, i) => renderInline(t, i))
            : token.content}
        </a>
      );
    }
    case "strikethrough":
      return (
        <del key={key}>
          {token.children
            ? token.children.map((t, i) => renderInline(t, i))
            : token.content}
        </del>
      );
    case "image": {
      const safe = sanitizeImageUrl(token.href);
      if (!safe) return <React.Fragment key={key}>{token.content}</React.Fragment>;
      return (
        <img
          key={key}
          src={safe}
          alt={token.alt ?? ""}
          {...(token.title !== undefined ? { title: token.title } : {})}
          className="smd-image"
          loading="lazy"
          decoding="async"
        />
      );
    }
    default:
      return <React.Fragment key={key}>{token.content}</React.Fragment>;
  }
}
