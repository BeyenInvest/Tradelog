import type { ExtensionDb, JournalSchema, ProfileInfo, SessionInfo } from "./db";

export interface LinkOk {
  ok: true;
  email: string;
}
export interface FlowError {
  ok: false;
  error: string;
}

/** Koppelen: token inwisselen en het profiel controleren. Sinds de un-gate
 * (2026-09-19) mag elk ingelogd lid koppelen — geen beta-check meer. Zonder
 * leesbaar profiel loggen we meteen weer uit, dan houdt de extensie géén sessie vast. */
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
