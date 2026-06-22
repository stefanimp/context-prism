export interface ReleaseNoteItem {
  title: string;
  description: string;
}

export const RELEASE_NOTES_VERSION = "0.5.3";

export const RELEASE_NOTES: ReleaseNoteItem[] = [
  {
    title: "Context packs now include linked project notes",
    description:
      "AI context packs now treat notes already linked from the source note as useful context instead of filtering them out like link suggestions."
  },
  {
    title: "Link suggestions stay focused on new links",
    description:
      "The link-suggestion workflow still hides links that already exist, so inserting internal links remains clean."
  },
  {
    title: "Better project-memory packs",
    description:
      "Short linked notes such as decision logs, action registers, failed approaches, and version history can now be included in direct-copy packs."
  },
  {
    title: "Cleaner audit posture",
    description:
      "The release also removes audit warnings around command naming, settings loading, and an unused settings type import."
  }
];

export function shouldShowReleaseNotes(
  currentVersion: string,
  lastSeenVersion: string | null | undefined
): boolean {
  return currentVersion.trim().length > 0 && lastSeenVersion !== currentVersion;
}
