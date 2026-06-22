import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/default-settings";

describe("default settings", () => {
  it("excludes common template folders by default", () => {
    expect(DEFAULT_SETTINGS.excludeFolders).toContain("Templates");
    expect(DEFAULT_SETTINGS.excludeFolders).toContain("1-Templates");
  });

  it("enables metadata ranking with a conservative default weight", () => {
    expect(DEFAULT_SETTINGS.useMetadataRanking).toBe(true);
    expect(DEFAULT_SETTINGS.metadataWeight).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.metadataWeight).toBeLessThanOrEqual(0.1);
  });

  it("has not marked release notes as seen on first load", () => {
    expect(DEFAULT_SETTINGS.lastSeenReleaseNotesVersion).toBeNull();
  });
});
