import { describe, expect, it } from "vitest";
import { buildTfIdfVector, cosineSimilarity, scoreCandidate, topSharedTerms } from "../src/search/scoring";

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

  it("boosts exact title mentions without letting them bypass all scoring", () => {
    expect(scoreCandidate(0.1, true, 0)).toBeGreaterThan(scoreCandidate(0.1, false, 0));
    expect(scoreCandidate(0.1, true, 1)).toBeLessThanOrEqual(1);
  });
});
