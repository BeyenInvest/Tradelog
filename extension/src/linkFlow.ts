import type { ExtensionDb, JournalSchema, ProfileInfo, SessionInfo } from "./db";

export interface LinkOk {
  ok: true;
  email: string;
}
export interface FlowError {
  ok: false;
  error: string;
}

/** Koppelen: token inwisselen en de beta-gate afdwingen. Niet-beta-users worden
 * meteen weer uitgelogd — de extensie houdt dan géén sessie vast. (Client-side
 * weigering, geen harde server-gate — bewuste keuze, plan C3.) */
export async function linkWithToken(db: ExtensionDb, tokenHash: string): Promise<LinkOk | FlowError> {
  const trimmed = tokenHash.trim();
  if (!trimmed) return { ok: false, error: "Lege koppelcode" };

  const { user, error } = await db.verifyLinkToken(trimmed);
  if (!user) return { ok: false, error: error ?? "Koppelcode ongeldig of verlopen" };

  const profile = await db.getProfile(user.id);
  if (!profile) {
    await db.signOutLocal();
    return { ok: false, error: "Geen profiel gevonden voor dit account" };
  }
  if (!profile.beta) {
    await db.signOutLocal();
    return { ok: false, error: "De TradingView-extensie is nog beta-only voor dit account" };
  }
  return { ok: true, email: user.email };
}

export interface StatusInfo {
  linked: boolean;
  email?: string;
  expiresAt?: string | null;
}

export async function getStatus(db: ExtensionDb): Promise<StatusInfo> {
  const session = await db.getSessionInfo();
  if (!session) return { linked: false };
  return { linked: true, email: session.email, expiresAt: session.expiresAt };
}

export interface JournalDump {
  ok: true;
  session: SessionInfo;
  profile: ProfileInfo;
  journal: JournalSchema | null;
}

/** Hello-world van het datapad (F1b): eigen profiel + actief journal-schema
 * ophalen. Geen writes. */
export async function fetchJournalDump(db: ExtensionDb): Promise<JournalDump | FlowError> {
  const session = await db.getSessionInfo();
  if (!session) return { ok: false, error: "Niet gekoppeld" };

  const profile = await db.getProfile(session.userId);
  if (!profile) return { ok: false, error: "Profiel niet leesbaar" };

  const journal = profile.methodologyId ? await db.getJournalSchema(profile.methodologyId) : null;
  return { ok: true, session, profile, journal };
}
