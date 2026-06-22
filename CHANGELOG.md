# Changelog

## Unreleased

## 0.5.0

- Added a reviewable AI context pack workflow with include and exclude decisions before copying.
- Added selected-pack token summaries, per-candidate token estimates, and removed-default-pack estimates.
- Added privacy-preserving feedback report copying for retrieval-quality issues.
- Added a one-time "What's new" modal so users see major changes after updating.
- Added a command to reopen the release notes manually from Obsidian.
- Kept the fast `Copy AI context pack for current note` command unchanged.

## 0.4.1

- Expanded public usage instructions for the AI context pack workflow.
- Added a feedback section and ranking feedback issue template.
- Added GitHub artifact attestations for release assets.
- Updated the Vitest development dependency to keep dependency audits clean.

## 0.4.0

- Added BM25-style lexical scoring alongside TF-IDF cosine similarity.
- Added field-weighted ranking for titles, headings, aliases, metadata, and note bodies.
- Added settings to disable metadata ranking and tune metadata weight.
- Disabled metadata influence across ranking signals when metadata ranking is turned off.
- Refined ranking to reduce noisy alias-only matches in multilingual vaults.
- Added source-title matching so entity-centered MOC notes can find notes that reference the source title.
- Added a weak-short-note guard so near-empty index notes need stronger evidence before ranking.
- Stopped using generic `type` frontmatter as a metadata ranking signal.
- Excluded common template folders by default on new installs.
- Expanded multilingual stopwords for low-signal terms such as `non`, `no`, `si`, `note`, and structural headings like `notas`, `tareas`, and `relacionadas`.
- Documented fast local retrieval as a core design priority.

## 0.3.1

- Shortened the plugin directory description.
- Removed the `builtin-modules` development dependency from the build configuration.

## 0.3.0

- Renamed the project to Context Prism
- Added configurable multilingual indexing profiles
- Added support for mixed-language vaults through the `multilingual` profile
- Added language profile metadata to copied context packs
- Refined public documentation for the first GitHub release

## 0.2.0

- Repositioned the plugin around token-aware context routing for AI workflows
- Added passive context preparation when opening notes
- Added status bar context candidate summary
- Added AI context pack copying with approximate token savings
- Added context-pack tests

## 0.1.0

- Initial local link suggestion workflow
- TF-IDF ranking
- Title, alias, and metadata signals
- Review modal
- Footer link insertion
- Folder include and exclude settings
