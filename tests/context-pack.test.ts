import { describe, expect, it } from "vitest";
import {
  buildContextPack,
  buildFeedbackReport,
  buildSelectedContextPack,
  createDefaultSelectedPaths,
  filterSelectedSuggestions,
  selectDefaultContextCandidates,
  summarizeContextPackReview
} from "../src/context-pack";
import { estimateTokens } from "../src/token-estimator";
import { ContextPrismSettings, LinkSuggestion } from "../src/types";

const settings: ContextPrismSettings = {
  includeFolders: [],
  excludeFolders: [],
  indexLanguages: ["multilingual"],
  minScore: 0.08,
  maxSuggestions: 12,
  autoPrepareContext: true,
  contextSuggestionCount: 2,
  contextSnippetLength: 80,
  contextTokenBudget: 500,
  footerHeading: "Related notes",
  includeAliases: true,
  includeFrontmatter: false,
  useMetadataRanking: true,
  metadataWeight: 0.08,
  showScores: true,
  lastSeenReleaseNotesVersion: null
};

const suggestions: LinkSuggestion[] = [
  {
    targetPath: "Notes/tfidf.md",
    title: "TF-IDF",
    aliases: [],
    score: 0.4,
    cosine: 0.3,
    bm25: 0.2,
    exactMatch: false,
    metadataScore: 0.2,
    sharedTerms: ["ranking"],
    reasons: ["Shared terms: ranking"],
    snippet: "TF-IDF helps rank related Markdown notes using local lexical evidence.",
    estimatedTokens: 120
  },
  {
    targetPath: "Notes/bm25.md",
    title: "BM25",
    aliases: [],
    score: 0.35,
    cosine: 0.25,
    bm25: 0.3,
    exactMatch: false,
    metadataScore: 0,
    sharedTerms: ["retrieval"],
    reasons: ["Shared terms: retrieval"],
    snippet: "BM25 is useful for local retrieval when notes share focused query terms.",
    estimatedTokens: 90
  },
  {
    targetPath: "Notes/noisy.md",
    title: "Noisy Candidate",
    aliases: [],
    score: 0.2,
    cosine: 0.1,
    bm25: 0.1,
    exactMatch: false,
    metadataScore: 0,
    sharedTerms: ["notes"],
    reasons: ["Shared terms: notes"],
    snippet: "This should only appear when explicitly selected in the review flow.",
    estimatedTokens: 70
  }
];

describe("context packs", () => {
  it("builds a compact token-aware context pack", () => {
    const { markdown, stats } = buildContextPack({
      sourceFile: { path: "Notes/source.md" } as never,
      indexedVaultTokens: 2000,
      settings,
      suggestions: [suggestions[0]]
    });

    expect(markdown).toContain("Context Prism Context Pack");
    expect(markdown).toContain("Estimated avoided context");
    expect(stats.contextPackTokens).toBe(estimateTokens(markdown));
    expect(stats.estimatedTokensSaved).toBeGreaterThan(0);
  });

  it("selects the normal direct-copy candidates by default", () => {
    const selected = createDefaultSelectedPaths({
      sourceFile: { path: "Notes/source.md" } as never,
      indexedVaultTokens: 2000,
      settings,
      suggestions
    });

    expect(selected).toEqual(new Set(["Notes/tfidf.md", "Notes/bm25.md"]));
  });

  it("filters selected candidates while preserving original rank order", () => {
    const selected = filterSelectedSuggestions(
      suggestions,
      new Set(["Notes/noisy.md", "Notes/tfidf.md"])
    );

    expect(selected.map((suggestion) => suggestion.targetPath)).toEqual([
      "Notes/tfidf.md",
      "Notes/noisy.md"
    ]);
  });

  it("handles an empty review selection without implying token savings", () => {
    const summary = summarizeContextPackReview({
      sourceFile: { path: "Notes/source.md" } as never,
      indexedVaultTokens: 2000,
      settings,
      suggestions,
      selectedPaths: new Set()
    });

    expect(summary.selectedCount).toBe(0);
    expect(summary.contextPackTokens).toBe(0);
    expect(summary.estimatedTokensSaved).toBe(0);
    expect(summary.removedDefaultPackTokens).toBeGreaterThan(0);
  });

  it("summarizes selected pack tokens with the existing avoided-context baseline", () => {
    const summary = summarizeContextPackReview({
      sourceFile: { path: "Notes/source.md" } as never,
      indexedVaultTokens: 2000,
      settings,
      suggestions,
      selectedPaths: new Set(["Notes/tfidf.md"])
    });

    expect(summary.selectedCount).toBe(1);
    expect(summary.contextPackTokens).toBeGreaterThan(0);
    expect(summary.estimatedTokensSaved).toBe(2000 - summary.contextPackTokens);
    expect(summary.removedDefaultPackTokens).toBeGreaterThan(0);
  });

  it("builds a selected context pack with only selected candidates", () => {
    const selectedSuggestions = filterSelectedSuggestions(
      suggestions,
      new Set(["Notes/noisy.md", "Notes/tfidf.md"])
    );
    const { markdown } = buildSelectedContextPack({
      sourceFile: { path: "Notes/source.md" } as never,
      indexedVaultTokens: 2000,
      settings,
      suggestions,
      selectedSuggestions
    });

    expect(markdown).toContain("Notes/tfidf.md");
    expect(markdown).toContain("Notes/noisy.md");
    expect(markdown).not.toContain("Notes/bm25.md");
    expect(markdown.indexOf("Notes/tfidf.md")).toBeLessThan(markdown.indexOf("Notes/noisy.md"));
  });

  it("keeps the direct-copy context pack capped by existing settings", () => {
    const { markdown } = buildContextPack({
      sourceFile: { path: "Notes/source.md" } as never,
      indexedVaultTokens: 2000,
      settings,
      suggestions
    });

    expect(markdown).toContain("Notes/tfidf.md");
    expect(markdown).toContain("Notes/bm25.md");
    expect(markdown).not.toContain("Notes/noisy.md");
  });

  it("keeps direct-copy packs focused when broad suggestions include operational noise", () => {
    const broadSuggestions: LinkSuggestion[] = [
      candidate("Synthetic/Project Context Guide.md", 0.272, true, [
        "vault",
        "obsidian",
        "enlaces",
        "context",
        "sin"
      ]),
      candidate("Synthetic/GitHub Portfolio Notes.md", 0.253, true, [
        "github",
        "context",
        "prism",
        "obsidian",
        "profesional"
      ]),
      candidate("Synthetic/Public Launch Notes.md", 0.231, false, [
        "obsidian",
        "github",
        "vault",
        "publicacion",
        "publicar"
      ]),
      candidate("Synthetic/Obsidian Starter Kit.md", 0.211, false, [
        "obsidian",
        "github",
        "local",
        "linkedin",
        "publicado"
      ]),
      candidate("Synthetic/Unrelated Simulation Memo.md", 0.198, false, [
        "ia",
        "proyecto",
        "sin",
        "tests",
        "demo"
      ]),
      candidate("Synthetic/Project Index.md", 0.184, true, [
        "context",
        "prism",
        "proyecto",
        "obsidian",
        "proyectos"
      ], 105),
      candidate("Synthetic/Temporary Work Log.md", 0.177, false, [
        "obsidian",
        "sin",
        "vault",
        "local",
        "actualizacion"
      ])
    ];

    const selected = selectDefaultContextCandidates(broadSuggestions, 8);
    const selectedPaths = selected.map((suggestion) => suggestion.targetPath);

    expect(selectedPaths).toEqual([
      "Synthetic/Project Context Guide.md",
      "Synthetic/GitHub Portfolio Notes.md",
      "Synthetic/Public Launch Notes.md",
      "Synthetic/Obsidian Starter Kit.md"
    ]);
  });

  it("allows short notes when they are already linked from the source note", () => {
    const selected = selectDefaultContextCandidates([
      {
        ...candidate("Synthetic/Project Decision Log.md", 0.32, true, ["decision", "project"], 45),
        reasons: [
          "Already linked from source note",
          "Shared terms: decision, project"
        ]
      },
      candidate("Synthetic/Short Index.md", 0.31, true, ["project", "index"], 45)
    ], 8);

    expect(selected.map((suggestion) => suggestion.targetPath)).toEqual([
      "Synthetic/Project Decision Log.md"
    ]);
  });

  it("generates a privacy-preserving feedback report without snippets or paths by default", () => {
    const report = buildFeedbackReport({
      sourceFile: { path: "Private/Project Atlas.md" } as never,
      suggestions,
      selectedPaths: new Set(["Notes/tfidf.md"]),
      settings,
      pluginVersion: "0.4.1"
    });

    expect(report).toContain("Plugin version: 0.4.1");
    expect(report).toContain("Candidate count: 3");
    expect(report).toContain("Decision in review modal: included");
    expect(report).toContain("Decision in review modal: excluded");
    expect(report).toContain("[path redacted]");
    expect(report).not.toContain("Private/Project Atlas.md");
    expect(report).not.toContain("Notes/tfidf.md");
    expect(report).not.toContain("TF-IDF helps rank related Markdown notes");
    expect(report).not.toContain("BM25 is useful for local retrieval");
  });

  it("includes paths in feedback reports only when explicitly requested", () => {
    const report = buildFeedbackReport({
      sourceFile: { path: "Private/Project Atlas.md" } as never,
      suggestions,
      selectedPaths: new Set(["Notes/tfidf.md"]),
      settings,
      includePaths: true
    });

    expect(report).toContain("Private/Project Atlas.md");
    expect(report).toContain("Notes/tfidf.md");
  });
});

function candidate(
  targetPath: string,
  score: number,
  exactMatch: boolean,
  sharedTerms: string[],
  estimatedTokens = 700
): LinkSuggestion {
  return {
    targetPath,
    title: targetPath.split("/").pop()?.replace(/\.md$/i, "") ?? targetPath,
    aliases: [],
    score,
    cosine: score / 2,
    bm25: score / 2,
    exactMatch,
    metadataScore: 0.3,
    sharedTerms,
    reasons: [
      ...(exactMatch ? ["Candidate content references source title"] : []),
      "Shared metadata",
      `Shared terms: ${sharedTerms.join(", ")}`
    ],
    snippet: `${targetPath} synthetic snippet for context pack testing.`,
    estimatedTokens
  };
}
