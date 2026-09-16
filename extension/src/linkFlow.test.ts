import { describe, expect, it, vi } from "vitest";
import type { ExtensionDb, JournalSchema, ProfileInfo, SessionInfo } from "./db";
import { fetchJournalDump, getStatus, linkWithToken } from "./linkFlow";

const USER = { id: "user-1", email: "beyenchesney@outlook.com" };
const SESSION: SessionInfo = { userId: USER.id, email: USER.email, expiresAt: "2026-09-16T21:00:00.000Z" };
const BETA_PROFILE: ProfileInfo = { beta: true, methodologyId: "m-1", timezone: "Europe/Brussels" };
const JOURNAL: JournalSchema = {
  id: "m-1",
  naam: "WPM",
  assetClass: "forex",
  trackExit: false,
  fields: [
    {
      fieldKey: "entry_type",
      label: "Entry type",
      labelKey: null,
      fieldType: "enum",
      options: ["A", "B"],
      required: true,
      isComputed: false,
      groupLabel: null,
      sortOrder: 1,
    },
  ],
};

function makeDb(overrides: Partial<ExtensionDb> = {}): ExtensionDb {
  return {
    verifyLinkToken: vi.fn(async (token: string) =>
      token === "valid" ? { user: USER } : { user: null, error: "Token is invalid or has expired" }
    ),
    signOutLocal: vi.fn(async () => {}),
    getSessionInfo: vi.fn(async () => SESSION),
    refreshSession: vi.fn(async () => ({})),
    getProfile: vi.fn(async () => BETA_PROFILE),
    getJournalSchema: vi.fn(async () => JOURNAL),
    listJournals: vi.fn(async () => []),
    listBacktestProjects: vi.fn(async () => []),
    insertTrade: vi.fn(async () => ({ ok: true as const, tradeId: "t-1", duplicate: false })),
    ...overrides,
  };
}

describe("linkWithToken", () => {
  it("koppelt een beta-user", async () => {
    const db = makeDb();
    const result = await linkWithToken(db, "valid");
    expect(result).toEqual({ ok: true, email: USER.email });
    expect(db.signOutLocal).not.toHaveBeenCalled();
  });

  it("trimt de geplakte code", async () => {
    const db = makeDb();
    const result = await linkWithToken(db, "  valid \n");
    expect(result.ok).toBe(true);
    expect(db.verifyLinkToken).toHaveBeenCalledWith("valid");
  });

  it("weigert een lege code zonder netwerk-call", async () => {
    const db = makeDb();
    const result = await linkWithToken(db, "   ");
    expect(result.ok).toBe(false);
    expect(db.verifyLinkToken).not.toHaveBeenCalled();
  });

  it("geeft de verifyOtp-fout door bij een ongeldige code", async () => {
    const db = makeDb();
    const result = await linkWithToken(db, "wrong");
    expect(result).toEqual({ ok: false, error: "Token is invalid or has expired" });
    expect(db.getProfile).not.toHaveBeenCalled();
  });

  it("logt een niet-beta-user direct weer uit (gate, plan C3)", async () => {
    const db = makeDb({ getProfile: vi.fn(async () => ({ ...BETA_PROFILE, beta: false })) });
    const result = await linkWithToken(db, "valid");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("beta");
    expect(db.signOutLocal).toHaveBeenCalledOnce();
  });

  it("logt uit als het profiel onleesbaar is", async () => {
    const db = makeDb({ getProfile: vi.fn(async () => null) });
    const result = await linkWithToken(db, "valid");
    expect(result.ok).toBe(false);
    expect(db.signOutLocal).toHaveBeenCalledOnce();
  });
});

describe("getStatus", () => {
  it("meldt niet-gekoppeld zonder sessie", async () => {
    const db = makeDb({ getSessionInfo: vi.fn(async () => null) });
    expect(await getStatus(db)).toEqual({ linked: false });
  });

  it("meldt e-mail en verloopmoment mét sessie", async () => {
    expect(await getStatus(makeDb())).toEqual({
      linked: true,
      email: USER.email,
      expiresAt: SESSION.expiresAt,
    });
  });
});

describe("fetchJournalDump", () => {
  it("weigert zonder sessie", async () => {
    const db = makeDb({ getSessionInfo: vi.fn(async () => null) });
    const result = await fetchJournalDump(db);
    expect(result.ok).toBe(false);
  });

  it("levert profiel + journal-schema", async () => {
    const result = await fetchJournalDump(makeDb());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile).toEqual(BETA_PROFILE);
      expect(result.journal).toEqual(JOURNAL);
    }
  });

  it("geeft journal null als er nog geen actief journal is", async () => {
    const db = makeDb({ getProfile: vi.fn(async () => ({ ...BETA_PROFILE, methodologyId: null })) });
    const result = await fetchJournalDump(db);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.journal).toBeNull();
      expect(db.getJournalSchema).not.toHaveBeenCalled();
    }
  });
});
