# Synthetic Demo: AI Context Pack Workflow

This demo uses fictional notes. It is meant to show the workflow without exposing a real vault.

## Scenario

You are writing a project note in Obsidian and want an AI assistant to help plan the next steps. The vault contains related notes, but manually deciding what to paste is slow.

Active note:

```markdown
# Local AI Research Assistant

Goal: build a local-first assistant that helps students retrieve useful study notes before asking an LLM for help.

Constraints:
- no external API calls from the vault
- multilingual notes
- explainable ranking
- short context packs for ChatGPT, Claude, Codex, and Cursor

Open question: should retrieval use lexical scoring first, embeddings, or both?
```

## Relevant Notes in the Vault

Context Prism might rank these notes highly:

| Candidate note | Why it is useful |
| --- | --- |
| `Projects/Study Assistant Architecture.md` | Shares the project goal and local-first constraints |
| `Research/Lexical Retrieval vs Embeddings.md` | Covers the TF-IDF, BM25, and embeddings tradeoff |
| `AI Workflows/Prompt Context Budget.md` | Explains why shorter context packs are easier to inspect |
| `Languages/Multilingual Note Search.md` | Covers multilingual retrieval issues |

It should rank these lower:

| Candidate note | Why it is less useful |
| --- | --- |
| `Journal/2026-01-12.md` | Mentions "assistant" casually but has no project detail |
| `Templates/Project Note Template.md` | Shares common template words but no useful content |
| `Books/Productivity Quotes.md` | Mentions studying, but not retrieval or AI context |

## Example Context Pack

The user runs `Copy AI context pack for current note` and pastes a compact pack into an assistant:

```markdown
# Context Prism Pack

Source note: Projects/Local AI Research Assistant.md
Approximate source tokens: 95
Candidate notes: 4
Approximate context pack tokens: 520
Estimated avoided context: 3,800 tokens

## 1. Projects/Study Assistant Architecture.md

Reasons:
- shared project terms: local-first, assistant, students, study notes
- title match: assistant
- metadata overlap: projects, ai, education

Snippet:
The assistant should retrieve a small set of study notes before the user asks for a generated explanation. The retrieval layer must be local-first and inspectable.

## 2. Research/Lexical Retrieval vs Embeddings.md

Reasons:
- strong BM25 match: lexical retrieval, embeddings, ranking
- heading match: Retrieval Tradeoffs

Snippet:
Lexical ranking is faster and easier to explain. Embeddings can capture semantic similarity, but require more infrastructure and make failures harder to inspect.

## 3. AI Workflows/Prompt Context Budget.md

Reasons:
- shared terms: context, token budget, assistant
- metadata overlap: ai workflows

Snippet:
The context given to an assistant should be small enough for the user to audit. Large dumps often reduce answer quality because irrelevant notes compete with useful evidence.

## 4. Languages/Multilingual Note Search.md

Reasons:
- shared terms: multilingual, notes, retrieval

Snippet:
Mixed-language vaults need stopword handling and field weighting so repeated words do not dominate retrieval across unrelated language notes.
```

## Example Assistant Prompt

```text
Use the Context Prism pack below as the primary source of vault context.
Prefer the listed note paths and snippets before asking for more notes.

Task: help me decide whether the first version should use lexical retrieval,
embeddings, or a hybrid approach. Keep the recommendation practical.

[paste Context Prism pack here]
```

## What Good Feedback Looks Like

The most useful feedback is about retrieval quality:

- Did the pack include the notes you would have copied manually?
- Did it miss an obviously important note?
- Did a template, journal entry, or unrelated note rank too high?
- Were the snippets useful enough for the assistant?
- Did the token estimate help you decide what to paste?

If you try Context Prism, please leave 3-minute feedback in the pinned issue:

https://github.com/stefanimp/context-prism/issues/1
