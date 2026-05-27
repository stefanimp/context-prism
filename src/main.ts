import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { buildContextPack } from "./context-pack";
import { LinkIndexService } from "./indexer";
import { DEFAULT_SETTINGS, ContextPrismSettingTab } from "./settings";
import { formatTokenCount } from "./token-estimator";
import { SuggestionsModal } from "./ui/suggestions-modal";
import { LinkSuggestion, ContextPrismSettings } from "./types";

export default class ContextPrismPlugin extends Plugin {
  settings: ContextPrismSettings = DEFAULT_SETTINGS;
  private indexService!: LinkIndexService;
  private statusBarItem!: HTMLElement;
  private activeSuggestions: LinkSuggestion[] = [];
  private activeSuggestionPath: string | null = null;
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
      id: "rebuild-index",
      name: "Rebuild link index",
      callback: async () => {
        const stats = await this.indexService.rebuild();
        new Notice(`Indexed ${stats.notes} notes and ${stats.terms} terms.`);
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
    });
  }

  onunload(): void {
    if (this.prepareTimer !== null) {
      window.clearTimeout(this.prepareTimer);
      this.prepareTimer = null;
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData())
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async saveSettingsAndInvalidateIndex(): Promise<void> {
    await this.saveSettings();
    this.indexService?.markDirty();
  }

  async prepareContextForActiveFile(): Promise<void> {
    const file = this.getActiveMarkdownFile();
    if (!file || !this.settings.autoPrepareContext) {
      this.activeSuggestions = [];
      this.activeSuggestionPath = null;
      this.statusBarItem.setText("Context Prism");
      return;
    }

    try {
      this.activeSuggestions = await this.indexService.suggestFor(file);
      this.activeSuggestionPath = file.path;
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

    const suggestions = await this.getSuggestionsForFile(file);
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

    const suggestions = await this.getSuggestionsForFile(file);
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

    await navigator.clipboard.writeText(markdown);
    new Notice(
      `Copied AI context pack: ~${formatTokenCount(stats.contextPackTokens)} tokens, ~${formatTokenCount(
        stats.estimatedTokensSaved
      )} avoided.`
    );
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

  private async getSuggestionsForFile(file: TFile): Promise<LinkSuggestion[]> {
    if (this.activeSuggestionPath === file.path) {
      return this.activeSuggestions;
    }

    const suggestions = await this.indexService.suggestFor(file);
    this.activeSuggestions = suggestions;
    this.activeSuggestionPath = file.path;
    return suggestions;
  }

  private getActiveMarkdownFile(): TFile | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file ?? null;
  }
}
