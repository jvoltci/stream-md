/**
 * URL sanitization. LLM output is untrusted; default-deny dangerous schemes.
 *
 * Returns the original URL if safe, or `null` if it should be neutralized
 * (callers render the link/image as plain text).
 */

const DANGEROUS_SCHEME = /^(javascript|vbscript|data|file|blob):/i;
const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|avif|bmp|x-icon);base64,[a-z0-9+/=\s]+$/i;
const ALLOWED_PROTOCOL = /^(https?|mailto|tel):/i;
// Control chars (0x00-0x1F + 0x7F) used to smuggle a dangerous scheme.
const CONTROL_CHARS = new RegExp("[\x00-\x1F\x7F]", "g");

export interface SanitizeUrlOptions {
  /** Allow `data:image/...;base64,...` URIs (default: true). Other `data:` schemes are always denied. */
  allowDataImages?: boolean;
  /** Custom protocol allowlist. If provided, replaces the default. */
  allowedProtocols?: string[];
}

export function sanitizeUrl(
  href: string | undefined | null,
  options: SanitizeUrlOptions = {},
): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;

  // Strip control characters that can hide a dangerous scheme (e.g. "java\tscript:").
  const cleaned = trimmed.replace(CONTROL_CHARS, "");

  // Relative URLs and fragments are safe.
  if (cleaned.startsWith("/") || cleaned.startsWith("#") || cleaned.startsWith("?")) {
    return cleaned;
  }

  // No scheme → treat as relative.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) {
    return cleaned;
  }

  // Allow `data:image/...` only.
  if (/^data:/i.test(cleaned)) {
    const allow = options.allowDataImages ?? true;
    if (allow && SAFE_DATA_IMAGE.test(cleaned)) return cleaned;
    return null;
  }

  if (DANGEROUS_SCHEME.test(cleaned)) return null;

  if (options.allowedProtocols) {
    const protoMatch = cleaned.match(/^([a-z][a-z0-9+.-]*):/i);
    if (!protoMatch) return null;
    const proto = protoMatch[1]!.toLowerCase();
    return options.allowedProtocols.includes(proto) ? cleaned : null;
  }

  return ALLOWED_PROTOCOL.test(cleaned) ? cleaned : null;
}

/**
 * For images we restrict more aggressively: only `http`, `https`, and (optionally)
 * `data:image/...`. No `mailto:` etc.
 */
export function sanitizeImageUrl(
  href: string | undefined | null,
  options: SanitizeUrlOptions = {},
): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(CONTROL_CHARS, "");

  if (cleaned.startsWith("/") || cleaned.startsWith("#") || cleaned.startsWith("?")) {
    return cleaned;
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return cleaned;

  if (/^data:/i.test(cleaned)) {
    const allow = options.allowDataImages ?? true;
    if (allow && SAFE_DATA_IMAGE.test(cleaned)) return cleaned;
    return null;
  }

  if (DANGEROUS_SCHEME.test(cleaned)) return null;
  return /^https?:/i.test(cleaned) ? cleaned : null;
}
