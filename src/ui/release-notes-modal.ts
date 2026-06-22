import { App, Modal, Setting } from "obsidian";
import { RELEASE_NOTES } from "../release-notes";

interface ReleaseNotesModalOptions {
  version: string;
  onDismiss: () => Promise<void>;
  onReviewCurrentNote: () => void;
}

export class ReleaseNotesModal extends Modal {
  private dismissed = false;

  constructor(app: App, private readonly options: ReleaseNotesModalOptions) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("context-prism-modal");
    contentEl.addClass("context-prism-release-notes-modal");

    contentEl.createEl("h2", { text: `What's new in Context Prism ${this.options.version}` });
    contentEl.createEl("p", {
      cls: "context-prism-release-notes-intro",
      text: "Context Prism can now help you decide which retrieved notes are worth showing to an AI assistant."
    });

    const list = contentEl.createEl("ul", { cls: "context-prism-release-notes-list" });
    for (const item of RELEASE_NOTES) {
      const entry = list.createEl("li");
      entry.createEl("strong", { text: item.title });
      entry.createEl("span", { text: item.description });
    }

    contentEl.createEl("p", {
      cls: "context-prism-release-notes-privacy",
      text:
        "This is still local-first: no telemetry, no external API calls, and no vault content is sent anywhere by the plugin."
    });

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText("Review current note")
          .setCta()
          .onClick(async () => {
            await this.dismiss();
            this.options.onReviewCurrentNote();
          })
      )
      .addButton((button) =>
        button.setButtonText("Close").onClick(async () => {
          await this.dismiss();
        })
      );
  }

  onClose(): void {
    this.contentEl.empty();
    void this.markAsDismissed();
  }

  private async dismiss(): Promise<void> {
    await this.markAsDismissed();
    this.close();
  }

  private async markAsDismissed(): Promise<void> {
    if (this.dismissed) {
      return;
    }

    this.dismissed = true;
    await this.options.onDismiss();
  }
}
