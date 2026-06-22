import { TFile } from "obsidian";
import { estimateTokens } from "./token-estimator";
import { ContextPackStats, LinkSuggestion, ContextPrismSettings } from "./types";

interface ContextPackInput {
  sourceFile: TFile;
  suggestions: LinkSuggestion[];
  indexedVaultTokens: number;
  settings: ContextPrismSettings;
}

interface SelectedContextPackInput extends ContextPackInput {
  selectedSuggestions: LinkSuggestion[];
}

interface CandidateTokenInfo {
  estimatedFullNoteTokens: number;
  estimatedPackBlockTokens: number;
}

export interface ContextPackReviewSummary {
  selectedCount: number;
  totalCount: number;
  contextPackTokens: number;
  estimatedTokensSaved: number;
  removedDefaultPackTokens: number;
}

export interface FeedbackReportInput {
  sourceFile: TFile;
  suggestions: LinkSuggestion[];
  selectedPaths: Set<string>;
  settings: ContextPrismSettings;
  pluginVersion?: string;
  includePaths?: boolean;
}

export function buildContextPack(input: ContextPackInput): { markdown: string; stats: ContextPackStats } {
  const { suggestions } = planDefaultContextPack(input);

  return buildSelectedContextPack({
    ...input,
    selectedSuggestions: suggestions
  });
}

export function buildSelectedContextPack(
  input: SelectedContextPackInput
): { markdown: string; stats: ContextPackStats } {
  const header = [
    "# Context Prism Context Pack",
    "",
    `Source note: ${input.sourceFile.path}`,
    `Language profile: ${input.settings.indexLanguages.join(", ")}`,
    "Purpose: use these local candidates first before requesting more vault context.",
    ""
  ];
  const lines = [...header];

  for (const [index, suggestion] of input.selectedSuggestions.entries()) {
    const nextBlock = formatSuggestionBlock(index + 1, suggestion, input.settings.contextSnippetLength);
    lines.push(...nextBlock);
  }

  const bodyMarkdown = lines.join("\n").trimEnd();
  const { markdown, contextPackTokens, estimatedTokensSaved } = appendStableTokenBudget(
    bodyMarkdown,
    input.indexedVaultTokens
  );

  return {
    markdown,
    stats: {
      indexedVaultTokens: input.indexedVaultTokens,
      contextPackTokens,
      estimatedTokensSaved
    }
  };
}

export function planDefaultContextPack(input: ContextPackInput): {
  suggestions: LinkSuggestion[];
  stats: ContextPackStats;
} {
  const selected = input.suggestions.slice(0, input.settings.contextSuggestionCount);
  const header = [
    "# Context Prism Context Pack",
    "",
    `Source note: ${input.sourceFile.path}`,
    `Language profile: ${input.settings.indexLanguages.join(", ")}`,
    "Purpose: use these local candidates first before requesting more vault context.",
    ""
  ];
  const lines = [...header];
  const included: LinkSuggestion[] = [];

  for (const [index, suggestion] of selected.entries()) {
    const nextBlock = formatSuggestionBlock(index + 1, suggestion, input.settings.contextSnippetLength);
    const candidateMarkdown = [...lines, ...nextBlock].join("\n");

    if (estimateTokens(candidateMarkdown) > input.settings.contextTokenBudget && index > 0) {
      break;
    }

    lines.push(...nextBlock);
    included.push(suggestion);
  }

  const { contextPackTokens, estimatedTokensSaved } = appendStableTokenBudget(
    lines.join("\n").trimEnd(),
    input.indexedVaultTokens
  );

  return {
    suggestions: included,
    stats: {
      indexedVaultTokens: input.indexedVaultTokens,
      contextPackTokens,
      estimatedTokensSaved
    }
  };
}

export function createDefaultSelectedPaths(input: ContextPackInput): Set<string> {
  return new Set(planDefaultContextPack(input).suggestions.map((suggestion) => suggestion.targetPath));
}

export function filterSelectedSuggestions(
  suggestions: LinkSuggestion[],
  selectedPaths: Set<string>
): LinkSuggestion[] {
  return suggestions.filter((suggestion) => selectedPaths.has(suggestion.targetPath));
}

export function getCandidateTokenInfo(
  suggestion: LinkSuggestion,
  snippetLength: number
): CandidateTokenInfo {
  return {
    estimatedFullNoteTokens: suggestion.estimatedTokens,
    estimatedPackBlockTokens: estimateTokens(formatSuggestionBlock(1, suggestion, snippetLength).join("\n"))
  };
}

export function summarizeContextPackReview(input: ContextPackInput & { selectedPaths: Set<string> }): ContextPackReviewSummary {
  const selectedSuggestions = filterSelectedSuggestions(input.suggestions, input.selectedPaths);
  if (selectedSuggestions.length === 0) {
    return {
      selectedCount: 0,
      totalCount: input.suggestions.length,
      contextPackTokens: 0,
      estimatedTokensSaved: 0,
      removedDefaultPackTokens: planDefaultContextPack(input).suggestions.reduce(
        (total, suggestion) =>
          total + getCandidateTokenInfo(suggestion, input.settings.contextSnippetLength).estimatedPackBlockTokens,
        0
      )
    };
  }

  const { stats } = buildSelectedContextPack({
    ...input,
    selectedSuggestions
  });
  const defaultPlan = planDefaultContextPack(input);
  const selectedPackBlockTokens = new Map(
    selectedSuggestions.map((suggestion) => [
      suggestion.targetPath,
      getCandidateTokenInfo(suggestion, input.settings.contextSnippetLength).estimatedPackBlockTokens
    ])
  );
  const removedDefaultPackTokens = defaultPlan.suggestions.reduce((total, suggestion) => {
    if (input.selectedPaths.has(suggestion.targetPath)) {
      return total;
    }

    return total + (selectedPackBlockTokens.get(suggestion.targetPath) ??
      getCandidateTokenInfo(suggestion, input.settings.contextSnippetLength).estimatedPackBlockTokens);
  }, 0);

  return {
    selectedCount: selectedSuggestions.length,
    totalCount: input.suggestions.length,
    contextPackTokens: stats.contextPackTokens,
    estimatedTokensSaved: stats.estimatedTokensSaved,
    removedDefaultPackTokens
  };
}

export function buildFeedbackReport(input: FeedbackReportInput): string {
  const includePaths = input.includePaths === true;
  const selectedPaths = input.selectedPaths;
  const candidateLines = input.suggestions.map((suggestion, index) => {
    const tokenInfo = getCandidateTokenInfo(suggestion, input.settings.contextSnippetLength);
    const decision = selectedPaths.has(suggestion.targetPath) ? "included" : "excluded";
    const candidateLabel = includePaths ? suggestion.targetPath : "[path redacted]";

    return [
      `### ${index + 1}. ${candidateLabel}`,
      "",
      `- Decision in review modal: ${decision}`,
      `- Estimated full-note tokens: ${tokenInfo.estimatedFullNoteTokens}`,
      `- Estimated context-pack block tokens: ${tokenInfo.estimatedPackBlockTokens}`,
      `- Ranking reasons: ${suggestion.reasons.join("; ") || "lexical similarity"}`,
      ""
    ].join("\n");
  });

  return [
    "# Context Prism retrieval feedback",
    "",
    "Please replace any private names, paths, or note excerpts with synthetic or redacted examples before posting publicly.",
    "",
    "## Environment",
    "",
    `- Plugin version: ${input.pluginVersion ?? "unknown"}`,
    `- Language profile: ${input.settings.indexLanguages.join(", ")}`,
    "- Vault size: [approximate number of notes, optional]",
    "- AI assistant used: [ChatGPT / Claude / Codex / Cursor / other]",
    "",
    "## Workflow",
    "",
    "- What were you trying to do with the context pack?",
    "- What note or task anchored the request?",
    "",
    "## Active note",
    "",
    includePaths
      ? `- Source note path: ${input.sourceFile.path}`
      : "- Source note path: [redacted by default; add a synthetic or redacted path if useful]",
    "",
    "## Candidate decisions",
    "",
    `Candidate count: ${input.suggestions.length}`,
    "",
    ...candidateLines,
    "## Ranking issues",
    "",
    "- Missing notes: [which notes should have appeared, and why?]",
    "- Irrelevant candidates: [which ranks were not useful?]",
    "- Poor snippets: [which snippets were misleading, too short, or too broad?]",
    "- Unclear token estimates: [what was confusing?]",
    "",
    "## Minimal synthetic or redacted example",
    "",
    "[Optional: add short synthetic note titles or redacted excerpts. Do not paste private note bodies.]"
  ].join("\n");
}

function appendStableTokenBudget(
  bodyMarkdown: string,
  indexedVaultTokens: number
): { markdown: string; contextPackTokens: number; estimatedTokensSaved: number } {
  let contextPackTokens = estimateTokens(bodyMarkdown);
  let estimatedTokensSaved = Math.max(0, indexedVaultTokens - contextPackTokens);
  let markdown = bodyMarkdown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    markdown = appendTokenBudget(bodyMarkdown, indexedVaultTokens, contextPackTokens, estimatedTokensSaved);
    const nextTokenEstimate = estimateTokens(markdown);
    const nextTokensSaved = Math.max(0, indexedVaultTokens - nextTokenEstimate);

    if (nextTokenEstimate === contextPackTokens && nextTokensSaved === estimatedTokensSaved) {
      break;
    }

    contextPackTokens = nextTokenEstimate;
    estimatedTokensSaved = nextTokensSaved;
  }

  return {
    markdown,
    contextPackTokens,
    estimatedTokensSaved
  };
}

function appendTokenBudget(
  bodyMarkdown: string,
  indexedVaultTokens: number,
  contextPackTokens: number,
  estimatedTokensSaved: number
): string {
  return [
    bodyMarkdown,
    "",
    "## Token budget",
    "",
    `- Indexed vault estimate: ${indexedVaultTokens} tokens`,
    `- Context pack estimate: ${contextPackTokens} tokens`,
    `- Estimated avoided context: ${estimatedTokensSaved} tokens`
  ].join("\n");
}

function formatSuggestionBlock(
  index: number,
  suggestion: LinkSuggestion,
  snippetLength: number
): string[] {
  const snippet = suggestion.snippet.slice(0, snippetLength).trim();

  return [
    `## ${index}. ${suggestion.title}`,
    "",
    `- Path: ${suggestion.targetPath}`,
    `- Score: ${suggestion.score.toFixed(3)}`,
    `- Estimated full-note tokens: ${suggestion.estimatedTokens}`,
    `- Why: ${suggestion.reasons.join("; ") || "lexical similarity"}`,
    "",
    "```text",
    snippet || "No snippet available.",
    "```",
    ""
  ];
}
