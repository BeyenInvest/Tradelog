import { describe, it, expect, vi } from "vitest";

// The test env is "node" (see vite.config.ts). Importing errorMessage pulls in i18n, which reads
// localStorage/navigator at module-eval time. vi.hoisted runs before the imports below, so we stub
// just enough of both globals for i18n to initialise (it falls back to the default language here).
vi.hoisted(() => {
  const store = new Map<string, string>();
  globalThis.localStorage ??= {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
  globalThis.navigator ??= { language: "nl" } as Navigator;
  globalThis.document ??= { documentElement: {} } as Document;
});

import { toErrorMessage } from "./errorMessage";

describe("toErrorMessage", () => {
  it("maps a known pattern from a real Error", () => {
    expect(toErrorMessage(new Error("Failed to fetch"))).toBe("Kan geen verbinding maken met de server. Controleer je internetverbinding.");
  });

  it("maps a known pattern from a plain PostgrestError-shaped object (not an Error instance)", () => {
    // Supabase rejects with { message, details, hint, code } — a plain object, not an Error.
    const postgrestError = {
      message: 'duplicate key value violates unique constraint "weekly_reviews_user_id_jaar_week_nummer_key"',
      details: null,
      hint: null,
      code: "23505",
    };
    expect(toErrorMessage(postgrestError, "Opslaan van de review is mislukt")).toBe("Deze combinatie bestaat al.");
  });

  it("maps a known pattern from a string", () => {
    expect(toErrorMessage("JWT expired")).toBe("Je sessie is verlopen. Log opnieuw in.");
  });

  it("falls back for an unknown message (never leaks the raw text)", () => {
    const err = { message: "some internal policy violation on table foo" };
    expect(toErrorMessage(err, "Opslaan van de review is mislukt")).toBe("Opslaan van de review is mislukt");
  });

  it("falls back when there is no usable message", () => {
    expect(toErrorMessage(undefined, "fallback")).toBe("fallback");
    expect(toErrorMessage({ code: "23505" }, "fallback")).toBe("fallback");
  });
});
