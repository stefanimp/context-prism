import type { App, CachedMetadata, TFile } from "obsidian";
import { bm25Similarity, buildTfIdfVector, cosineSimilarity, scoreCandidate, topSharedTerms } from "./search/scoring";
import { makePreview, normalizePhrase, stripMarkdownForIndex, tokenize } from "./text/normalize";
import { estimateTokens } from "./token-estimator";
import { IndexedNote, IndexStats, LinkSuggestion, ContextPrismSettings } from "./types";

const TITLE_MENTION_BOOST = 0.12;
const ALIAS_MENTION_BOOST = 0.04;
const EXISTING_LINK_BOOST = 0.18;
const SOURCE_TITLE_IN_TITLE_BOOST = 0.14;
const SOURCE_TITLE_IN_METADATA_BOOST = 0.13;
const SOURCE_TITLE_IN_TERMS_BOOST = 0.1;
const MIN_SINGLE_TOKEN_ALIAS_LENGTH = 6;
const SHORT_NOTE_TOKEN_THRESHOLD = 30;
const STRONG_METADATA_SCORE = 0.67;
const TITLE_FIELD_WEIGHT = 3;
const HEADING_FIELD_WEIGHT = 1.6;
const ALIAS_FIELD_WEIGHT = 1.2;
const BODY_FIELD_WEIGHT = 1;
const METADATA_FIELD_WEIGHT = 1;

type MentionReason =
  | "title"
  | "alias"
  | "existing-link"
  | "source-title-title"
  | "source-title-metadata"
  | "source-title-content"
  | null;

interface SuggestionOptions {
  excludeExistingLinks?: boolean;
}

export class LinkIndexService {
  private docs = new Map<string, IndexedNote>();
  private idf = new Map<string, number>();
  private averageDocumentLength = 0;
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
    let totalTermCount = 0;

    for (const file of files) {
      const markdown = await this.app.vault.cachedRead(file);
      const cache = this.app.metadataCache.getFileCache(file);
      const aliases = settings.includeAliases ? readAliases(cache) : [];
      const headings = (cache?.headings ?? []).map((heading) => heading.heading);
      const metadataTerms = settings.useMetadataRanking ? readMetadataTerms(cache) : [];
      const plainText = stripMarkdownForIndex(markdown, settings.includeFrontmatter);
      const terms = buildWeightedTermCounts(
        [
          { text: file.basename, weight: TITLE_FIELD_WEIGHT },
          { text: aliases.join(" "), weight: ALIAS_FIELD_WEIGHT },
          { text: headings.join(" "), weight: HEADING_FIELD_WEIGHT },
          { text: metadataTerms.join(" "), weight: METADATA_FIELD_WEIGHT },
          { text: plainText, weight: BODY_FIELD_WEIGHT }
        ],
        settings.indexLanguages
      );
      const termCount = countAllTerms(terms);
      totalTermCount += termCount;

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
        termCount,
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
    this.averageDocumentLength = docs.size === 0 ? 0 : totalTermCount / docs.size;
    this.dirty = false;
    this.stats = {
      notes: docs.size,
      terms: idf.size,
      builtAt: Date.now()
    };

    return this.stats;
  }

  async suggestFor(file: TFile, options: SuggestionOptions = {}): Promise<LinkSuggestion[]> {
    await this.ensureIndex();

    const settings = this.getSettings();
    const sourceDoc = this.docs.get(file.path);
    if (!sourceDoc) {
      return [];
    }

    const markdown = await this.app.vault.cachedRead(file);
    const normalizedSource = normalizePhrase(stripMarkdownForIndex(markdown, settings.includeFrontmatter));
    const existingTargets = this.readExistingLinkTargets(file);
    const excludeExistingLinks = options.excludeExistingLinks ?? true;
    const suggestions: LinkSuggestion[] = [];

    for (const candidate of this.docs.values()) {
      const existingTarget = existingTargets.has(candidate.path);
      if (candidate.path === sourceDoc.path || (excludeExistingLinks && existingTarget)) {
        continue;
      }

      const mention = this.getMentionSignal(normalizedSource, sourceDoc, candidate, settings, existingTarget);
      const metadataScore = settings.useMetadataRanking
        ? metadataOverlap(sourceDoc.metadataTerms, candidate.metadataTerms)
        : 0;
      if (isWeakShortCandidate(candidate, mention.score, metadataScore)) {
        continue;
      }

      const cosine = cosineSimilarity(sourceDoc.vector, candidate.vector);
      const bm25 = bm25Similarity(
        sourceDoc.terms,
        candidate.terms,
        this.idf,
        candidate.termCount,
        this.averageDocumentLength
      );
      const score = scoreCandidate(cosine, bm25, mention.score, metadataScore, settings.metadataWeight);

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
        bm25,
        exactMatch: mention.score > 0,
        metadataScore,
        sharedTerms,
        reasons: buildReasons(mention.reason, metadataScore, sharedTerms),
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

  private getMentionSignal(
    normalizedSource: string,
    sourceDoc: IndexedNote,
    candidate: IndexedNote,
    settings: ContextPrismSettings,
    existingTarget: boolean
  ): { score: number; reason: MentionReason } {
    if (existingTarget) {
      return { score: EXISTING_LINK_BOOST, reason: "existing-link" };
    }

    const candidateMention = this.getCandidateMentionSignal(normalizedSource, candidate);
    const sourceMention = getSourceTitleSignal(sourceDoc, candidate, settings);

    return candidateMention.score >= sourceMention.score ? candidateMention : sourceMention;
  }

  private getCandidateMentionSignal(
    normalizedSource: string,
    candidate: IndexedNote
  ): { score: number; reason: "title" | "alias" | null } {
    const normalizedTitle = normalizePhrase(candidate.title);
    if (normalizedTitle && containsPhrase(normalizedSource, normalizedTitle)) {
      return { score: TITLE_MENTION_BOOST, reason: "title" };
    }

    for (const alias of candidate.aliases) {
      const normalizedAlias = normalizePhrase(alias);
      if (!normalizedAlias || !isInformativeAlias(normalizedAlias)) {
        continue;
      }

      if (containsPhrase(normalizedSource, normalizedAlias)) {
        return { score: ALIAS_MENTION_BOOST, reason: "alias" };
      }
    }

    return { score: 0, reason: null };
  }

  private shouldIndexFile(file: TFile, settings: ContextPrismSettings): boolean {
    const path = normalizeVaultPath(file.path);
    const includeFolders = settings.includeFolders.map(normalizeFolder);
    const excludeFolders = settings.excludeFolders.map(normalizeFolder);
    const included =
      includeFolders.length === 0 ||
      includeFolders.some((folder) => path === folder || path.startsWith(`${folder}/`));
    const excluded = excludeFolders.some((folder) => path === folder || path.startsWith(`${folder}/`));

    return included && !excluded;
  }
}

function getSourceTitleSignal(
  sourceDoc: IndexedNote,
  candidate: IndexedNote,
  settings: ContextPrismSettings
): {
  score: number;
  reason: MentionReason;
} {
  const normalizedSourceTitle = normalizePhrase(sourceDoc.title);
  const sourceTitleTerms = tokenize(normalizedSourceTitle, settings.indexLanguages);
  if (!isInformativeTitle(sourceTitleTerms)) {
    return { score: 0, reason: null };
  }

  const normalizedCandidateTitle = normalizePhrase(candidate.title);
  if (containsPhrase(normalizedCandidateTitle, normalizedSourceTitle)) {
    return { score: SOURCE_TITLE_IN_TITLE_BOOST, reason: "source-title-title" };
  }

  if (metadataContainsTerms(candidate.metadataTerms, sourceTitleTerms)) {
    return { score: SOURCE_TITLE_IN_METADATA_BOOST, reason: "source-title-metadata" };
  }

  if (termsContainAll(candidate.terms, sourceTitleTerms)) {
    return { score: SOURCE_TITLE_IN_TERMS_BOOST, reason: "source-title-content" };
  }

  return { score: 0, reason: null };
}

function isInformativeTitle(titleTerms: string[]): boolean {
  if (titleTerms.length === 0) {
    return false;
  }

  return titleTerms.some((term) => term.length >= 3);
}

function metadataContainsTerms(metadataTerms: string[], requiredTerms: string[]): boolean {
  const normalizedMetadataTerms = new Set(
    metadataTerms
      .flatMap((term) => normalizePhrase(term).split(" "))
      .filter(Boolean)
  );

  return requiredTerms.every((term) => normalizedMetadataTerms.has(term));
}

function termsContainAll(terms: Map<string, number>, requiredTerms: string[]): boolean {
  return requiredTerms.every((term) => terms.has(term));
}

function isWeakShortCandidate(
  candidate: IndexedNote,
  mentionScore: number,
  metadataScore: number
): boolean {
  return (
    candidate.estimatedTokens < SHORT_NOTE_TOKEN_THRESHOLD &&
    mentionScore === 0 &&
    metadataScore < STRONG_METADATA_SCORE
  );
}

function normalizeFolder(folder: string): string {
  return normalizeVaultPath(folder.trim()).replace(/\/$/, "");
}

function normalizeVaultPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
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
    ...collectStrings(frontmatter.tags)
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

function countAllTerms(terms: Map<string, number>): number {
  let total = 0;

  for (const count of terms.values()) {
    total += count;
  }

  return total;
}

function buildWeightedTermCounts(
  fields: Array<{ text: string; weight: number }>,
  languages: ContextPrismSettings["indexLanguages"]
): Map<string, number> {
  const terms = new Map<string, number>();

  for (const field of fields) {
    if (!field.text || field.weight <= 0) {
      continue;
    }

    for (const term of tokenize(field.text, languages)) {
      terms.set(term, (terms.get(term) ?? 0) + field.weight);
    }
  }

  return terms;
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

function containsPhrase(normalizedSource: string, normalizedPhrase: string): boolean {
  return ` ${normalizedSource} `.includes(` ${normalizedPhrase} `);
}

function isInformativeAlias(normalizedAlias: string): boolean {
  const tokens = normalizedAlias.split(" ").filter(Boolean);
  if (tokens.length !== 1) {
    return true;
  }

  return tokens[0].length >= MIN_SINGLE_TOKEN_ALIAS_LENGTH;
}

function buildReasons(
  mentionReason: MentionReason,
  metadataScore: number,
  sharedTerms: string[]
): string[] {
  const reasons: string[] = [];

  if (mentionReason === "title") {
    reasons.push("Title appears in the note");
  }

  if (mentionReason === "alias") {
    reasons.push("Alias appears in the note");
  }

  if (mentionReason === "existing-link") {
    reasons.push("Already linked from source note");
  }

  if (mentionReason === "source-title-title") {
    reasons.push("Source title appears in candidate title");
  }

  if (mentionReason === "source-title-metadata") {
    reasons.push("Candidate metadata references source title");
  }

  if (mentionReason === "source-title-content") {
    reasons.push("Candidate content references source title");
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
