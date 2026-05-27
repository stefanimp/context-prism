import { TFile } from "obsidian";
import { estimateTokens } from "./token-estimator";
import { ContextPackStats, LinkSuggestion, ContextPrismSettings } from "./types";

interface ContextPackInput {
  sourceFile: TFile;
  suggestions: LinkSuggestion[];
  indexedVaultTokens: number;
  settings: ContextPrismSettings;
}

export function buildContextPack(input: ContextPackInput): { markdown: string; stats: ContextPackStats } {
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

  for (const [index, suggestion] of selected.entries()) {
    const nextBlock = formatSuggestionBlock(index + 1, suggestion, input.settings.contextSnippetLength);
    const candidateMarkdown = [...lines, ...nextBlock].join("\n");

    if (estimateTokens(candidateMarkdown) > input.settings.contextTokenBudget && index > 0) {
      break;
    }

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
