# Security

## Threat model

`stream-md` renders **untrusted text** from LLMs. The default posture is:

- **URL sanitizer is on, by default, with no opt-out for `javascript:` and `vbscript:`**. These schemes are always rejected from links, images, and autolinks.
- **`data:` URIs are allowed only for images** (and only `data:image/...;base64,...`). All other `data:` schemes (text/html, text/javascript, …) are rejected.
- **Raw HTML in markdown is disabled by default.** Set `allowHtml: true` to opt in; even then, content is rendered into a `<pre>` (no `dangerouslySetInnerHTML`).
- **Inline parser recursion is hard-capped** (default 4 levels) to prevent stack overflow from adversarial nesting.
- **Document length is hard-capped** (default 1 MB) to prevent denial-of-service from oversize input.
- **External links** receive `target="_blank"`, `rel="noopener noreferrer"`, and `referrerPolicy="no-referrer"` by default to prevent tabnabbing and referrer leaks.
- **Tables avoid inline `style` attributes** — alignment is conveyed via classes (`smd-align-left|center|right`) so strict CSPs (no `'unsafe-inline'` for styles) work.

## What `stream-md` does NOT do

- It does **not** sanitize raw HTML even when `allowHtml: true`. If you need to allow user-authored HTML safely, run it through DOMPurify yourself first.
- It does **not** validate that a URL points at a reachable host. A sanitized URL is one with a known-safe scheme; the destination is still attacker-controlled.

## Configuring sanitization

```ts
import { sanitizeUrl } from 'stream-md';

sanitizeUrl('javascript:alert(1)');                 // null (rejected)
sanitizeUrl('https://x.com');                       // 'https://x.com'
sanitizeUrl('weird:thing', { allowedProtocols: ['weird'] }); // 'weird:thing'
```

For images:

```ts
import { sanitizeImageUrl } from 'stream-md';

sanitizeImageUrl('data:image/png;base64,…');       // allowed
sanitizeImageUrl('data:image/png;base64,…', { allowDataImages: false }); // null
```

## Reporting a vulnerability

Please email security reports to the maintainer at the address listed in `package.json#funding` rather than filing a public GitHub issue. We aim to acknowledge within 72 hours and ship a fix within 14 days for high-severity issues.
