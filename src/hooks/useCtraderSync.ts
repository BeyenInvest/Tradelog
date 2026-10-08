import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useMethodology } from "@/hooks/useMethodology";
import { prepareImport, type ParsedDeal } from "@/lib/import";
import { fetchExistingImportRefs, loadStoredPairMap } from "@/lib/import/pairMap";
import {
  BROKER_ACCOUNT_COLUMNS,
  ctraderApi,
  positionsToDeals,
  type BrokerAccount,
} from "@/lib/ctrader";
import type { TradesApi } from "@/hooks/useTrades";

/** Auto-sync bij het openen van het journal hooguit om de zoveel tijd per account. */
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
/** Max opeenvolgende server-rondes per sync (elk ≤ 26 weken historiek). */
const MAX_ROUNDS = 4;

export interface CtraderPending {
  account: BrokerAccount;
  deals: ParsedDeal[];
  /** Posities die écht vastzitten (onbekend/ontbrekend symbool of geen %). */
  blockedCount: number;
  fetchedUntil: number;
}

export interface CtraderSyncState {
  /** Actieve, aan dit journal gekoppelde accounts. Leeg = geen UI tonen. */
  accounts: BrokerAccount[];
  syncing: boolean;
  /** Trades die de laatste sync in dit journal zette. */
  importedCount: number | null;
  /** Posities die een handmatige stap nodig hebben (onbekend symbool) — via de import-wizard. */
  pending: CtraderPending | null;
  error: string | null;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;
  /** Na een geslaagde wizard-import: opnieuw syncen (cursor schuift pas als alles verwerkt is). */
  resolvePending: () => Promise<void>;
  /** Pending posities overslaan: cursor erover en verder syncen. */
  ignorePending: () => Promise<void>;
}

/**
 * cTrader-sync voor het live journal (docs/plan-ctrader-sync.md §4).
 *
 * Haalt per gekoppeld account de gesloten posities sinds de cursor op via
 * api/ctrader.ts, en schrijft ze via exact de CSV-import-pipeline weg:
 * prepareImport (dedup op import_ref, symbool-normalisatie) → createTradesBulk
 * (stempelt het actieve journal). De cursor (synced_until) schuift alleen op als
 * álles uit die ronde verwerkt is; anders blijven de posities "pending" en
 * komen ze bij de volgende sync gewoon terug (dedup maakt dat onschadelijk).
 *
 * Alleen accounts waarvan het doel-journal het actieve journal is: een sync
 * schrijft nooit in een journal dat de gebruiker niet voor zich heeft.
 */
export function useCtraderSync(tradesApi: TradesApi, active: boolean): CtraderSyncState {
  const { session, profile } = useAuth();
  const { isForexJournal, methodology } = useMethodology();
  const userId = session?.user.id ?? null;
  const journalId = profile?.methodology_id ?? null;
  const timeZone = profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [accounts, setAccounts] = useState<BrokerAccount[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [pending, setPending] = useState<CtraderPending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const busyRef = useRef(false);
  const autoDoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !userId || !journalId) {
      setAccounts([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("broker_accounts")
      .select(BROKER_ACCOUNT_COLUMNS)
      .eq("user_id", userId)
      .eq("methodology_id", journalId)
      .eq("enabled", true)
      .then(({ data }) => {
        if (cancelled) return;
        const list = (data ?? []) as BrokerAccount[];
        setAccounts(list);
        const latest = list.map((a) => a.last_synced_at).filter((x): x is string => !!x).sort().at(-1) ?? null;
        setLastSyncedAt(latest);
      });
    return () => {
      cancelled = true;
    };
  }, [active, userId, journalId]);

  const ackCursor = useCallback(async (accountId: string, fetchedUntil: number) => {
    await supabase
      .from("broker_accounts")
      .update({ synced_until: new Date(fetchedUntil).toISOString() })
      .eq("id", accountId);
  }, []);

  // Alleen syncen als accounts én methodiek-data bij het ACTIEVE journal horen:
  // vlak na een journal-wissel lopen beide nog even achter, en createTradesBulk
  // stempelt altijd het actieve journal (+ isForexJournal bepaalt pair vs instrument).
  const ready =
    journalId != null &&
    methodology?.id === journalId &&
    accounts.length > 0 &&
    accounts.every((a) => a.methodology_id === journalId);

  const syncNow = useCallback(async () => {
    if (busyRef.current || !userId || !ready) return;
    busyRef.current = true;
    setSyncing(true);
    setError(null);
    let total = 0;
    try {
      const refs = await fetchExistingImportRefs(userId);
      const pairMap = loadStoredPairMap(userId);
      let nextPending: CtraderPending | null = null;
      for (const account of accounts) {
        for (let round = 0; round < MAX_ROUNDS; round++) {
          const res = await ctraderApi.sync(account.id);
          const deals = positionsToDeals(res.positions, account.external_account_id, timeZone);
          const prepared = prepareImport(deals, "ctrader", {
            pairMap,
            accountBalance: null,
            existingImportRefs: refs,
            forexJournal: isForexJournal,
          });
          if (prepared.rows.length > 0) {
            total += await tradesApi.createTradesBulk(prepared.rows);
            for (const r of prepared.rows) refs.add(r.import_ref);
          }
          const blocked = prepared.unknownSymbols.length > 0 || prepared.needsBalance || prepared.missingSymbolCount > 0;
          if (blocked) {
            // Cursor blijft staan; de wizard lost de rest op.
            const unknown = new Set(prepared.unknownSymbols);
            const blockedCount = prepared.needsBalance
              ? deals.length - prepared.rows.length - prepared.duplicateCount
              : deals.filter((d) => !d.symbol.trim() || unknown.has(d.symbol)).length;
            nextPending = nextPending ?? { account, deals, blockedCount, fetchedUntil: res.fetchedUntil };
            break;
          }
          await ackCursor(account.id, res.fetchedUntil);
          if (!res.hasMore) break;
        }
      }
      setPending(nextPending);
      setImportedCount(total);
      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      if (total > 0) setImportedCount(total);
    } finally {
      busyRef.current = false;
      setSyncing(false);
    }
  }, [userId, ready, accounts, timeZone, isForexJournal, tradesApi, ackCursor]);

  // Auto-sync bij openen (één keer per journal-wissel), als de laatste sync oud is.
  useEffect(() => {
    if (!ready || autoDoneRef.current === journalId) return;
    autoDoneRef.current = journalId;
    const stale = accounts.some(
      (a) => !a.last_synced_at || Date.now() - Date.parse(a.last_synced_at) > AUTO_SYNC_INTERVAL_MS
    );
    if (stale) void syncNow();
  }, [ready, accounts, journalId, syncNow]);

  // De wizard heeft de symbool-koppelingen opgeslagen (pairMap); een verse sync
  // importeert wat nog ontbreekt (dedup slaat de rest over) en schuift de cursor
  // pas op als nu echt alles verwerkt is — nooit blind acken.
  const resolvePending = useCallback(async () => {
    setPending(null);
    await syncNow();
  }, [syncNow]);

  // "Negeer": de gebruiker wil de onkoppelbare posities (bv. een index in een
  // forex-journal) niet — cursor erover heen, anders blokkeren ze elke sync.
  const ignorePending = useCallback(async () => {
    if (!pending) return;
    await ackCursor(pending.account.id, pending.fetchedUntil);
    setPending(null);
    await syncNow();
  }, [pending, ackCursor, syncNow]);

  return { accounts, syncing, importedCount, pending, error, lastSyncedAt, syncNow, resolvePending, ignorePending };
}
