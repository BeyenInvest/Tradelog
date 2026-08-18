import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { ResultUnit } from "@/lib/constants";

/**
 * De effectieve resultaat-weergave (Fase J): de eenheid plus — alleen voor
 * 'currency' — het saldo waarmee de weergavelaag % naar geld omrekent
 * (pnl ≈ resultaat_pct/100 × saldo, het currency-MVP uit het Fase J-ontwerp).
 */
export interface ResultDisplayValue {
  unit: ResultUnit;
  /** Actief account-saldo van het actieve journal; alleen gezet als unit === 'currency'. */
  saldo: number | null;
}

const PERCENT: ResultDisplayValue = { unit: "percent", saldo: null };

const ResultDisplayContext = createContext<ResultDisplayValue | null>(null);

/**
 * Eén saldo-fetch voor de hele app (zelfde patroon als MethodologyProvider):
 * bij voorkeur 'currency' wordt het saldo van het actieve (actief=true, anders
 * meest recente) prop-account binnen het actieve journal opgehaald. Geen
 * account → eerlijke terugval naar % in plaats van niets of nul tonen.
 *
 * `override` maakt een genest bereik met een andere weergave — de admin-detailpagina
 * gebruikt dit om currency uit te zetten (het saldo van de kijkende admin slaat
 * nergens op voor de trades van een ándere gebruiker).
 */
export function ResultDisplayProvider({ children, override }: { children: ReactNode; override?: ResultDisplayValue }) {
  const { profile, resultUnit, betaFeatures } = useAuth();
  // Beta-gate (gating-regel): niet-beta-accounts zien altijd %, wat er ook in hun profiel staat.
  const preferred: ResultUnit = betaFeatures ? resultUnit : "percent";
  const activeJournalId = profile?.methodology_id ?? null;
  const [saldo, setSaldo] = useState<number | null>(null);

  useEffect(() => {
    if (override || preferred !== "currency" || !profile) {
      setSaldo(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      // Actieve accounts eerst, dan meest recente — zelfde journal-scoping als usePropAccounts.
      let query = supabase.from("prop_accounts").select("account_size, actief").eq("user_id", profile.id);
      query = activeJournalId ? query.eq("methodology_id", activeJournalId) : query.is("methodology_id", null);
      const { data, error } = await query
        .order("actief", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (error || !data || data.length === 0) setSaldo(null);
      else setSaldo((data[0] as { account_size: number }).account_size);
    })();
    return () => {
      cancelled = true;
    };
  }, [override, preferred, profile, activeJournalId]);

  const value: ResultDisplayValue = override
    ? override
    : preferred === "currency"
      ? saldo != null
        ? { unit: "currency", saldo }
        : PERCENT // geen (geladen) saldo → eerlijk % tonen, nooit €0-getallen
      : { unit: preferred, saldo: null };

  return <ResultDisplayContext.Provider value={value}>{children}</ResultDisplayContext.Provider>;
}

/** Effectieve weergave-eenheid + saldo. Buiten de provider (hoort niet voor te komen) veilig %-only. */
export function useResultDisplay(): ResultDisplayValue {
  return useContext(ResultDisplayContext) ?? PERCENT;
}
