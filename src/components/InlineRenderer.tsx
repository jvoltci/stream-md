// ═══════════════════════════════════════════════════════════════
// StreamMD — Inline Renderer Component
// ═══════════════════════════════════════════════════════════════

import React from "react";
import { parseInline } from "../parser/InlineParser";
import type { InlineToken, ComponentOverrides } from "../parser/types";

interface InlineRendererProps {
  text: string;
  overrides?: Partial<ComponentOverrides>;
}

export function InlineRenderer({ text, overrides }: InlineRendererProps): React.JSX.Element {
  const tokens = parseInline(text);
  return <>{tokens.map((token, i) => renderToken(token, i, overrides))}</>;
}

function renderToken(
  token: InlineToken,
  key: number,
  overrides?: Partial<ComponentOverrides>
): React.ReactNode {
  switch (token.type) {
    case "text":
      return <React.Fragment key={key}>{token.content}</React.Fragment>;

    case "bold": {
      const Strong = overrides?.strong;
      const inner = token.children
        ? token.children.map((t, i) => renderToken(t, i, overrides))
        : token.content;
      return Strong
        ? <Strong key={key}>{inner}</Strong>
        : <strong key={key}>{inner}</strong>;
    }

    case "italic": {
      const Em = overrides?.em;
      const inner = token.children
        ? token.children.map((t, i) => renderToken(t, i, overrides))
        : token.content;
      return Em
        ? <Em key={key}>{inner}</Em>
        : <em key={key}>{inner}</em>;
    }

    case "bolditalic": {
      const inner = token.children
        ? token.children.map((t, i) => renderToken(t, i, overrides))
        : token.content;
      return <strong key={key}><em>{inner}</em></strong>;
    }

    case "code": {
      const Code = overrides?.code;
      return Code
        ? <Code key={key}>{token.content}</Code>
        : <code key={key} className="smd-inline-code">{token.content}</code>;
    }

    case "link": {
      const A = overrides?.a;
      return A
        ? <A key={key} href={token.href!}>{token.content}</A>
        : (
            <a key={key} href={token.href} target="_blank" rel="noopener noreferrer" className="smd-link">
              {token.content}
            </a>
          );
    }

    case "strikethrough": {
      const Del = overrides?.del;
      const inner = token.children
        ? token.children.map((t, i) => renderToken(t, i, overrides))
        : token.content;
      return Del
        ? <Del key={key}>{inner}</Del>
        : <del key={key}>{inner}</del>;
    }

    case "image": {
      const Img = overrides?.img;
      return Img
        ? <Img key={key} src={token.href!} alt={token.alt || ""} />
        : <img key={key} src={token.href} alt={token.alt || ""} className="smd-image" />;
    }

    default:
      return <React.Fragment key={key}>{token.content}</React.Fragment>;
  }
}
