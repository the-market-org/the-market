# Session log entry — 2026-11-25, work package 15 task 4: parser-based sanitizer

**What happened:** The regex sanitizer for app fragments was replaced by an HTML parser (`parse5` 8.1.1, released 2026-11-07, pinned exactly) and an allowlist. `stripActiveContent` keeps its signature, so `cleanFragment` and its callers are unchanged. The plan's tag list lacked `button`, which the existing slot tests use for htmx actions, so it was added.

**Key changes:**
- `fragment-sanitizer.ts`: the fragment is parsed, rebuilt and serialised by the parser.
  - Allowed tags: `p`, `div`, `span`, `strong`, `em`, `ul`, `ol`, `li`, `a`, `img`, `h2`–`h4`, `br` and `button`.
  - Dropped with their content: `script`, `style`, `template`, `iframe`, `object`, `embed`, `svg`, `math`, `noscript`, `textarea`, `select` and `title`. Comments go too, and any other element is unwrapped.
  - Allowed attributes: `class`, `id`, `href`, `src`, `alt`, `title`, `hx-get`, `hx-target` and `hx-swap`.
  - `href` and `src` must be `https://` or a path on the store, checked after the parser has decoded entities, with control characters and spaces removed.
- `scopeHtmxRequests` still scopes `hx-get` to `/apps/<appId>/`.
- Tests cover 14 cases with their exact outputs (nested script tags, `onerror` with odd spacing, entity-encoded `javascript:`, protocol-relative links, SVG and MathML events, forms, styles, comments, iframes, text with entities), plus the safe-link rule and htmx scoping. `pnpm test`: 274 pass.
- Not checked on a real server with an installed app. The server-level slot test (`slot-fragments.test.ts`) passes with the new sanitizer.

**Artifacts:**
- [D] App fragments are rebuilt from an allowlist, not cleaned of a blocklist, so a tag or attribute nobody listed is removed by default — invalidates never [high] [2026-11-25]

**Next steps:**
- Task 5: app addresses checked at connect time.
