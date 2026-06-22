import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildContextPack, createDefaultSelectedPaths } from "../src/context-pack";
import { DEFAULT_SETTINGS } from "../src/default-settings";
import { LinkIndexService } from "../src/indexer";

interface FakeFile {
  path: string;
  basename: string;
  extension: string;
  stat: { mtime: number };
}

const vaultPath = process.env.CONTEXT_PRISM_TEST_VAULT;
const sourcePath = process.env.CONTEXT_PRISM_TEST_SOURCE;
const expectedIncludes = parseExpectation(process.env.CONTEXT_PRISM_EXPECT_INCLUDE);
const expectedExcludes = parseExpectation(process.env.CONTEXT_PRISM_EXPECT_EXCLUDE);
const runIfVaultAvailable = vaultPath && existsSync(vaultPath) ? describe : describe.skip;
const projectAtlasSourcePath = "Synthetic Vault/00 Maps/Project Atlas.md";
const hasProjectAtlasFixture = vaultPath
  ? existsSync(path.join(vaultPath, ...projectAtlasSourcePath.split("/")))
  : false;

runIfVaultAvailable("external vault evaluation", () => {
  it.runIf(hasProjectAtlasFixture)("keeps the Project Atlas context pack focused on Project Atlas notes", async () => {
    const fixture = loadVault(vaultPath as string);
    const source = fixture.files.find((file) => file.path === projectAtlasSourcePath);
    if (!source) {
      throw new Error(`Missing external vault fixture source: ${projectAtlasSourcePath}`);
    }

    const service = new LinkIndexService(fixture.app as never, () => ({
      ...DEFAULT_SETTINGS,
      includeFolders: ["Synthetic Vault"],
      excludeFolders: ["Synthetic Vault/99 Archive"],
      maxSuggestions: 12,
      contextSuggestionCount: 8,
      contextSnippetLength: 420,
      contextTokenBudget: 1800
    }));

    const suggestions = await service.suggestFor(source as never, { excludeExistingLinks: false });
    const defaultSelectedPaths = createDefaultSelectedPaths({
      sourceFile: source as never,
      suggestions,
      indexedVaultTokens: service.getEstimatedVaultTokens(),
      settings: {
        ...DEFAULT_SETTINGS,
        includeFolders: ["Synthetic Vault"],
        excludeFolders: ["Synthetic Vault/99 Archive"],
        maxSuggestions: 12,
        contextSuggestionCount: 8,
        contextSnippetLength: 420,
        contextTokenBudget: 1800
      }
    });
    const { markdown } = buildContextPack({
      sourceFile: source as never,
      suggestions,
      indexedVaultTokens: service.getEstimatedVaultTokens(),
      settings: {
        ...DEFAULT_SETTINGS,
        includeFolders: ["Synthetic Vault"],
        excludeFolders: ["Synthetic Vault/99 Archive"],
        maxSuggestions: 12,
        contextSuggestionCount: 8,
        contextSnippetLength: 420,
        contextTokenBudget: 1800
      }
    });

    expect(suggestions.slice(0, 6).every((suggestion) => suggestion.targetPath.includes("Project Atlas")))
      .toBe(true);
    expect([...defaultSelectedPaths].length).toBeGreaterThanOrEqual(4);
    expect([...defaultSelectedPaths].every((targetPath) => targetPath.includes("Project Atlas"))).toBe(true);
    expect(markdown).toContain("Project Atlas");
    expect(markdown).not.toContain("Synthetic Meeting");
  });

  it.runIf(sourcePath)("evaluates a configured source note without hardcoded vault paths", async () => {
    const fixture = loadVault(vaultPath as string);
    const source = fixture.files.find((file) => file.path === sourcePath);
    if (!source) {
      throw new Error(`Missing configured external vault source: ${sourcePath}`);
    }

    const settings = {
      ...DEFAULT_SETTINGS,
      maxSuggestions: 12,
      contextSuggestionCount: 8,
      contextSnippetLength: 420,
      contextTokenBudget: 1800
    };
    const service = new LinkIndexService(fixture.app as never, () => settings);
    const suggestions = await service.suggestFor(source as never, { excludeExistingLinks: false });
    const defaultSelectedPaths = createDefaultSelectedPaths({
      sourceFile: source as never,
      suggestions,
      indexedVaultTokens: service.getEstimatedVaultTokens(),
      settings
    });
    const selectedPaths = [...defaultSelectedPaths];

    if (process.env.CONTEXT_PRISM_PRINT_EVAL === "1") {
      console.info(JSON.stringify({
        source: source.path,
        selectedPaths,
        topSuggestions: suggestions.slice(0, 8).map((suggestion) => ({
          targetPath: suggestion.targetPath,
          score: Number(suggestion.score.toFixed(3)),
          reasons: suggestion.reasons,
          sharedTerms: suggestion.sharedTerms
        }))
      }, null, 2));
    }

    for (const expected of expectedIncludes) {
      expect(selectedPaths.some((targetPath) => targetPath.includes(expected))).toBe(true);
    }

    for (const expected of expectedExcludes) {
      expect(selectedPaths.some((targetPath) => targetPath.includes(expected))).toBe(false);
    }
  });
});

function parseExpectation(value: string | undefined): string[] {
  return (value ?? "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function loadVault(root: string): {
  app: unknown;
  files: FakeFile[];
} {
  const files = listMarkdownFiles(root);
  const markdown = new Map<string, string>();
  const caches = new Map<string, unknown>();
  const byBasename = new Map<string, FakeFile>();

  for (const file of files) {
    const absolutePath = path.join(root, ...file.path.split("/"));
    const content = readFileSync(absolutePath, "utf8");
    markdown.set(file.path, content);
    caches.set(file.path, parseCache(content));
    byBasename.set(file.basename.toLowerCase(), file);
  }

  return {
    files,
    app: {
      vault: {
        getMarkdownFiles: () => files,
        cachedRead: async (target: FakeFile) => markdown.get(target.path) ?? ""
      },
      metadataCache: {
        getFileCache: (target: FakeFile) => caches.get(target.path) ?? {},
        getFirstLinkpathDest: (link: string) => {
          const normalized = link.replace(/\\/g, "/").replace(/\.md$/i, "");
          const basename = normalized.split("/").pop()?.toLowerCase() ?? normalized.toLowerCase();
          return byBasename.get(basename) ?? null;
        }
      }
    }
  };
}

function listMarkdownFiles(root: string, current = root): FakeFile[] {
  const files: FakeFile[] = [];

  for (const entry of readdirSync(current)) {
    if (entry === ".obsidian") {
      continue;
    }

    const absolutePath = path.join(current, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      files.push(...listMarkdownFiles(root, absolutePath));
      continue;
    }

    if (!entry.toLowerCase().endsWith(".md")) {
      continue;
    }

    const relativePath = path.relative(root, absolutePath).replace(/\\/g, "/");
    files.push({
      path: relativePath,
      basename: entry.replace(/\.md$/i, ""),
      extension: "md",
      stat: { mtime: stats.mtimeMs }
    });
  }

  return files;
}

function parseCache(markdown: string): unknown {
  return {
    frontmatter: parseFrontmatter(markdown),
    headings: [...markdown.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => ({ heading: match[1] })),
    links: [...markdown.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)].map((match) => ({
      link: match[1]
    })),
    embeds: []
  };
}

function parseFrontmatter(markdown: string): Record<string, unknown> {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    return {};
  }

  const frontmatter: Record<string, unknown> = {};
  let currentKey: string | null = null;

  for (const line of match[1].split(/\r?\n/)) {
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && currentKey) {
      const currentValue = frontmatter[currentKey];
      const values = Array.isArray(currentValue) ? currentValue : [];
      values.push(cleanYamlValue(listItem[1]));
      frontmatter[currentKey] = values;
      continue;
    }

    const keyValue = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!keyValue) {
      continue;
    }

    currentKey = keyValue[1];
    const value = keyValue[2].trim();
    if (!value) {
      frontmatter[currentKey] = [];
      continue;
    }

    frontmatter[currentKey] = value.startsWith("[") && value.endsWith("]")
      ? value.slice(1, -1).split(",").map(cleanYamlValue).filter(Boolean)
      : cleanYamlValue(value);
  }

  return frontmatter;
}

function cleanYamlValue(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}
