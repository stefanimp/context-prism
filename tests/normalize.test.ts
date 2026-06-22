import { describe, expect, it } from "vitest";
import { normalizePhrase, stripMarkdownForIndex, tokenize } from "../src/text/normalize";

describe("text normalization", () => {
  it("normalizes accents and removes language-specific stopwords", () => {
    expect(tokenize("Recuperaci\u00f3n de Informaci\u00f3n y enlaces locales", ["es"])).toEqual([
      "recuperacion",
      "informacion",
      "enlaces",
      "locales"
    ]);
  });

  it("supports multiple language profiles in the same vault", () => {
    expect(tokenize("The local graph and el grafo local", ["en", "es"])).toEqual([
      "local",
      "graph",
      "grafo",
      "local"
    ]);
  });

  it("removes low-signal multilingual terms from context matching", () => {
    expect(tokenize("Non si no note notes algoritmo", ["multilingual"])).toEqual(["algoritmo"]);
  });

  it("removes structural note headings that otherwise dominate short index notes", () => {
    expect(tokenize("Related notes Related tasks Idea central Desarrollo Conexiones Project Atlas", ["multilingual"])).toEqual([
      "project",
      "atlas"
    ]);
  });

  it("keeps useful wiki-link text for indexing", () => {
    const text = stripMarkdownForIndex("A note about [[Sistemas de Recuperaci\u00f3n|SRI]] and `code`.", false);
    expect(normalizePhrase(text)).toContain("sistemas de recuperacion sri");
    expect(text).not.toContain("code");
  });

  it("strips frontmatter when a file starts with a UTF-8 byte order mark", () => {
    const text = stripMarkdownForIndex("\uFEFF---\ntype: note\ntopics: [Synthetic Test Data]\n---\n# Useful Body", false);

    expect(text).toContain("Useful Body");
    expect(text).not.toContain("Synthetic Test Data");
    expect(text).not.toContain("type");
  });
});
