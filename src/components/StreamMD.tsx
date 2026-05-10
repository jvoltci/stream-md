"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { StreamParser } from "../parser/StreamParser";
import type {
  Block,
  StreamMDProps,
  ComponentOverrides,
  InlinePlugin,
  HighlighterFn,
} from "../parser/types";
import {
  HeadingBlock,
  ParagraphBlock,
  CodeBlockComponent,
  ListBlock,
  TableBlock,
  BlockquoteBlock,
  HorizontalRuleBlock,
  HtmlBlock,
} from "./Blocks";

/**
 * Internal store that wraps `StreamParser` and notifies subscribers via
 * `useSyncExternalStore`. Avoids the side-effect-in-`useMemo` pitfall and
 * makes the component StrictMode + RSC-safe.
 */
class ParserStore {
  private parser: StreamParser;
  private listeners = new Set<() => void>();
  private snapshot: { blocks: Block[]; activeIndex: number; incompleteLine: string } = {
    blocks: [],
    activeIndex: -1,
    incompleteLine: "",
  };
  private lastText = "";

  constructor(opts: ConstructorParameters<typeof StreamParser>[0]) {
    this.parser = new StreamParser(opts);
  }

  push = (text: string): void => {
    if (text === this.lastText) return;
    const result = this.parser.push(text);
    this.lastText = text;
    // Always create a new snapshot reference so React re-renders. Block
    // identities for closed blocks remain stable, so React.memo still
    // skips them.
    this.snapshot = {
      blocks: result.blocks.slice(),
      activeIndex: result.activeIndex,
      incompleteLine: this.parser.getIncompleteLine(),
    };
    for (const l of this.listeners) l();
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.snapshot;
  getParser = () => this.parser;
}

export function StreamMD({
  text,
  className,
  theme = "dark",
  components,
  onBlockComplete,
  limits,
  highlighter,
  blockPlugins,
  inlinePlugins,
  showCursor = true,
}: StreamMDProps): React.JSX.Element {
  // One store per mount. We deliberately do NOT recreate it on prop changes;
  // changes to text are pushed into the store imperatively below.
  const storeRef = useRef<ParserStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new ParserStore({
      ...(onBlockComplete ? { onBlockComplete } : {}),
      ...(limits ? { limits } : {}),
      ...(blockPlugins ? { blockPlugins } : {}),
    });
  }
  const store = storeRef.current;

  // Push the latest text into the parser. Doing this in `useEffect` keeps
  // rendering pure. The store handles non-prefix changes by resetting.
  useEffect(() => {
    store.push(text);
  }, [text, store]);

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  // Stabilize overrides + plugins so memoized blocks don't re-render on every
  // parent re-render that creates a fresh object literal.
  const stableOverrides = useStable(components);
  const stablePlugins = useStable(inlinePlugins);
  const stableHighlighter = useStable(highlighter);

  const themeClass = theme === "none" ? "" : `smd-theme-${theme}`;
  const showCursorClass = showCursor ? "" : " smd-no-cursor";

  const { blocks, activeIndex, incompleteLine } = snapshot;

  return (
    <div className={`stream-md ${themeClass}${showCursorClass} ${className ?? ""}`.trim()}>
      {blocks.map((block, idx) => {
        const isActive = idx === activeIndex && !block.closed;
        const displayBlock =
          isActive && incompleteLine
            ? {
                ...block,
                content:
                  block.content + (block.content ? "\n" : "") + incompleteLine,
              }
            : block;
        return (
          <BlockRenderer
            key={block.id}
            block={displayBlock}
            isActive={isActive}
            overrides={stableOverrides}
            inlinePlugins={stablePlugins}
            highlighter={stableHighlighter}
            blockPlugins={blockPlugins}
          />
        );
      })}
      {incompleteLine &&
        (blocks.length === 0 || blocks[blocks.length - 1]!.closed) && (
          <div className="smd-block smd-block-active">
            <ParagraphBlock
              block={{
                id: "_pending",
                type: "paragraph",
                content: incompleteLine,
                closed: false,
                meta: {},
              }}
              {...(stableOverrides ? { overrides: stableOverrides } : {})}
              {...(stablePlugins ? { inlinePlugins: stablePlugins } : {})}
            />
          </div>
        )}
    </div>
  );
}

/** Memoize identity-stable references — avoids busting React.memo. */
function useStable<T>(value: T | undefined): T | undefined {
  const ref = useRef<T | undefined>(value);
  return useMemo(() => {
    if (shallowEqual(ref.current, value)) return ref.current;
    ref.current = value;
    return value;
  }, [value]);
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  const ka = Object.keys(a as Record<string, unknown>);
  const kb = Object.keys(b as Record<string, unknown>);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
}

interface BlockRendererProps {
  block: Block;
  isActive: boolean;
  overrides?: Partial<ComponentOverrides>;
  inlinePlugins?: InlinePlugin[];
  highlighter?: HighlighterFn;
  blockPlugins?: import("../parser/types").BlockPlugin[];
}

function BlockRenderer({
  block,
  isActive,
  overrides,
  inlinePlugins,
  highlighter,
  blockPlugins,
}: BlockRendererProps): React.JSX.Element {
  const wrapperClass = isActive ? "smd-block smd-block-active" : "smd-block";
  return (
    <div className={wrapperClass}>
      <BlockContent
        block={block}
        overrides={overrides}
        inlinePlugins={inlinePlugins}
        highlighter={highlighter}
        blockPlugins={blockPlugins}
        isActive={isActive}
      />
    </div>
  );
}

function BlockContent({
  block,
  overrides,
  inlinePlugins,
  highlighter,
  blockPlugins,
  isActive,
}: BlockRendererProps): React.JSX.Element {
  // Plugin block?
  if (block.meta.pluginName && blockPlugins) {
    const plugin = blockPlugins.find((p) => p.name === block.meta.pluginName);
    if (plugin) return <>{plugin.render(block)}</>;
  }

  switch (block.type) {
    case "heading":
      return <HeadingBlock block={block} {...(overrides ? { overrides } : {})} {...(inlinePlugins ? { inlinePlugins } : {})} />;
    case "paragraph":
      return <ParagraphBlock block={block} {...(overrides ? { overrides } : {})} {...(inlinePlugins ? { inlinePlugins } : {})} />;
    case "code":
      return (
        <CodeBlockComponent
          block={block}
          isActive={isActive}
          {...(overrides ? { overrides } : {})}
          {...(highlighter ? { highlighter } : {})}
        />
      );
    case "list":
      return <ListBlock block={block} {...(overrides ? { overrides } : {})} {...(inlinePlugins ? { inlinePlugins } : {})} />;
    case "table":
      return <TableBlock block={block} {...(overrides ? { overrides } : {})} {...(inlinePlugins ? { inlinePlugins } : {})} />;
    case "blockquote":
      return <BlockquoteBlock block={block} {...(overrides ? { overrides } : {})} {...(inlinePlugins ? { inlinePlugins } : {})} />;
    case "hr":
      return <HorizontalRuleBlock />;
    case "html":
      return <HtmlBlock block={block} />;
    case "math":
      // Math blocks are handled by a math plugin; if none configured, fall back.
      return <ParagraphBlock block={block} {...(overrides ? { overrides } : {})} {...(inlinePlugins ? { inlinePlugins } : {})} />;
    default:
      return <ParagraphBlock block={block} {...(overrides ? { overrides } : {})} {...(inlinePlugins ? { inlinePlugins } : {})} />;
  }
}
