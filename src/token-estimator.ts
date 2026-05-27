export function estimateTokens(text: string): number {
  const normalizedLength = text.replace(/\s+/g, " ").trim().length;
  return Math.max(1, Math.ceil(normalizedLength / 4));
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }

  return String(tokens);
}
