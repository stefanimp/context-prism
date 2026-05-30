# AI Context Routing

Context Prism is designed for workflows where an AI assistant needs vault context but should not read the whole vault.

For compatibility details across ChatGPT, Claude, Codex, Antigravity, Cursor, and similar tools, see `docs/ai-assistant-compatibility.md`.

## Core Idea

The plugin treats the active note as a query, ranks related notes locally, and produces a compact context pack. This context pack can be pasted into an AI assistant before asking for analysis, refactoring, writing help, or link recommendations.

## Multilingual Vaults

The default `multilingual` profile is designed for vaults that mix languages. Users can also choose one or more explicit profiles:

- `en`: English
- `es`: Spanish
- `fr`: French
- `de`: German
- `it`: Italian
- `pt`: Portuguese

For mixed vaults, use comma-separated profiles such as `en, es` or keep `multilingual`.

## Why This Saves Tokens

Without a local retrieval step, an AI workflow often loads many notes just to discover which ones are relevant. Context Prism moves that discovery step into the vault:

- broad vault scan happens locally
- only top candidates are copied
- snippets are capped
- token estimates make the tradeoff visible

The retrieval step is intentionally lightweight. Context Prism combines TF-IDF and BM25-style lexical ranking instead of slower semantic processing so context packs can be prepared while the user keeps working.

## Commands

- `Copy AI context pack for current note`: copies the compact context pack.
- `Review link suggestions for current note`: opens the same candidates for optional link insertion.
- `Rebuild link index`: rebuilds the local retrieval index.

## Evaluation Metrics

Track quality with:

- precision@k: how many copied candidates are actually useful
- avoided tokens: estimated vault tokens minus context pack tokens
- follow-up rate: how often the assistant still needs more notes
- accepted links: how often candidates become durable wiki-links

## Status Bar

When automatic context preparation is enabled, opening a note updates the status bar with candidate count and approximate avoided context.
