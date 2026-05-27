export function buildTfIdfVector(
  terms: Map<string, number>,
  idf: Map<string, number>
): Map<string, number> {
  const vector = new Map<string, number>();

  for (const [term, count] of terms) {
    const weight = (1 + Math.log(count)) * (idf.get(term) ?? 0);
    if (weight > 0) {
      vector.set(term, weight);
    }
  }

  return vector;
}

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const value of a.values()) {
    normA += value * value;
  }

  for (const value of b.values()) {
    normB += value * value;
  }

  const [small, large] = a.size < b.size ? [a, b] : [b, a];

  for (const [term, value] of small) {
    dot += value * (large.get(term) ?? 0);
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function scoreCandidate(
  cosine: number,
  exactMatch: boolean,
  metadataScore: number
): number {
  const exactBoost = exactMatch ? 0.18 : 0;
  const metadataBoost = Math.min(metadataScore, 1) * 0.04;
  const lexicalScore = Math.min(cosine, 1) * 0.78;

  return Math.min(1, lexicalScore + exactBoost + metadataBoost);
}

export function topSharedTerms(
  sourceTerms: Map<string, number>,
  candidateTerms: Map<string, number>,
  idf: Map<string, number>,
  limit: number
): string[] {
  const shared: Array<{ term: string; weight: number }> = [];

  for (const [term, count] of sourceTerms) {
    const candidateCount = candidateTerms.get(term);
    if (candidateCount) {
      shared.push({
        term,
        weight: count * candidateCount * (idf.get(term) ?? 1)
      });
    }
  }

  return shared
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((entry) => entry.term);
}
