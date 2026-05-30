import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/default-settings";
import { LinkIndexService } from "../src/indexer";

interface FakeFile {
  path: string;
  basename: string;
  extension: string;
  stat: { mtime: number };
}

function file(path: string): FakeFile {
  const name = path.split("/").pop() ?? path;
  return {
    path,
    basename: name.replace(/\.md$/i, ""),
    extension: "md",
    stat: { mtime: 1 }
  };
}

describe("index ranking", () => {
  it("prioritizes topical course notes over templates and weak multilingual aliases", async () => {
    const source = file("Notes/Graph Algorithms Exam Questions.md");
    const topicalNotes = file("Notes/Greedy Graph Algorithms.md");
    const weakAliasNote = file("Notes/Italian Verb Find.md");
    const template = file("Templates/Idea.md");
    const files = [source, topicalNotes, weakAliasNote, template];

    const markdown = new Map<string, string>([
      [
        source.path,
        [
          "# Graph Algorithms Exam Questions",
          "Should we implement heaps and disjoint sets?",
          "Merge and find operations for disjoint sets.",
          "Review greedy algorithms, shortest paths, complexity, and heap operations."
        ].join("\n")
      ],
      [
        topicalNotes.path,
        [
          "# Greedy Graph Algorithms",
          "Disjoint sets are used for graph problems.",
          "Know the complexity of each operation.",
          "Kruskal, Prim, heaps, greedy proofs, and shortest path algorithms."
        ].join("\n")
      ],
      [
        weakAliasNote.path,
        [
          "# Italian Verb Find",
          "Regular verb. Non riesco a trovare le chiavi.",
          "Common usage: find a solution, find an address."
        ].join("\n")
      ],
      [
        template.path,
        [
          "# {{title}}",
          "Pitch",
          "Problem",
          "Solution",
          "Next action"
        ].join("\n")
      ]
    ]);

    const caches = new Map<string, unknown>([
      [
        source.path,
        {
          frontmatter: {
            type: "note",
            area: ["Computer Science"],
            topics: ["Graph Algorithms", "Algorithms", "Exam"]
          },
          links: [],
          embeds: []
        }
      ],
      [
        topicalNotes.path,
        {
          frontmatter: {
            type: "note",
            area: ["Computer Science"],
            topics: ["Graph Algorithms", "Algorithms", "Greedy Algorithms"]
          },
          links: [],
          embeds: []
        }
      ],
      [
        weakAliasNote.path,
        {
          frontmatter: {
            type: "note",
            area: ["Languages"],
            topics: ["Italian", "Verbs"],
            aliases: ["Find", "Search"]
          },
          links: [],
          embeds: []
        }
      ],
      [
        template.path,
        {
          frontmatter: {
            type: "idea",
            area: ["Templates"],
            topics: []
          },
          links: [],
          embeds: []
        }
      ]
    ]);

    const app = fakeApp(files, markdown, caches);
    const service = new LinkIndexService(app as never, () => ({
      ...DEFAULT_SETTINGS,
      minScore: 0.08,
      maxSuggestions: 8
    }));

    const suggestions = await service.suggestFor(source as never);
    const paths = suggestions.map((suggestion) => suggestion.targetPath);

    expect(paths[0]).toBe(topicalNotes.path);
    expect(paths).not.toContain(weakAliasNote.path);
    expect(paths).not.toContain(template.path);
  });

  it("uses the source title to rank entity-centered index notes", async () => {
    const source = file("Notes/Project Atlas.md");
    const roadmap = file("Notes/Project Atlas Roadmap.md");
    const retrospective = file("Notes/Project Atlas Retrospective.md");
    const genericWorkMoc = file("Notes/Work.md");
    const genericWebMoc = file("Notes/Web Development.md");
    const files = [source, roadmap, retrospective, genericWorkMoc, genericWebMoc];

    const markdown = new Map<string, string>([
      [
        source.path,
        [
          "# Project Atlas",
          "## Related notes",
          "```dataview",
          "TABLE WITHOUT ID file.link AS Note",
          "```",
          "## Related tasks",
          "```dataview",
          "TASK",
          "```"
        ].join("\n")
      ],
      [
        roadmap.path,
        [
          "# Project Atlas Roadmap",
          "Milestones, delivery risks, and implementation priorities.",
          "The next release should improve retrieval quality."
        ].join("\n")
      ],
      [
        retrospective.path,
        [
          "# Project Atlas Retrospective",
          "Review what worked, what failed, and which ranking changes helped Project Atlas.",
          "Capture follow-up work for the next iteration."
        ].join("\n")
      ],
      [genericWorkMoc.path, "# Work\n## Related notes\n## Related tasks"],
      [genericWebMoc.path, "# Web Development\n## Notes\n## Related tasks"]
    ]);

    const caches = new Map<string, unknown>([
      [
        source.path,
        {
          frontmatter: {
            type: "moc",
            area: ["Work"],
            topics: ["Project Atlas", "Projects"]
          },
          links: [],
          embeds: []
        }
      ],
      [
        roadmap.path,
        {
          frontmatter: {
            type: "note",
            area: ["Work"],
            topics: ["Project Atlas", "Roadmap"]
          },
          links: [],
          embeds: []
        }
      ],
      [
        retrospective.path,
        {
          frontmatter: {
            type: "note",
            area: ["Work"],
            topics: ["Project Atlas", "Retrospective"]
          },
          links: [],
          embeds: []
        }
      ],
      [
        genericWorkMoc.path,
        {
          frontmatter: {
            type: "moc",
            area: ["Work"],
            topics: ["Work"]
          },
          links: [],
          embeds: []
        }
      ],
      [
        genericWebMoc.path,
        {
          frontmatter: {
            type: "moc",
            area: ["Learning"],
            topics: ["Web Development"]
          },
          links: [],
          embeds: []
        }
      ]
    ]);

    const app = fakeApp(files, markdown, caches);
    const service = new LinkIndexService(app as never, () => ({
      ...DEFAULT_SETTINGS,
      minScore: 0.08,
      maxSuggestions: 8
    }));

    const suggestions = await service.suggestFor(source as never);
    const paths = suggestions.map((suggestion) => suggestion.targetPath);

    expect(paths.slice(0, 2)).toEqual(expect.arrayContaining([roadmap.path, retrospective.path]));
    expect(paths).not.toContain(genericWorkMoc.path);
    expect(paths).not.toContain(genericWebMoc.path);
    expect(suggestions.slice(0, 2).every((suggestion) =>
      suggestion.reasons.includes("Source title appears in candidate title")
    )).toBe(true);
  });

  it("can disable metadata influence across ranking signals", async () => {
    const source = file("Notes/Launch Notes.md");
    const metadataOnlyMatch = file("Notes/Unrelated Archive.md");
    const files = [source, metadataOnlyMatch];

    const markdown = new Map<string, string>([
      [source.path, "# Launch Notes\nAlpha rollout planning and release coordination."],
      [metadataOnlyMatch.path, "# Unrelated Archive\nRiver geology sketches and field observations."]
    ]);

    const caches = new Map<string, unknown>([
      [
        source.path,
        {
          frontmatter: {
            area: ["Product"],
            topics: ["Launch"],
            tags: ["release"]
          },
          links: [],
          embeds: []
        }
      ],
      [
        metadataOnlyMatch.path,
        {
          frontmatter: {
            area: ["Product"],
            topics: ["Launch"],
            tags: ["release"]
          },
          links: [],
          embeds: []
        }
      ]
    ]);

    const app = fakeApp(files, markdown, caches);

    const withMetadata = new LinkIndexService(app as never, () => ({
      ...DEFAULT_SETTINGS,
      minScore: 0.05,
      maxSuggestions: 8,
      useMetadataRanking: true,
      metadataWeight: 0.2
    }));

    const withoutMetadata = new LinkIndexService(app as never, () => ({
      ...DEFAULT_SETTINGS,
      minScore: 0.05,
      maxSuggestions: 8,
      useMetadataRanking: false,
      metadataWeight: 0.2
    }));

    expect((await withMetadata.suggestFor(source as never)).map((suggestion) => suggestion.targetPath))
      .toContain(metadataOnlyMatch.path);
    expect((await withoutMetadata.suggestFor(source as never)).map((suggestion) => suggestion.targetPath))
      .not.toContain(metadataOnlyMatch.path);
  });
});

function fakeApp(
  files: FakeFile[],
  markdown: Map<string, string>,
  caches: Map<string, unknown>
): unknown {
  return {
    vault: {
      getMarkdownFiles: () => files,
      cachedRead: async (target: FakeFile) => markdown.get(target.path) ?? ""
    },
    metadataCache: {
      getFileCache: (target: FakeFile) => caches.get(target.path) ?? {},
      getFirstLinkpathDest: () => null
    }
  };
}
