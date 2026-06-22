import { describe, expect, it } from "vitest";
import {
  buildContextPack,
  buildFeedbackReport,
  buildSelectedContextPack,
  createDefaultSelectedPaths,
  filterSelectedSuggestions,
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
