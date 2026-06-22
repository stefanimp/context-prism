export interface ReleaseNoteItem {
  title: string;
  description: string;
}

export const RELEASE_NOTES_VERSION = "0.5.2";

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: "Cleaner direct-copy context packs",
    description:
      "The fast copy command now uses a stricter high-confidence selection so broad ranking noise is less likely to leave the vault."
  },
  {
    title: "Review still shows the wider candidate list",
    description:
      "Use the review command when you want to inspect, include, or exclude the broader ranked suggestions before copying."
  },
  {
    title: "Cleaner snippets from BOM files",
    description:
      "Markdown files that start with a UTF-8 byte order mark no longer leak frontmatter terms into ranking snippets."
  }
];

export function shouldShowReleaseNotes(
  currentVersion: string,
  lastSeenVersion: string | null | undefined
): boolean {
  return currentVersion.trim().length > 0 && lastSeenVersion !== currentVersion;
}
