import * as React from "react";
import { parseInline } from "../parser/InlineParser";
import type { InlineToken, ComponentOverrides, InlinePlugin } from "../parser/types";

interface InlineRendererProps {
  text: string;
  overrides?: Partial<ComponentOverrides>;
  inlinePlugins?: InlinePlugin[];
  /** Disable speculative-close (used inside non-streaming contexts). */
  tentative?: boolean;
}

export function InlineRenderer({
  text,
  overrides,
  inlinePlugins,
  tentative,
}: InlineRendererProps): React.JSX.Element {
  const tokens = parseInline(text, {
    plugins: inlinePlugins,
    ...(tentative !== undefined ? { tentative } : {}),
  });
  return (
    <>
      {tokens.map((token, i) =>
        renderToken(token, i, overrides, inlinePlugins),
      )}
    </>
  );
}

function tentativeProps(t: InlineToken): { className?: string; "data-tentative"?: "true" } {
  if (!t.tentative) return {};
  return { className: "smd-tentative", "data-tentative": "true" };
}

export function renderToken(
  token: InlineToken,
  key: number,
  overrides?: Partial<ComponentOverrides>,
  plugins?: InlinePlugin[],
): React.ReactNode {
  // Plugin renderer.
  if (plugins?.length) {
    for (const p of plugins) {
      if (p.render && (p.name === token.type || token.type === "math")) {
        const node = p.render(token);
        if (node !== null && node !== undefined) {
          return <React.Fragment key={key}>{node}</React.Fragment>;
        }
      }
    }
  }

  switch (token.type) {
    case "text":
      return <React.Fragment key={key}>{token.content}</React.Fragment>;
    case "br":
      return <br key={key} />;

    case "bold": {
      const Strong = overrides?.strong;
      const inner = token.children
        ? token.children.map((t, i) => renderToken(t, i, overrides, plugins))
        : token.content;
      const tProps = tentativeProps(token);
      if (Strong) return <Strong key={key}>{inner}</Strong>;
      return (
        <strong key={key} {...tProps}>
          {inner}
        </strong>
      );
    }

    case "italic": {
      const Em = overrides?.em;
      const inner = token.children
        ? token.children.map((t, i) => renderToken(t, i, overrides, plugins))
        : token.content;
      const tProps = tentativeProps(token);
      if (Em) return <Em key={key}>{inner}</Em>;
      return (
        <em key={key} {...tProps}>
          {inner}
        </em>
      );
    }

    case "bolditalic": {
      const inner = token.children
        ? token.children.map((t, i) => renderToken(t, i, overrides, plugins))
        : token.content;
      const tProps = tentativeProps(token);
      return (
        <strong key={key} {...tProps}>
          <em>{inner}</em>
        </strong>
      );
    }

    case "code": {
      const Code = overrides?.code;
      if (Code) return <Code key={key}>{token.content}</Code>;
      return (
        <code key={key} className={`smd-inline-code${token.tentative ? " smd-tentative" : ""}`} {...(token.tentative ? { "data-tentative": "true" as const } : {})}>
          {token.content}
        </code>
      );
    }

    case "link": {
      const A = overrides?.a;
      // Already sanitized in parser; if href is missing the parser would have
      // emitted text instead.
      if (!token.href) {
        return <React.Fragment key={key}>{token.content}</React.Fragment>;
      }
      const inner = token.children
        ? token.children.map((t, i) => renderToken(t, i, overrides, plugins))
        : token.content;
      if (A) {
        const aProps: { href: string; title?: string; children: React.ReactNode } = {
          href: token.href,
          children: inner,
        };
        if (token.title !== undefined) aProps.title = token.title;
        return <A key={key} {...aProps} />;
      }
      const isExternal = /^(https?:|mailto:|tel:)/i.test(token.href);
      return (
        <a
          key={key}
          href={token.href}
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
          {inner}
        </a>
      );
    }

    case "strikethrough": {
      const Del = overrides?.del;
      const inner = token.children
        ? token.children.map((t, i) => renderToken(t, i, overrides, plugins))
        : token.content;
      const tProps = tentativeProps(token);
      if (Del) return <Del key={key}>{inner}</Del>;
      return (
        <del key={key} {...tProps}>
          {inner}
        </del>
      );
    }

    case "image": {
      const Img = overrides?.img;
      if (!token.href) {
        return <React.Fragment key={key}>{token.content}</React.Fragment>;
      }
      if (Img) {
        const props: { src: string; alt: string; title?: string } = {
          src: token.href,
          alt: token.alt ?? "",
        };
        if (token.title !== undefined) props.title = token.title;
        return <Img key={key} {...props} />;
      }
      return (
        <img
          key={key}
          src={token.href}
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
