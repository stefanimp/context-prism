export interface ReleaseNoteItem {
  title: string;
  description: string;
}

export const RELEASE_NOTES_VERSION = "0.5.0";

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: "Review AI context packs before copying",
    description:
      "Open the new review command to inspect ranked notes, snippets, ranking reasons, and token estimates before anything leaves Obsidian."
  },
  {
    title: "Include only the notes that deserve context",
    description:
      "Select or remove candidates, then copy a smaller context pack for ChatGPT, Claude, Codex, Cursor, or another assistant."
  },
  {
    title: "Share retrieval feedback without note bodies",
    description:
      "Copy a privacy-preserving feedback report that omits snippets and note content by default."
  }
];

export function shouldShowReleaseNotes(
  currentVersion: string,
  lastSeenVersion: string | null | undefined
): boolean {
  return currentVersion.trim().length > 0 && lastSeenVersion !== currentVersion;
}
