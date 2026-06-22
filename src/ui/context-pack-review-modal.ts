import { App, ButtonComponent, Modal, Setting, TFile } from "obsidian";
import {
  buildFeedbackReport,
  buildSelectedContextPack,
  createDefaultSelectedPaths,
  filterSelectedSuggestions,
  getCandidateTokenInfo,
  summarizeContextPackReview
} from "../context-pack";
import { formatTokenCount } from "../token-estimator";
import { ContextPrismSettings, LinkSuggestion } from "../types";

interface ContextPackReviewModalOptions {
  sourceFile: TFile;
  suggestions: LinkSuggestion[];
  indexedVaultTokens: number;
  settings: ContextPrismSettings;
  pluginVersion?: string;
  onCopyContextPack: (markdown: string, selectedCount: number, contextPackTokens: number) => Promise<void>;
  onCopyFeedbackReport: (markdown: string) => Promise<void>;
}

export class ContextPackReviewModal extends Modal {
  private readonly selectedPaths: Set<string>;
  private includePathsInFeedback = false;
  private footerEl: HTMLElement | null = null;
  private copyButton: ButtonComponent | null = null;

  constructor(app: App, private readonly options: ContextPackReviewModalOptions) {
    super(app);
    this.selectedPaths = createDefaultSelectedPaths({
      sourceFile: options.sourceFile,
      suggestions: options.suggestions,
      indexedVaultTokens: options.indexedVaultTokens,
      settings: options.settings
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("context-prism-modal");
    contentEl.addClass("context-prism-context-review-modal");

    this.renderHeader(contentEl);

    if (this.options.suggestions.length === 0) {
      contentEl.createEl("p", {
        cls: "context-prism-empty",
        text: "No context candidates matched the current settings."
      });
      new Setting(contentEl).addButton((button) =>
        button.setButtonText("Close").onClick(() => this.close())
      );
      return;
    }

    this.renderControls(contentEl);
    const list = contentEl.createDiv({ cls: "context-prism-review-list" });
    for (const [index, suggestion] of this.options.suggestions.entries()) {
      this.renderCandidate(list, suggestion, index + 1);
    }

    this.footerEl = contentEl.createDiv({ cls: "context-prism-review-footer" });
    this.renderFooter();
    this.renderActions(contentEl);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderHeader(container: HTMLElement): void {
    container.createEl("h2", { text: "Review AI context pack" });
    container.createEl("div", {
      cls: "context-prism-source-path",
      text: `Source note: ${this.options.sourceFile.path}`
    });
    container.createEl("p", {
      cls: "context-prism-review-help",
      text: "Selected notes will be included in the copied context pack for your AI assistant."
    });
  }

  private renderControls(container: HTMLElement): void {
    new Setting(container)
      .addButton((button) =>
        button.setButtonText("Select all").onClick(() => {
          for (const suggestion of this.options.suggestions) {
            this.selectedPaths.add(suggestion.targetPath);
          }
          this.refresh();
        })
      )
      .addButton((button) =>
        button.setButtonText("Clear all").onClick(() => {
          this.selectedPaths.clear();
          this.refresh();
        })
      );
  }

  private renderCandidate(container: HTMLElement, suggestion: LinkSuggestion, rank: number): void {
    const row = container.createDiv({ cls: "context-prism-review-candidate" });
    const header = row.createDiv({ cls: "context-prism-review-candidate-header" });
    const checkbox = header.createEl("input", {
      attr: {
        "aria-label": `Include ${suggestion.targetPath}`,
        type: "checkbox"
      }
    });
    checkbox.checked = this.selectedPaths.has(suggestion.targetPath);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        this.selectedPaths.add(suggestion.targetPath);
      } else {
        this.selectedPaths.delete(suggestion.targetPath);
      }
      this.renderFooter();
    });

    header.createEl("span", {
      cls: "context-prism-rank",
      text: `#${rank}`
    });

    const titleBlock = header.createDiv({ cls: "context-prism-review-title-block" });
    titleBlock.createEl("strong", {
      cls: "context-prism-review-path",
      text: suggestion.targetPath
    });
    titleBlock.createEl("span", {
      cls: "context-prism-review-title",
      text: suggestion.title
    });

    const snippet = suggestion.snippet.slice(0, this.options.settings.contextSnippetLength).trim();
    row.createEl("p", {
      cls: "context-prism-snippet",
      text: snippet || "No snippet available."
    });

    row.createEl("div", {
      cls: "context-prism-reasons",
      text: suggestion.reasons.join(" - ") || "Lexical similarity"
    });

    const tokenInfo = getCandidateTokenInfo(suggestion, this.options.settings.contextSnippetLength);
    row.createEl("div", {
      cls: "context-prism-token-line",
      text: `Full note estimate: ~${formatTokenCount(
        tokenInfo.estimatedFullNoteTokens
      )} tokens - Context-pack block estimate: ~${formatTokenCount(tokenInfo.estimatedPackBlockTokens)} tokens`
    });
  }

  private renderFooter(): void {
    if (!this.footerEl) {
      return;
    }

    const summary = summarizeContextPackReview({
      sourceFile: this.options.sourceFile,
      suggestions: this.options.suggestions,
      selectedPaths: this.selectedPaths,
      indexedVaultTokens: this.options.indexedVaultTokens,
      settings: this.options.settings
    });

    this.footerEl.empty();
    const summaryLine = this.footerEl.createDiv({ cls: "context-prism-review-summary-line" });
    summaryLine.createEl("span", {
      text: `Selected notes: ${summary.selectedCount} of ${summary.totalCount}`
    });
    summaryLine.createEl("span", {
      text: `Selected pack: ~${formatTokenCount(summary.contextPackTokens)} tokens`
    });
    summaryLine.createEl("span", {
      attr: {
        title: "Estimated avoided context compares the indexed vault token estimate with this selected context pack. It is not a model-specific context-window saving."
      },
      text: `Estimated avoided context: ~${formatTokenCount(summary.estimatedTokensSaved)} tokens`
    });

    if (summary.removedDefaultPackTokens > 0) {
      this.footerEl.createEl("div", {
        cls: "context-prism-review-removed",
        text: `Removed from default pack: ~${formatTokenCount(summary.removedDefaultPackTokens)} candidate-block tokens`
      });
    }

    this.copyButton?.setDisabled(summary.selectedCount === 0);
  }

  private renderActions(container: HTMLElement): void {
    const privacy = container.createDiv({ cls: "context-prism-feedback-privacy" });
    const privacyLabel = privacy.createEl("label");
    const privacyCheckbox = privacyLabel.createEl("input", {
      attr: {
        type: "checkbox"
      }
    });
    privacyCheckbox.checked = this.includePathsInFeedback;
    privacyCheckbox.addEventListener("change", () => {
      this.includePathsInFeedback = privacyCheckbox.checked;
    });
    privacyLabel.createSpan({
      text: " Include note paths in feedback report"
    });
    privacy.createEl("div", {
      cls: "context-prism-feedback-note",
      text: "Feedback reports omit snippets and note bodies by default. Use synthetic or redacted examples for public issues."
    });

    new Setting(container)
      .addButton((button) =>
        button.setButtonText("Copy feedback report").onClick(async () => {
          const report = buildFeedbackReport({
            sourceFile: this.options.sourceFile,
            suggestions: this.options.suggestions,
            selectedPaths: this.selectedPaths,
            settings: this.options.settings,
            pluginVersion: this.options.pluginVersion,
            includePaths: this.includePathsInFeedback
          });
          await this.options.onCopyFeedbackReport(report);
        })
      )
      .addButton((button) => {
        this.copyButton = button;
        button
          .setButtonText("Copy selected context pack")
          .setCta()
          .onClick(async () => {
            const selectedSuggestions = filterSelectedSuggestions(
              this.options.suggestions,
              this.selectedPaths
            );
            if (selectedSuggestions.length === 0) {
              return;
            }

            const { markdown, stats } = buildSelectedContextPack({
              sourceFile: this.options.sourceFile,
              suggestions: this.options.suggestions,
              selectedSuggestions,
              indexedVaultTokens: this.options.indexedVaultTokens,
              settings: this.options.settings
            });

            await this.options.onCopyContextPack(
              markdown,
              selectedSuggestions.length,
              stats.contextPackTokens
            );
            this.close();
          });
      })
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));

    this.renderFooter();
  }

  private refresh(): void {
    this.onOpen();
  }
}
