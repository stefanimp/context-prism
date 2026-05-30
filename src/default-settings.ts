import type { ContextPrismSettings } from "./types";

export const DEFAULT_SETTINGS: ContextPrismSettings = {
  includeFolders: [],
  excludeFolders: ["Templates", "1-Templates"],
  indexLanguages: ["multilingual"],
  minScore: 0.08,
  maxSuggestions: 12,
  autoPrepareContext: true,
  contextSuggestionCount: 8,
  contextSnippetLength: 420,
  contextTokenBudget: 1800,
  footerHeading: "Related notes",
  includeAliases: true,
  includeFrontmatter: false,
  useMetadataRanking: true,
  metadataWeight: 0.08,
  showScores: true
};
