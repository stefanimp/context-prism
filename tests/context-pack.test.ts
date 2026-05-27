import { describe, expect, it } from "vitest";
import { buildContextPack } from "../src/context-pack";
import { estimateTokens } from "../src/token-estimator";
import { ContextPrismSettings } from "../src/types";

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
  showScores: true
};

describe("context packs", () => {
  it("builds a compact token-aware context pack", () => {
    const { markdown, stats } = buildContextPack({
      sourceFile: { path: "Notes/source.md" } as never,
      indexedVaultTokens: 2000,
      settings,
      suggestions: [
        {
          targetPath: "Notes/tfidf.md",
          title: "TF-IDF",
          aliases: [],
          score: 0.4,
          cosine: 0.3,
          exactMatch: false,
          metadataScore: 0.2,
          sharedTerms: ["ranking"],
          reasons: ["Shared terms: ranking"],
          snippet: "TF-IDF helps rank related Markdown notes using local lexical evidence.",
          estimatedTokens: 120
        }
      ]
    });

    expect(markdown).toContain("Context Prism Context Pack");
    expect(markdown).toContain("Estimated avoided context");
    expect(stats.contextPackTokens).toBe(estimateTokens(markdown));
    expect(stats.estimatedTokensSaved).toBeGreaterThan(0);
  });
});
