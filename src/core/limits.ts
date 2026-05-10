/**
 * Hard limits to defend against pathological / adversarial input.
 * All values are overridable via parser options.
 */

export interface Limits {
  /** Maximum total document length the parser will accept (default: 1 MB). */
  maxDocLength: number;
  /** Maximum nesting depth for inline tokens (bold/italic/etc). */
  maxInlineDepth: number;
  /** Maximum number of inline tokens a single block can produce. */
  maxInlineTokens: number;
  /** Maximum list nesting depth. */
  maxListDepth: number;
  /** Maximum table column count. */
  maxTableColumns: number;
}

export const DEFAULT_LIMITS: Limits = {
  maxDocLength: 1_000_000,
  maxInlineDepth: 4,
  maxInlineTokens: 50_000,
  maxListDepth: 10,
  maxTableColumns: 100,
};

export function clampText(text: string, limits: Pick<Limits, "maxDocLength">): string {
  if (text.length <= limits.maxDocLength) return text;
  return text.slice(0, limits.maxDocLength);
}
