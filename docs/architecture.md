# Architecture

## Components

- `LinkIndexService`: reads Markdown files, builds the index, and returns ranked suggestions.
- `context-pack`: turns ranked candidates into a compact Markdown context pack for AI assistants.
- `token-estimator`: estimates token budgets from local text.
- `text/normalize`: strips Markdown syntax, normalizes text, tokenizes, and removes language-specific stopwords.
- `search/scoring`: contains pure ranking primitives.
- `SuggestionsModal`: renders review UI and collects accepted suggestions.
- `link-writer`: appends accepted links to a footer section.
- `settings`: persists plugin settings and invalidates the index when indexing settings change.

## Ranking

The score combines:

- TF-IDF cosine similarity
- BM25-style query-to-document scoring
- field-weighted terms from titles, headings, aliases, metadata, and note bodies
- title mentions
- lower-weight alias mentions
- source-title references in candidate titles, metadata, or content
- shared frontmatter metadata from areas, topics, and tags

Existing links and self-links are excluded before ranking.

Templates are excluded by default on new installs. The ranking layer also avoids using generic `type` metadata, because fields such as `type: note` tend to connect unrelated files.

Alias mentions are intentionally weaker than title mentions. Single-word aliases are useful, but they can be noisy in multilingual vaults when common verbs or generic terms appear in unrelated notes.

For entity-centered index notes, the source note title is also treated as a lightweight query signal. If the active note is `Project Atlas`, candidates whose title, topics, or content reference `Project Atlas` receive a transparent boost. This helps short index notes avoid being dominated by generic headings such as "Related notes" or "Related tasks".

Very short candidates need stronger evidence before ranking. This prevents near-empty index notes from appearing only because they share generic metadata or structural headings.

Metadata ranking is configurable. Users can disable metadata boosts or tune the metadata weight when `area`, `topics`, or `tags` introduce noise.

## Performance

Context Prism prioritizes responsive local retrieval. The index uses precomputed term maps, TF-IDF vectors, and document lengths for BM25-style scoring, then ranks candidates with cheap lexical and metadata operations. It does not call remote services, generate embeddings, or perform model inference during ranking.

## Language Profiles

The index accepts one or more language profiles from settings. `multilingual` combines all supported stopword lists, while profiles such as `en`, `es`, `fr`, `de`, `it`, and `pt` narrow the stopword layer for more focused lexical ranking.

This is intentionally lightweight. Context Prism does not translate notes, call external language models, or require embeddings.

## AI Context Routing

When a note becomes active, the plugin can prepare candidates in the background and show a status bar summary. The `Copy AI context pack for current note` command creates a compact Markdown artifact with paths, snippets, ranking reasons, estimated full-note tokens, and estimated avoided context.

## Safety Model

The plugin does not rewrite inline prose. It only appends accepted links to a configured section after user confirmation.
