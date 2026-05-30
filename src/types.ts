export type IndexLanguage = "multilingual" | "en" | "es" | "fr" | "de" | "it" | "pt";

export interface ContextPrismSettings {
  includeFolders: string[];
  excludeFolders: string[];
  indexLanguages: IndexLanguage[];
  minScore: number;
  maxSuggestions: number;
  autoPrepareContext: boolean;
  contextSuggestionCount: number;
  contextSnippetLength: number;
  contextTokenBudget: number;
  footerHeading: string;
  includeAliases: boolean;
  includeFrontmatter: boolean;
  useMetadataRanking: boolean;
  metadataWeight: number;
  showScores: boolean;
}

export interface IndexedNote {
  path: string;
  basename: string;
  title: string;
  aliases: string[];
  headings: string[];
  metadataTerms: string[];
  terms: Map<string, number>;
  termCount: number;
  vector: Map<string, number>;
  previewText: string;
  estimatedTokens: number;
  modified: number;
}

export interface LinkSuggestion {
  targetPath: string;
  title: string;
  aliases: string[];
  score: number;
  cosine: number;
  bm25: number;
  exactMatch: boolean;
  metadataScore: number;
  sharedTerms: string[];
  reasons: string[];
  snippet: string;
  estimatedTokens: number;
}

export interface IndexStats {
  notes: number;
  terms: number;
  builtAt: number;
}

export interface ContextPackStats {
  indexedVaultTokens: number;
  contextPackTokens: number;
  estimatedTokensSaved: number;
}
