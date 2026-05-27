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
- exact title or alias mention
- shared frontmatter metadata

Existing links and self-links are excluded before ranking.

## Language Profiles

The index accepts one or more language profiles from settings. `multilingual` combines all supported stopword lists, while profiles such as `en`, `es`, `fr`, `de`, `it`, and `pt` narrow the stopword layer for more focused lexical ranking.

This is intentionally lightweight. Context Prism does not translate notes, call external language models, or require embeddings.

## AI Context Routing

When a note becomes active, the plugin can prepare candidates in the background and show a status bar summary. The `Copy AI context pack for current note` command creates a compact Markdown artifact with paths, snippets, ranking reasons, estimated full-note tokens, and estimated avoided context.

## Safety Model

The plugin does not rewrite inline prose. It only appends accepted links to a configured section after user confirmation.
