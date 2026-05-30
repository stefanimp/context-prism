import { describe, expect, it } from "vitest";
import { bm25Similarity, buildTfIdfVector, cosineSimilarity, scoreCandidate, topSharedTerms } from "../src/search/scoring";

describe("ranking primitives", () => {
  it("computes higher similarity for overlapping vectors", () => {
    const idf = new Map([
      ["link", 2],
      ["vault", 2],
      ["garden", 2]
    ]);
    const a = buildTfIdfVector(
      new Map([
        ["link", 2],
        ["vault", 1]
      ]),
      idf
    );
    const b = buildTfIdfVector(
      new Map([
        ["link", 1],
        ["garden", 2]
      ]),
      idf
    );

    expect(cosineSimilarity(a, b)).toBeGreaterThan(0);
    expect(topSharedTerms(new Map([["link", 2]]), new Map([["link", 1]]), idf, 1)).toEqual(["link"]);
  });

  it("computes BM25 similarity from query terms and candidate term frequency", () => {
    const idf = new Map([
      ["retrieval", 2],
      ["ranking", 1.5]
    ]);
    const query = new Map([
      ["retrieval", 1],
      ["ranking", 1]
    ]);
    const relevant = new Map([
      ["retrieval", 3],
      ["ranking", 1]
    ]);
    const unrelated = new Map([["archive", 4]]);

    expect(bm25Similarity(query, relevant, idf, 8, 10)).toBeGreaterThan(0);
    expect(bm25Similarity(query, unrelated, idf, 8, 10)).toBe(0);
  });

  it("boosts mention signals without letting them bypass all scoring", () => {
    expect(scoreCandidate(0.1, 0.1, 0.12, 0, 0.08)).toBeGreaterThan(
      scoreCandidate(0.1, 0.1, 0, 0, 0.08)
    );
    expect(scoreCandidate(0.1, 0.1, 0.12, 1, 0.08)).toBeLessThanOrEqual(1);
  });

  it("keeps weak alias-only matches below stronger metadata matches", () => {
    const weakAliasOnly = scoreCandidate(0.02, 0.01, 0.04, 0, 0.08);
    const topicalMatch = scoreCandidate(0.12, 0.12, 0, 0.8, 0.08);

    expect(weakAliasOnly).toBeLessThan(0.08);
    expect(topicalMatch).toBeGreaterThan(weakAliasOnly);
  });

  it("lets metadata weight tune metadata influence", () => {
    const withoutMetadata = scoreCandidate(0.1, 0.1, 0, 1, 0);
    const withMetadata = scoreCandidate(0.1, 0.1, 0, 1, 0.12);

    expect(withMetadata).toBeGreaterThan(withoutMetadata);
  });
});
