# AI Assistant Compatibility

Context Prism is usable with AI assistants today through a clipboard-based workflow. It is not yet a direct ChatGPT, Claude, Codex, Antigravity, or Cursor integration.

That distinction matters. The Obsidian plugin prepares compact context inside the vault; the user then decides what to paste into an assistant. Direct agent access requires a companion MCP server or CLI.

## Current Workflow

1. Open a note in Obsidian.
2. Run `Copy AI context pack for current note`.
3. Paste the copied context pack into the assistant.
4. Ask the assistant to answer using the provided note paths, snippets, ranking reasons, and token budget.

This works with any assistant that accepts text input.

## Compatibility Matrix

| Assistant or tool | Works today | How | Notes |
| --- | --- | --- | --- |
| ChatGPT | Yes | Paste the context pack into the chat | No direct vault connector is required for the current workflow |
| Claude | Yes | Paste the context pack into the chat | No direct vault connector is required for the current workflow |
| Claude Code | Yes | Paste the context pack into a task prompt or project file | Direct tool access would require a separate local integration |
| Codex | Yes | Paste the context pack into the task prompt or repository context | Direct tool access would require a separate local integration |
| Antigravity | Yes | Paste the context pack into the agent prompt | Direct tool access depends on the user's local tooling |
| Cursor and similar IDE agents | Yes | Paste the context pack or store it as a local Markdown file | Direct tool access would require a separate local integration |

## Direct Integration Roadmap

MCP is the emerging standard for letting AI clients call external tools and data sources. A Context Prism MCP companion should expose read-only tools:

- `search_notes`: return ranked candidates for a query or source note.
- `fetch_note`: return a specific note or bounded snippet.
- `context_pack`: return the same compact pack produced by the plugin.
- `vault_stats`: return index statistics and approximate token counts.

The plugin proves the workflow inside Obsidian. The MCP companion makes the same retrieval layer available to clients that support tool calling.

## Example Assistant Instruction

```text
Use the Context Prism context pack below as your primary source of vault context. Prefer the listed note paths and snippets before asking for more files. When you make a claim, cite the note path that supports it. If the provided context is insufficient, say exactly which additional note or topic you need.

[paste Context Prism context pack here]
```

## Security Position

- The current plugin is local-first and does not send notes to external services.
- The user explicitly chooses what context leaves Obsidian by copying it.
- The future MCP companion should start read-only.
- The future MCP companion should require an explicit vault allowlist.
