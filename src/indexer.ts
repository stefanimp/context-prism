import { App, CachedMetadata, normalizePath, TFile } from "obsidian";
import { buildTfIdfVector, cosineSimilarity, scoreCandidate, topSharedTerms } from "./search/scoring";
import { countTerms, makePreview, normalizePhrase, stripMarkdownForIndex, tokenize } from "./text/normalize";
import { estimateTokens } from "./token-estimator";
import { IndexedNote, IndexStats, LinkSuggestion, ContextPrismSettings } from "./types";

export class LinkIndexService {
  private docs = new Map<string, IndexedNote>();
  private idf = new Map<string, number>();
  private dirty = true;
  private stats: IndexStats = {
    notes: 0,
    terms: 0,
    builtAt: 0
  };

  constructor(
    private readonly app: App,
    private readonly getSettings: () => ContextPrismSettings
  ) {}

  markDirty(): void {
    this.dirty = true;
  }

  getStats(): IndexStats {
    return this.stats;
  }

  async ensureIndex(): Promise<IndexStats> {
    if (this.dirty || this.docs.size === 0) {
      return this.rebuild();
    }

    return this.stats;
  }

  async rebuild(): Promise<IndexStats> {
    const settings = this.getSettings();
    const files = this.app.vault
      .getMarkdownFiles()
      .filter((file) => this.shouldIndexFile(file, settings));

    const docs = new Map<string, IndexedNote>();
    const documentFrequency = new Map<string, number>();

    for (const file of files) {
      const markdown = await this.app.vault.cachedRead(file);
      const cache = this.app.metadataCache.getFileCache(file);
      const aliases = settings.includeAliases ? readAliases(cache) : [];
      const headings = (cache?.headings ?? []).map((heading) => heading.heading);
      const metadataTerms = readMetadataTerms(cache);
      const indexText = [
        file.basename,
        aliases.join(" "),
        aliases.join(" "),
        headings.join(" "),
        metadataTerms.join(" "),
        stripMarkdownForIndex(markdown, settings.includeFrontmatter)
      ].join("\n");
      const terms = countTerms(tokenize(indexText, settings.indexLanguages));
      const plainText = stripMarkdownForIndex(markdown, settings.includeFrontmatter);

      for (const term of terms.keys()) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }

      docs.set(file.path, {
        path: file.path,
        basename: file.basename,
        title: file.basename,
        aliases,
        headings,
        metadataTerms,
        terms,
        vector: new Map(),
        previewText: makePreview(markdown),
        estimatedTokens: estimateTokens(plainText),
        modified: file.stat.mtime
      });
    }

    const idf = new Map<string, number>();
    const totalDocs = docs.size;

    for (const [term, df] of documentFrequency) {
      idf.set(term, Math.log((1 + totalDocs) / (1 + df)) + 1);
    }

    for (const doc of docs.values()) {
      doc.vector = buildTfIdfVector(doc.terms, idf);
    }

    this.docs = docs;
    this.idf = idf;
    this.dirty = false;
    this.stats = {
      notes: docs.size,
      terms: idf.size,
      builtAt: Date.now()
    };

    return this.stats;
  }

  async suggestFor(file: TFile): Promise<LinkSuggestion[]> {
    await this.ensureIndex();

    const settings = this.getSettings();
    const sourceDoc = this.docs.get(file.path);
    if (!sourceDoc) {
      return [];
    }

    const markdown = await this.app.vault.cachedRead(file);
    const normalizedSource = normalizePhrase(stripMarkdownForIndex(markdown, settings.includeFrontmatter));
    const existingTargets = this.readExistingLinkTargets(file);
    const suggestions: LinkSuggestion[] = [];

    for (const candidate of this.docs.values()) {
      if (candidate.path === sourceDoc.path || existingTargets.has(candidate.path)) {
        continue;
      }

      const exactMatch = this.hasTitleOrAliasMention(normalizedSource, candidate);
      const metadataScore = metadataOverlap(sourceDoc.metadataTerms, candidate.metadataTerms);
      const cosine = cosineSimilarity(sourceDoc.vector, candidate.vector);
      const score = scoreCandidate(cosine, exactMatch, metadataScore);

      if (score < settings.minScore) {
        continue;
      }

      const sharedTerms = topSharedTerms(sourceDoc.terms, candidate.terms, this.idf, 5);
      suggestions.push({
        targetPath: candidate.path,
        title: candidate.title,
        aliases: candidate.aliases,
        score,
        cosine,
        exactMatch,
        metadataScore,
        sharedTerms,
        reasons: buildReasons(exactMatch, metadataScore, sharedTerms),
        snippet: buildSnippet(candidate.previewText, sharedTerms),
        estimatedTokens: candidate.estimatedTokens
      });
    }

    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, settings.maxSuggestions);
  }

  getEstimatedVaultTokens(): number {
    let total = 0;

    for (const doc of this.docs.values()) {
      total += doc.estimatedTokens;
    }

    return total;
  }

  private readExistingLinkTargets(file: TFile): Set<string> {
    const targets = new Set<string>();
    const cache = this.app.metadataCache.getFileCache(file);
    const links = [...(cache?.links ?? []), ...(cache?.embeds ?? [])];

    for (const link of links) {
      const destination = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
      if (destination) {
        targets.add(destination.path);
      }
    }

    return targets;
  }

  private hasTitleOrAliasMention(normalizedSource: string, candidate: IndexedNote): boolean {
    const phrases = [candidate.title, ...candidate.aliases]
      .map((phrase) => normalizePhrase(phrase))
      .filter(Boolean);

    return phrases.some((phrase) => ` ${normalizedSource} `.includes(` ${phrase} `));
  }

  private shouldIndexFile(file: TFile, settings: ContextPrismSettings): boolean {
    const path = normalizePath(file.path);
    const includeFolders = settings.includeFolders.map(normalizeFolder);
    const excludeFolders = settings.excludeFolders.map(normalizeFolder);
    const included =
      includeFolders.length === 0 ||
      includeFolders.some((folder) => path === folder || path.startsWith(`${folder}/`));
    const excluded = excludeFolders.some((folder) => path === folder || path.startsWith(`${folder}/`));

    return included && !excluded;
  }
}

function normalizeFolder(folder: string): string {
  return normalizePath(folder.trim()).replace(/\/$/, "");
}

function readAliases(cache: CachedMetadata | null): string[] {
  return collectStrings(cache?.frontmatter?.aliases);
}

function readMetadataTerms(cache: CachedMetadata | null): string[] {
  const frontmatter = cache?.frontmatter;
  if (!frontmatter) {
    return [];
  }

  return [
    ...collectStrings(frontmatter.area),
    ...collectStrings(frontmatter.topics),
    ...collectStrings(frontmatter.tags),
    ...collectStrings(frontmatter.type)
  ];
}

function collectStrings(value: unknown): string[] {
  if (!value) {
    return [];
  }

  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }

  return [];
}

function metadataOverlap(source: string[], candidate: string[]): number {
  const sourceTerms = new Set(source.map(normalizePhrase).filter(Boolean));
  const candidateTerms = new Set(candidate.map(normalizePhrase).filter(Boolean));
  let overlap = 0;

  for (const term of sourceTerms) {
    if (candidateTerms.has(term)) {
      overlap += 1;
    }
  }

  return Math.min(overlap / 3, 1);
}

function buildReasons(exactMatch: boolean, metadataScore: number, sharedTerms: string[]): string[] {
  const reasons: string[] = [];

  if (exactMatch) {
    reasons.push("Title or alias appears in the note");
  }

  if (metadataScore > 0) {
    reasons.push("Shared metadata");
  }

  if (sharedTerms.length > 0) {
    reasons.push(`Shared terms: ${sharedTerms.join(", ")}`);
  }

  return reasons;
}

function buildSnippet(previewText: string, sharedTerms: string[]): string {
  if (sharedTerms.length === 0) {
    return previewText.slice(0, 180);
  }

  const normalizedPreview = normalizePhrase(previewText);
  const term = sharedTerms.find((sharedTerm) => normalizedPreview.includes(sharedTerm));

  if (!term) {
    return previewText.slice(0, 180);
  }

  const index = normalizedPreview.indexOf(term);
  const start = Math.max(0, index - 80);
  const end = Math.min(previewText.length, index + 120);

  return previewText.slice(start, end).trim();
}
