import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { buildContextPack } from "./context-pack";
import { LinkIndexService } from "./indexer";
import { shouldShowReleaseNotes } from "./release-notes";
import { DEFAULT_SETTINGS, ContextPrismSettingTab } from "./settings";
import { formatTokenCount } from "./token-estimator";
import { ContextPackReviewModal } from "./ui/context-pack-review-modal";
import { ReleaseNotesModal } from "./ui/release-notes-modal";
import { SuggestionsModal } from "./ui/suggestions-modal";
import type { IndexLanguage, LinkSuggestion, ContextPrismSettings } from "./types";

export default class ContextPrismPlugin extends Plugin {
  settings: ContextPrismSettings = DEFAULT_SETTINGS;
  private indexService!: LinkIndexService;
  private statusBarItem!: HTMLElement;
  private activeSuggestions: LinkSuggestion[] = [];
  private activeSuggestionPath: string | null = null;
  private activeSuggestionMode: SuggestionMode | null = null;
  private prepareTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.indexService = new LinkIndexService(this.app, () => this.settings);
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass("context-prism-status");
    this.statusBarItem.setText("Context Prism");
    this.statusBarItem.onClickEvent(() => {
      void this.openSuggestionsForActiveFile();
    });

    this.addRibbonIcon("link", "Review link suggestions", () => {
      void this.openSuggestionsForActiveFile();
    });

    this.addCommand({
      id: "review-current-note",
      name: "Review link suggestions for current note",
      callback: () => {
        void this.openSuggestionsForActiveFile();
      }
    });

    this.addCommand({
      id: "copy-ai-context-pack",
      name: "Copy AI context pack for current note",
      callback: () => {
        void this.copyContextPackForActiveFile();
      }
    });

    this.addCommand({
      id: "review-ai-context-pack",
      name: "Review AI context pack for current note",
      callback: () => {
        void this.openContextPackReviewForActiveFile();
      }
    });

    this.addCommand({
      id: "rebuild-index",
      name: "Rebuild link index",
      callback: async () => {
        const stats = await this.indexService.rebuild();
        new Notice(`Indexed ${stats.notes} notes and ${stats.terms} terms.`);
      }
    });

    this.addCommand({
      id: "show-release-notes",
      name: "Show what's new",
      callback: () => {
        this.openReleaseNotes();
      }
    });

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexService.markDirty();
          this.scheduleContextPreparation();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexService.markDirty();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.indexService.markDirty();
        }
      })
    );

    this.addSettingTab(new ContextPrismSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.scheduleContextPreparation();
      })
    );
    this.app.workspace.onLayoutReady(() => {
      this.scheduleContextPreparation();
      void this.maybeShowReleaseNotes();
    });
  }

  onunload(): void {
    if (this.prepareTimer !== null) {
      window.clearTimeout(this.prepareTimer);
      this.prepareTimer = null;
    }
  }

  async loadSettings(): Promise<void> {
    const loadedData: unknown = await this.loadData();
    this.settings = normalizeSettings(loadedData);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async saveSettingsAndInvalidateIndex(): Promise<void> {
    await this.saveSettings();
    this.indexService?.markDirty();
  }

  private async maybeShowReleaseNotes(): Promise<void> {
    if (!shouldShowReleaseNotes(this.manifest.version, this.settings.lastSeenReleaseNotesVersion)) {
      return;
    }

    this.openReleaseNotes();
  }

  private openReleaseNotes(): void {
    new ReleaseNotesModal(this.app, {
      version: this.manifest.version,
      onDismiss: async () => {
        this.settings.lastSeenReleaseNotesVersion = this.manifest.version;
        await this.saveSettings();
      },
      onReviewCurrentNote: () => {
        void this.openContextPackReviewForActiveFile();
      }
    }).open();
  }

  async prepareContextForActiveFile(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file || !this.settings.autoPrepareContext) {
      this.activeSuggestions = [];
      this.activeSuggestionPath = null;
      this.activeSuggestionMode = null;
      this.statusBarItem.setText("Context Prism");
      return;
    }

    try {
      this.activeSuggestions = await this.indexService.suggestFor(file, { excludeExistingLinks: false });
      this.activeSuggestionPath = file.path;
      this.activeSuggestionMode = "context";
      if (this.activeSuggestions.length === 0) {
        this.statusBarItem.setText("CP: no context candidates");
        return;
      }

      const { stats } = buildContextPack({
        sourceFile: file,
        suggestions: this.activeSuggestions,
        indexedVaultTokens: this.indexService.getEstimatedVaultTokens(),
        settings: this.settings
      });
      this.statusBarItem.setText(
        `CP: ${this.activeSuggestions.length} context candidates - ~${formatTokenCount(stats.estimatedTokensSaved)} saved`
      );
    } catch {
      this.statusBarItem.setText("CP: context unavailable");
    }
  }

  private async openSuggestionsForActiveFile(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file) {
      new Notice("Open a Markdown note first.");
      return;
    }

    const suggestions = await this.getSuggestionsForFile(file, "links");
    new SuggestionsModal(this.app, file, suggestions, this.settings, (count) => {
      new Notice(count === 0 ? "No links inserted." : `Inserted ${count} link${count === 1 ? "" : "s"}.`);
    }).open();
  }

  private async copyContextPackForActiveFile(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file) {
      new Notice("Open a Markdown note first.");
      return;
    }

    const suggestions = await this.getSuggestionsForFile(file, "context");
    if (suggestions.length === 0) {
      new Notice("No context candidates matched the current note.");
      return;
    }

    const { markdown, stats } = buildContextPack({
      sourceFile: file,
      suggestions,
      indexedVaultTokens: this.indexService.getEstimatedVaultTokens(),
      settings: this.settings
    });

    const copied = await this.writeClipboard(markdown);
    if (!copied) {
      return;
    }

    new Notice(
      `Copied AI context pack: ~${formatTokenCount(stats.contextPackTokens)} tokens, ~${formatTokenCount(
        stats.estimatedTokensSaved
      )} avoided.`
    );
  }

  private async openContextPackReviewForActiveFile(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file) {
      new Notice("Open a Markdown note first.");
      return;
    }

    const suggestions = await this.getSuggestionsForFile(file, "context");
    new ContextPackReviewModal(this.app, {
      sourceFile: file,
      suggestions,
      indexedVaultTokens: this.indexService.getEstimatedVaultTokens(),
      settings: this.settings,
      pluginVersion: this.manifest.version,
      onCopyContextPack: async (markdown, selectedCount, contextPackTokens) => {
        const copied = await this.writeClipboard(markdown);
        if (!copied) {
          return;
        }

        new Notice(
          `Copied selected context pack: ${selectedCount} note${selectedCount === 1 ? "" : "s"}, ~${formatTokenCount(
            contextPackTokens
          )} tokens.`
        );
      },
      onCopyFeedbackReport: async (markdown) => {
        const copied = await this.writeClipboard(markdown);
        if (!copied) {
          return;
        }

        new Notice("Copied feedback report template.");
      }
    }).open();
  }

  private async writeClipboard(markdown: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(markdown);
      return true;
    } catch {
      new Notice("Could not copy to clipboard. Please try again from Obsidian.");
      return false;
    }
  }

  private scheduleContextPreparation(): void {
    if (this.prepareTimer !== null) {
      window.clearTimeout(this.prepareTimer);
    }

    this.prepareTimer = window.setTimeout(() => {
      this.prepareTimer = null;
      void this.prepareContextForActiveFile();
    }, 350);
  }

  private async getSuggestionsForFile(file: TFile, mode: SuggestionMode): Promise<LinkSuggestion[]> {
    if (this.activeSuggestionPath === file.path && this.activeSuggestionMode === mode) {
      return this.activeSuggestions;
    }

    const suggestions = await this.indexService.suggestFor(file, {
      excludeExistingLinks: mode === "links"
    });
    this.activeSuggestions = suggestions;
    this.activeSuggestionPath = file.path;
    this.activeSuggestionMode = mode;
    return suggestions;
  }

  private getActiveMarkdownFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file ?? null;
  }
}

type SuggestionMode = "links" | "context";

const VALID_INDEX_LANGUAGES = new Set<string>([
  "multilingual",
  "en",
  "es",
  "fr",
  "de",
  "it",
  "pt"
]);

function normalizeSettings(data: unknown): ContextPrismSettings {
  if (!isRecord(data)) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    includeFolders: readStringArray(data.includeFolders, DEFAULT_SETTINGS.includeFolders),
    excludeFolders: readStringArray(data.excludeFolders, DEFAULT_SETTINGS.excludeFolders),
    indexLanguages: readIndexLanguages(data.indexLanguages, DEFAULT_SETTINGS.indexLanguages),
    minScore: readNumber(data.minScore, DEFAULT_SETTINGS.minScore),
    maxSuggestions: readNumber(data.maxSuggestions, DEFAULT_SETTINGS.maxSuggestions),
    autoPrepareContext: readBoolean(data.autoPrepareContext, DEFAULT_SETTINGS.autoPrepareContext),
    contextSuggestionCount: readNumber(data.contextSuggestionCount, DEFAULT_SETTINGS.contextSuggestionCount),
    contextSnippetLength: readNumber(data.contextSnippetLength, DEFAULT_SETTINGS.contextSnippetLength),
    contextTokenBudget: readNumber(data.contextTokenBudget, DEFAULT_SETTINGS.contextTokenBudget),
    footerHeading: readString(data.footerHeading, DEFAULT_SETTINGS.footerHeading),
    includeAliases: readBoolean(data.includeAliases, DEFAULT_SETTINGS.includeAliases),
    includeFrontmatter: readBoolean(data.includeFrontmatter, DEFAULT_SETTINGS.includeFrontmatter),
    useMetadataRanking: readBoolean(data.useMetadataRanking, DEFAULT_SETTINGS.useMetadataRanking),
    metadataWeight: readNumber(data.metadataWeight, DEFAULT_SETTINGS.metadataWeight),
    showScores: readBoolean(data.showScores, DEFAULT_SETTINGS.showScores),
    lastSeenReleaseNotesVersion: readNullableString(
      data.lastSeenReleaseNotesVersion,
      DEFAULT_SETTINGS.lastSeenReleaseNotesVersion
    )
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : fallback;
}

function readIndexLanguages(value: unknown, fallback: IndexLanguage[]): IndexLanguage[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const languages = value.filter((item): item is IndexLanguage => typeof item === "string" && isIndexLanguage(item));
  return languages.length > 0 ? languages : fallback;
}

function isIndexLanguage(value: string): value is IndexLanguage {
  return VALID_INDEX_LANGUAGES.has(value);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown, fallback: string | null): string | null {
  return typeof value === "string" || value === null ? value : fallback;
}
