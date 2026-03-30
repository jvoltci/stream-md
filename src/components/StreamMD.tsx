// ═══════════════════════════════════════════════════════════════
// StreamMD — Main Component
// ═══════════════════════════════════════════════════════════════

import React, { useMemo, useRef } from "react";
import { StreamParser } from "../parser/StreamParser";
import type { Block, StreamMDProps, ComponentOverrides } from "../parser/types";
import {
  HeadingBlock,
  ParagraphBlock,
  CodeBlockComponent,
  ListBlock,
  TableBlock,
  BlockquoteBlock,
  HorizontalRuleBlock,
} from "./Blocks";

/**
 * StreamMD — Streaming markdown renderer for LLM token streams.
 *
 * @example
 * ```tsx
 * const [text, setText] = useState('');
 *
 * // On each streaming token:
 * setText(prev => prev + token);
 *
 * return <StreamMD text={text} theme="dark" />;
 * ```
 *
 * @example With Vercel AI SDK:
 * ```tsx
 * const { messages } = useChat();
 * const lastMessage = messages[messages.length - 1];
 *
 * return lastMessage?.role === 'assistant'
 *   ? <StreamMD text={lastMessage.content} />
 *   : null;
 * ```
 */
export function StreamMD({
  text,
  className,
  theme = "dark",
  components,
  onBlockComplete,
}: StreamMDProps): React.JSX.Element {
  const parserRef = useRef<StreamParser | null>(null);

  // Lazily initialize parser
  if (!parserRef.current) {
    parserRef.current = new StreamParser({ onBlockComplete });
  }

  // Parse — the parser internally diffs so this is O(new tokens only)
  const { blocks, activeIndex, incompleteLine } = useMemo(() => {
    const parser = parserRef.current!;
    const result = parser.push(text);
    return {
      ...result,
      incompleteLine: parser.getIncompleteLine(),
    };
  // We intentionally key on text only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const themeClass = theme === "none" ? "" : `smd-theme-${theme}`;

  return (
    <div className={`stream-md ${themeClass} ${className || ""}`.trim()}>
      {blocks.map((block, idx) => {
        const isActive = idx === activeIndex && !block.closed;
        // For the active block, append the incomplete line for display
        const displayBlock = isActive && incompleteLine
          ? { ...block, content: block.content + (block.content ? "\n" : "") + incompleteLine }
          : block;

        return (
          <BlockRenderer
            key={block.id}
            block={displayBlock}
            isActive={isActive}
            overrides={components}
          />
        );
      })}
      {/* If there's an incomplete line but no active block, show as pending paragraph */}
      {incompleteLine && (blocks.length === 0 || blocks[blocks.length - 1]!.closed) && (
        <div className="smd-block smd-block-active">
          <ParagraphBlock
            block={{ id: "_pending", type: "paragraph", content: incompleteLine, closed: false, meta: {} }}
            overrides={components}
          />
        </div>
      )}
    </div>
  );
}

// ── Block Renderer ──────────────────────────────────────────

interface BlockRendererProps {
  block: Block;
  isActive: boolean;
  overrides?: Partial<ComponentOverrides>;
}

/**
 * Renders a single block. Completed blocks are memoized via React.memo
 * on the individual block components. Active blocks always re-render.
 */
function BlockRenderer({ block, isActive, overrides }: BlockRendererProps): React.JSX.Element {
  // For the active (streaming) block, we wrap in a container with a cursor
  const wrapperClass = isActive ? "smd-block smd-block-active" : "smd-block";

  return (
    <div className={wrapperClass}>
      <BlockContent block={block} overrides={overrides} />
    </div>
  );
}

function BlockContent({
  block,
  overrides,
}: {
  block: Block;
  overrides?: Partial<ComponentOverrides>;
}): React.JSX.Element {
  switch (block.type) {
    case "heading":
      return <HeadingBlock block={block} overrides={overrides} />;
    case "paragraph":
      return <ParagraphBlock block={block} overrides={overrides} />;
    case "code":
      return <CodeBlockComponent block={block} overrides={overrides} />;
    case "list":
      return <ListBlock block={block} overrides={overrides} />;
    case "table":
      return <TableBlock block={block} overrides={overrides} />;
    case "blockquote":
      return <BlockquoteBlock block={block} overrides={overrides} />;
    case "hr":
      return <HorizontalRuleBlock />;
    default:
      return <ParagraphBlock block={block} overrides={overrides} />;
  }
}
