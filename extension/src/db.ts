// Smal contract tussen de flows (linkFlow, straks tradePayload) en Supabase.
// De flows kennen alleen dit interface — unit-tests faken het zonder
// supabase-js te hoeven mocken; supabaseDb.ts is de echte implementatie.

export interface SessionInfo {
  userId: string;
  email: string;
  /** ISO-timestamp waarop het access-token verloopt. */
  expiresAt: string | null;
}

export interface ProfileInfo {
  /** Actief live-journal (profiles.methodology_id); null = nog geen journal. */
  methodologyId: string | null;
  timezone: string;
}

export interface JournalField {
  id: string;
  fieldKey: string;
  label: string;
  labelKey: string | null;
  fieldType: "boolean" | "enum" | "text" | "number" | "date";
  options: unknown;
  required: boolean;
  isComputed: boolean;
  groupLabel: string | null;
  sortOrder: number;
  /** Conditionele zichtbaarheid: toon dit veld alleen als het veld met dit id
   * één van showWhenValues heeft (zelfde contract als de web-form, plan M6). */
  showWhenFieldId: string | null;
  showWhenValues: unknown;
}

export interface JournalSchema {
  id: string;
  naam: string;
  assetClass: string | null;
  trackExit: boolean;
  fields: JournalField[];
}

export interface JournalInfo {
  id: string;
  naam: string;
  assetClass: string | null;
}

export interface BacktestProjectInfo {
  id: string;
  naam: string;
}

export type InsertTradeResult =
  | { ok: true; tradeId: string | null; duplicate: boolean }
  | { ok: false; error: string; code: "missing-column" | "constraint" | "other" };

/** Open trade zoals het sluit-paneel 'm nodig heeft (F5): genoeg om te tonen
 * én om het resultaat uit een exit-prijs te rekenen. */
export interface OpenTradeInfo {
  id: string;
  datumOpen: string;
  tijdOpen: string | null;
  pair: string;
  instrument: string | null;
  direction: "Long" | "Short" | null;
  entryPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
  riskPct: number | null;
  importRef: string | null;
}

export type UpdateTradeResult =
  | { ok: true; tradeId: string | null }
  | { ok: false; error: string; code: "not-found" | "missing-column" | "constraint" | "other" };

export interface ExtensionDb {
  /** verifyOtp(magiclink token_hash) → user, of een foutmelding. */
  verifyLinkToken(tokenHash: string): Promise<{ user: { id: string; email: string } | null; error?: string }>;
  /** Lokale sessie weggooien (scope 'local' — raakt de web-app-sessie niet). */
  signOutLocal(): Promise<void>;
  /** Huidige sessie, of null. Refresht on-demand als het token verlopen is. */
  getSessionInfo(): Promise<SessionInfo | null>;
  /** Expliciete token-rotatie (chrome.alarms-pad). */
  refreshSession(): Promise<{ error?: string }>;
  /** Eigen profiel (altijd met .eq('id', uid) — een admin ziet anders álle rijen). */
  getProfile(userId: string): Promise<ProfileInfo | null>;
  /** Journal + velden van één methodology (RLS beperkt tot eigen journals). */
  getJournalSchema(methodologyId: string): Promise<JournalSchema | null>;
  /** Eigen journals (geen system-templates) voor de doel-kiezer. */
  listJournals(): Promise<JournalInfo[]>;
  /** Eigen backtest-projecten voor de doel-kiezer (plan M2). */
  listBacktestProjects(): Promise<BacktestProjectInfo[]>;
  /** Insert via PostgREST; unique-violation op import_ref = idempotente retry. */
  insertTrade(payload: Record<string, unknown>): Promise<InsertTradeResult>;
  /** Eigen open trades (is_open) van één journal, nieuwste eerst — mét expliciete
   * user_id-filter (admin-ziet-alles-les). Null = geen journal-filter. */
  listOpenTrades(methodologyId: string | null): Promise<OpenTradeInfo[]>;
  /** Gerichte update op id (sluiten, F5) of import_ref (laatst gelogde trade
   * bijwerken); 0 geraakte rijen = not-found. */
  updateTrade(
    where: { id: string } | { importRef: string },
    patch: Record<string, unknown>
  ): Promise<UpdateTradeResult>;
  /** PNG naar de screenshots-bucket ({uid}/{uuid}.png — RLS eist het uid-prefix, 0039). */
  uploadScreenshot(image: Blob): Promise<{ ok: true; path: string } | { ok: false; error: string }>;
  /** Wees-uploads opruimen wanneer de user de log-poging annuleert (spiegel cleanupUnsavedUploads). */
  removeScreenshots(paths: string[]): Promise<void>;
}
