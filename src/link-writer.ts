import { App, TFile } from "obsidian";
import { LinkSuggestion } from "./types";

export async function insertRelatedLinks(
  app: App,
  sourceFile: TFile,
  suggestions: LinkSuggestion[],
  heading: string
): Promise<number> {
  let inserted = 0;

  await app.vault.process(sourceFile, (content) => {
    const bullets = suggestions
      .map((suggestion) => formatBullet(suggestion))
      .filter((bullet) => !content.includes(bullet.linkNeedle));

    if (bullets.length === 0) {
      inserted = 0;
      return content;
    }

    const sectionHeading = `## ${heading.trim()}`;
    const bulletText = bullets.map((bullet) => bullet.markdown).join("\n");
    const headingPattern = new RegExp(`^##\\s+${escapeRegExp(heading.trim())}\\s*$`, "m");
    const match = content.match(headingPattern);
    inserted = bullets.length;

    if (!match || match.index === undefined) {
      return `${content.trimEnd()}\n\n${sectionHeading}\n${bulletText}\n`;
    }

    const sectionStart = match.index + match[0].length;
    const afterHeading = content.slice(sectionStart);
    const nextHeadingMatch = afterHeading.match(/\n##\s+/);
    const insertAt = nextHeadingMatch?.index !== undefined ? sectionStart + nextHeadingMatch.index : content.length;
    const prefix = content.slice(0, insertAt).trimEnd();
    const suffix = content.slice(insertAt);

    return `${prefix}\n${bulletText}${suffix.startsWith("\n") ? "" : "\n"}${suffix}`;
  });

  return inserted;
}

function formatBullet(suggestion: LinkSuggestion): { markdown: string; linkNeedle: string } {
  const target = suggestion.targetPath.replace(/\.md$/i, "");
  const title = suggestion.title.replace(/[|\]]/g, "");
  const markdown = `- [[${target}|${title}]]`;

  return {
    markdown,
    linkNeedle: `[[${target}`
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
