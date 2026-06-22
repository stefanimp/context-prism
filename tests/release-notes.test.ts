import { describe, expect, it } from "vitest";
import { RELEASE_NOTES, RELEASE_NOTES_VERSION, shouldShowReleaseNotes } from "../src/release-notes";

describe("release notes", () => {
  it("shows release notes when the current version has not been seen", () => {
    expect(shouldShowReleaseNotes("0.5.0", null)).toBe(true);
    expect(shouldShowReleaseNotes("0.5.0", "0.4.1")).toBe(true);
  });

  it("does not show release notes again for the same version", () => {
    expect(shouldShowReleaseNotes("0.5.0", "0.5.0")).toBe(false);
  });

  it("does not show release notes for an empty version", () => {
    expect(shouldShowReleaseNotes("", "0.4.1")).toBe(false);
    expect(shouldShowReleaseNotes("   ", undefined)).toBe(false);
  });

  it("keeps release notes aligned with the release version", () => {
    expect(RELEASE_NOTES_VERSION).toBe("0.5.3");
    expect(RELEASE_NOTES.length).toBeGreaterThanOrEqual(3);
  });
});
