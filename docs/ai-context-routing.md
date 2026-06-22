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

- `Copy AI context pack for current note`: fast path that copies a stricter high-confidence context pack.
- `Review AI context pack for current note`: opens a review modal for the same ranked candidates so the user can include or exclude notes before copying the selected pack.
- `Review link suggestions for current note`: opens the same candidates for optional link insertion.
- `Rebuild link index`: rebuilds the local retrieval index.

## Review Workflow

Use `Review AI context pack for current note` when the exact context should be inspected before leaving the vault.

The modal uses a stable candidate snapshot for the active source note. It does not rebuild the index, rerun ranking, call external services, or change ranking scores when checkboxes are toggled.

The default selected candidates are the notes that the fast copy command would include. This default is intentionally stricter than the full review list: weak operational candidates, very short title-only matches, and candidates with only low-signal shared terms are not preselected for direct copy. Users can clear, restore, or adjust the selection, then copy only the selected candidates in the original rank order.

The footer shows selected note count, approximate selected context-pack tokens, and estimated avoided context. The avoided-context baseline remains the indexed vault token estimate minus the selected context-pack estimate; it is not a model-specific context-window saving.

The feedback-report action copies a Markdown template for ranking-quality feedback. By default it omits snippets, note bodies, and full paths unless the user explicitly opts into including paths.

## Evaluation Metrics

Track quality with:

- precision@k: how many copied candidates are actually useful
- avoided tokens: estimated vault tokens minus context pack tokens
- removed default-pack tokens: candidate-block tokens excluded during review
- follow-up rate: how often the assistant still needs more notes
- accepted links: how often candidates become durable wiki-links

## Status Bar

When automatic context preparation is enabled, opening a note updates the status bar with candidate count and approximate avoided context.
