import { App, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "./default-settings";
import type ContextPrismPlugin from "./main";
import type { IndexLanguage, ContextPrismSettings } from "./types";

export { DEFAULT_SETTINGS };

export class ContextPrismSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ContextPrismPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("Indexing").setHeading();

    new Setting(containerEl)
      .setName("Included folders")
      .setDesc("Comma-separated vault paths. Leave empty to index every Markdown file.")
      .addText((text) =>
        text
          .setPlaceholder("2-Notes, Projects")
          .setValue(this.plugin.settings.includeFolders.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.includeFolders = parseList(value);
            await this.plugin.saveSettingsAndInvalidateIndex();
          })
      );

    new Setting(containerEl)
      .setName("Excluded folders")
      .setDesc("Comma-separated vault paths that should never be indexed.")
      .addText((text) =>
        text
          .setPlaceholder("Templates, Archive")
          .setValue(this.plugin.settings.excludeFolders.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.excludeFolders = parseList(value);
            await this.plugin.saveSettingsAndInvalidateIndex();
          })
      );

    new Setting(containerEl)
      .setName("Include aliases")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeAliases).onChange(async (value) => {
          this.plugin.settings.includeAliases = value;
          await this.plugin.saveSettingsAndInvalidateIndex();
        })
      );

    new Setting(containerEl)
      .setName("Index full frontmatter text")
      .setDesc("Aliases, tags, and selected metadata are always used as ranking signals.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeFrontmatter).onChange(async (value) => {
          this.plugin.settings.includeFrontmatter = value;
          await this.plugin.saveSettingsAndInvalidateIndex();
        })
      );

    new Setting(containerEl)
      .setName("Index languages")
      .setDesc("Use multilingual for mixed vaults, or comma-separated codes: en, es, fr, de, it, pt.")
      .addText((text) =>
        text
          .setPlaceholder("multilingual")
          .setValue(formatLanguageProfiles(this.plugin.settings.indexLanguages))
          .onChange(async (value) => {
            this.plugin.settings.indexLanguages = parseLanguageProfiles(value);
            await this.plugin.saveSettingsAndInvalidateIndex();
          })
      );

    new Setting(containerEl)
      .setName("Minimum score")
      .setDesc("Higher values reduce noise. Recommended range: 0.05 to 0.20.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.minScore)).onChange(async (value) => {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) {
            this.plugin.settings.minScore = parsed;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Use metadata ranking")
      .setDesc("Use area, topics, and tags as ranking evidence. Disable this if metadata creates noisy matches.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.useMetadataRanking).onChange(async (value) => {
          this.plugin.settings.useMetadataRanking = value;
          await this.plugin.saveSettings();
          await this.plugin.prepareContextForActiveFile();
        })
      );

    new Setting(containerEl)
      .setName("Metadata weight")
      .setDesc("Boost applied to shared metadata. Recommended range: 0 to 0.15.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.metadataWeight)).onChange(async (value) => {
          const parsed = Number(value);
          if (!Number.isNaN(parsed) && parsed >= 0) {
            this.plugin.settings.metadataWeight = Math.min(parsed, 0.2);
            await this.plugin.saveSettings();
            await this.plugin.prepareContextForActiveFile();
          }
        })
      );

    new Setting(containerEl)
      .setName("Maximum suggestions")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.maxSuggestions)).onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isNaN(parsed) && parsed > 0) {
            this.plugin.settings.maxSuggestions = parsed;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl).setName("AI context").setHeading();

    new Setting(containerEl)
      .setName("Prepare AI context automatically")
      .setDesc("Pre-computes context candidates when you open a note and shows the status in the bottom bar.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoPrepareContext).onChange(async (value) => {
          this.plugin.settings.autoPrepareContext = value;
          await this.plugin.saveSettings();
          await this.plugin.prepareContextForActiveFile();
        })
      );

    new Setting(containerEl)
      .setName("AI context candidates")
      .setDesc("Maximum notes included when copying an AI context pack.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.contextSuggestionCount)).onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isNaN(parsed) && parsed > 0) {
            this.plugin.settings.contextSuggestionCount = parsed;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("Snippet length")
      .setDesc("Maximum characters copied per candidate note.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.contextSnippetLength)).onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isNaN(parsed) && parsed >= 80) {
            this.plugin.settings.contextSnippetLength = parsed;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("AI context token budget")
      .setDesc("Approximate maximum tokens for the copied context pack.")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.contextTokenBudget)).onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (!Number.isNaN(parsed) && parsed >= 300) {
            this.plugin.settings.contextTokenBudget = parsed;
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl).setName("Link insertion").setHeading();

    new Setting(containerEl)
      .setName("Footer heading")
      .addText((text) =>
        text.setValue(this.plugin.settings.footerHeading).onChange(async (value) => {
          this.plugin.settings.footerHeading = value.trim() || DEFAULT_SETTINGS.footerHeading;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Show scores")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showScores).onChange(async (value) => {
          this.plugin.settings.showScores = value;
          await this.plugin.saveSettings();
        })
      );
  }
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatLanguageProfiles(languages: IndexLanguage[]): string {
  return languages.length === 0 ? "multilingual" : languages.join(", ");
}

function parseLanguageProfiles(value: string): IndexLanguage[] {
  const normalized = value
    .split(",")
    .map((item) => normalizeLanguageCode(item.trim()))
    .filter((item): item is IndexLanguage => item !== null);

  if (normalized.length === 0 || normalized.includes("multilingual")) {
    return ["multilingual"];
  }

  return Array.from(new Set(normalized));
}

function normalizeLanguageCode(value: string): IndexLanguage | null {
  const code = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const aliases: Record<string, IndexLanguage> = {
    all: "multilingual",
    auto: "multilingual",
    de: "de",
    deutsch: "de",
    en: "en",
    english: "en",
    es: "es",
    espanol: "es",
    fr: "fr",
    french: "fr",
    german: "de",
    ingles: "en",
    it: "it",
    italian: "it",
    italiano: "it",
    multilingual: "multilingual",
    multi: "multilingual",
    portugues: "pt",
    portuguese: "pt",
    pt: "pt",
    spanish: "es"
  };

  return aliases[code] ?? null;
}
