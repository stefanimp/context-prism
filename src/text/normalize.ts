import type { IndexLanguage } from "../types";

const DEFAULT_LANGUAGES: IndexLanguage[] = ["multilingual"];
const STOPWORDS_BY_LANGUAGE: Record<Exclude<IndexLanguage, "multilingual">, string[]> = {
  en: [
    "a",
    "all",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "he",
    "in",
    "is",
    "it",
    "note",
    "notes",
    "not",
    "of",
    "on",
    "or",
    "related",
    "task",
    "tasks",
    "that",
    "the",
    "to",
    "with"
  ],
  es: [
    "al",
    "accion",
    "central",
    "como",
    "conexiones",
    "con",
    "de",
    "del",
    "desarrollo",
    "el",
    "en",
    "es",
    "la",
    "las",
    "hay",
    "idea",
    "lo",
    "los",
    "nota",
    "notas",
    "no",
    "o",
    "para",
    "pero",
    "por",
    "proxima",
    "que",
    "relacionada",
    "relacionadas",
    "relacionado",
    "relacionados",
    "se",
    "si",
    "su",
    "tarea",
    "tareas",
    "un",
    "una",
    "uno",
    "y"
  ],
  fr: [
    "au",
    "aux",
    "ce",
    "ces",
    "dans",
    "de",
    "des",
    "du",
    "en",
    "est",
    "et",
    "la",
    "le",
    "les",
    "ne",
    "non",
    "ou",
    "pas",
    "par",
    "pour",
    "que",
    "qui",
    "un",
    "une"
  ],
  de: [
    "auf",
    "aus",
    "das",
    "dem",
    "den",
    "der",
    "des",
    "die",
    "ein",
    "eine",
    "fur",
    "im",
    "in",
    "ist",
    "mit",
    "nicht",
    "oder",
    "und",
    "von",
    "zu"
  ],
  it: [
    "al",
    "che",
    "con",
    "da",
    "del",
    "della",
    "di",
    "e",
    "gli",
    "ha",
    "il",
    "in",
    "la",
    "le",
    "ma",
    "non",
    "o",
    "per",
    "si",
    "un",
    "una"
  ],
  pt: [
    "a",
    "ao",
    "as",
    "com",
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
    "em",
    "es",
    "nao",
    "o",
    "os",
    "ou",
    "para",
    "por",
    "que",
    "sim",
    "um",
    "uma"
  ]
};

const DIACRITICS = /[\u0300-\u036f]/g;
const BYTE_ORDER_MARK = /^\uFEFF/;
const FRONTMATTER = /^---\s*[\s\S]*?\s*---/;
const FENCED_CODE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`]*`/g;
const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
const MARKDOWN_LINK = /\[([^\]]+)]\(([^)]+)\)/g;
const HTML_TAG = /<[^>]+>/g;
const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}_-]*/gu;
const NON_WORD = /[^\p{L}\p{N}]+/gu;

export function normalizeTerm(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .toLowerCase()
    .trim();
}

export function normalizePhrase(value: string): string {
  return normalizeTerm(value).replace(NON_WORD, " ").replace(/\s+/g, " ").trim();
}

export function stripMarkdownForIndex(markdown: string, includeFrontmatter: boolean): string {
  const normalizedMarkdown = markdown.replace(BYTE_ORDER_MARK, "");
  const withoutFrontmatter = includeFrontmatter
    ? normalizedMarkdown
    : normalizedMarkdown.replace(FRONTMATTER, "");

  return withoutFrontmatter
    .replace(FENCED_CODE, " ")
    .replace(INLINE_CODE, " ")
    .replace(WIKILINK, (_, target: string, alias: string | undefined) => `${target} ${alias ?? ""}`)
    .replace(MARKDOWN_LINK, "$1")
    .replace(HTML_TAG, " ")
    .replace(/[#>*_\-=[\]{}()!?:;,."]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string, languages: IndexLanguage[] = DEFAULT_LANGUAGES): string[] {
  const normalized = normalizeTerm(text);
  const matches = normalized.match(TOKEN_PATTERN) ?? [];
  const stopwords = getStopwords(languages);

  return matches
    .map((term) => normalizeTerm(term))
    .filter((term) => term.length > 1)
    .filter((term) => !stopwords.has(term))
    .filter((term) => !/^\d+$/.test(term));
}

function getStopwords(languages: IndexLanguage[]): Set<string> {
  const requested = languages.length === 0 || languages.includes("multilingual")
    ? (Object.keys(STOPWORDS_BY_LANGUAGE) as Array<Exclude<IndexLanguage, "multilingual">>)
    : languages;

  return new Set(
    requested.flatMap((language) =>
      language === "multilingual" ? [] : STOPWORDS_BY_LANGUAGE[language] ?? []
    )
  );
}

export function countTerms(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  return counts;
}

export function makePreview(markdown: string): string {
  return stripMarkdownForIndex(markdown, false).slice(0, 600);
}
