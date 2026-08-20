import { describe, expect, it } from "vitest";
import { expiryFromChoice, shareLinkStatus, shareUrl } from "./shareLinkStatus";

const NOW = new Date("2026-08-20T12:00:00Z");

describe("expiryFromChoice", () => {
  it("returns null for a never-expiring link", () => {
    expect(expiryFromChoice(null, NOW)).toBeNull();
  });

  it("adds the chosen number of days", () => {
    expect(expiryFromChoice(7, NOW)).toBe("2026-08-27T12:00:00.000Z");
    expect(expiryFromChoice(30, NOW)).toBe("2026-09-19T12:00:00.000Z");
  });
});

describe("shareLinkStatus", () => {
  it("is active without expiry and without revocation", () => {
    expect(shareLinkStatus({ revoked: false, expires_at: null }, NOW)).toBe("active");
  });

  it("is active until the expiry moment, expired from then on", () => {
    expect(shareLinkStatus({ revoked: false, expires_at: "2026-08-20T12:00:01Z" }, NOW)).toBe("active");
    expect(shareLinkStatus({ revoked: false, expires_at: "2026-08-20T12:00:00Z" }, NOW)).toBe("expired");
    expect(shareLinkStatus({ revoked: false, expires_at: "2026-01-01T00:00:00Z" }, NOW)).toBe("expired");
  });

  it("revoked wins over expired", () => {
    expect(shareLinkStatus({ revoked: true, expires_at: "2026-01-01T00:00:00Z" }, NOW)).toBe("revoked");
    expect(shareLinkStatus({ revoked: true, expires_at: null }, NOW)).toBe("revoked");
  });
});

describe("shareUrl", () => {
  it("builds the public route from origin + token", () => {
    expect(shareUrl("https://beyen.app", "abc123")).toBe("https://beyen.app/share/abc123");
  });
});
