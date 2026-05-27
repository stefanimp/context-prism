import { App, Modal, Setting, TFile } from "obsidian";
import { insertRelatedLinks } from "../link-writer";
import { LinkSuggestion, ContextPrismSettings } from "../types";

export class SuggestionsModal extends Modal {
  private readonly selected = new Set<string>();

  constructor(
    app: App,
    private readonly sourceFile: TFile,
    private readonly suggestions: LinkSuggestion[],
    private readonly settings: ContextPrismSettings,
    private readonly onApply: (count: number) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("context-prism-modal");
    contentEl.createEl("h2", { text: "Context candidates" });

    if (this.suggestions.length === 0) {
      contentEl.createEl("p", {
        cls: "context-prism-empty",
        text: "No suggestions matched the current settings."
      });
      new Setting(contentEl).addButton((button) =>
        button.setButtonText("Close").onClick(() => this.close())
      );
      return;
    }

    const list = contentEl.createDiv({ cls: "context-prism-list" });
    for (const suggestion of this.suggestions) {
      this.renderSuggestion(list, suggestion);
    }

    new Setting(contentEl)
      .addButton((button) =>
        button.setButtonText("Select all").onClick(() => {
          for (const suggestion of this.suggestions) {
            this.selected.add(suggestion.targetPath);
          }
          this.onOpen();
        })
      )
      .addButton((button) =>
        button
          .setButtonText("Insert selected links")
          .setCta()
          .onClick(async () => {
            const accepted = this.suggestions.filter((suggestion) =>
              this.selected.has(suggestion.targetPath)
            );
            const count = await insertRelatedLinks(
              this.app,
              this.sourceFile,
              accepted,
              this.settings.footerHeading
            );
            this.onApply(count);
            this.close();
          })
      )
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderSuggestion(container: HTMLElement, suggestion: LinkSuggestion): void {
    const row = container.createDiv({ cls: "context-prism-suggestion" });
    const header = row.createDiv({ cls: "context-prism-suggestion-header" });
    const checkbox = header.createEl("input", { type: "checkbox" });
    checkbox.checked = this.selected.has(suggestion.targetPath);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        this.selected.add(suggestion.targetPath);
      } else {
        this.selected.delete(suggestion.targetPath);
      }
    });

    header.createEl("strong", { text: suggestion.title });
    if (this.settings.showScores) {
      header.createEl("span", {
        cls: "context-prism-score",
        text: suggestion.score.toFixed(3)
      });
    }

    if (suggestion.reasons.length > 0) {
      row.createEl("div", {
        cls: "context-prism-reasons",
        text: suggestion.reasons.join(" - ")
      });
    }

    if (suggestion.snippet) {
      row.createEl("p", {
        cls: "context-prism-snippet",
        text: suggestion.snippet
      });
    }
  }
}
