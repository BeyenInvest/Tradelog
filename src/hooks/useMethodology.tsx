import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { FASES, WPM_TEMPLATE_METHODOLOGY_ID } from "@/lib/constants";
import { instrumentsOfConfig, normalizeInstrument } from "@/lib/instruments";
import { isLockedLegacyField } from "@/lib/methodologyFields";
import type { Methodology, MethodologyField } from "@/lib/types";

/**
 * The subset of a field the inline add (trade form) can set: label + type
 * (+ options for enum). Everything else — required, group, conditions, order —
 * stays with the full editor in Settings, deliberately.
 */
export interface InlineFieldInput {
  field_key: string;
  label: string;
  field_type: MethodologyField["field_type"];
  options: string[] | null;
}

export interface MethodologyData {
  methodology: Methodology | null;
  /** All fields of the active methodology, ordered by sort_order (fase is one of them). */
  fields: MethodologyField[];
  /**
   * Ordered fase names for the UI, read from the methodology's `fase` enum field
   * (since 0023 fase is just a field). Falls back to the fixed FASES constant
   * while loading or if there is no fase field, so the form/filter never shows an
   * empty select and Weekly Phase Method users see no change.
   */
  faseNames: string[];
  /**
   * True when the active methodology still carries the legacy hardcoded Weekly
   * Phase Method block (the fase <select> + fase-kenmerken + confirms/entry/cc/…,
   * backed by real trades.* columns). The trade form gates that whole hardcoded
   * block on this, so an own/empty journal shows only the universal core + its
   * own custom fields (Scope C, optie A). Signalled by the presence of a `fase`
   * enum field — the Weekly Phase Method template and its forks have one; an
   * empty own methodology does not. Stays true while loading so the owner's WPM
   * fields never flash out on open (an empty journal is forward-looking — public
   * signup is still off).
   */
  isLegacyMethodology: boolean;
  /**
   * True when the active journal trades forex (asset_class 'forex' — the Weekly
   * Phase Method template/forks and the Forex presets). Drives the instrument
   * field (pair enum vs free text) and the forex-only breakdowns (pair/currency)
   * / lot calculator (cyclus 7). Stays true while loading so a forex owner never
   * sees the field flip. A blank/own or non-forex journal is false.
   */
  isForexJournal: boolean;
  /**
   * True when the active journal is the user's own editable methodology (not a
   * read-only system template). Curating the instrument list writes to it, so the
   * Settings card and the trade form's inline "add instrument" gate on this.
   */
  isOwnMethodology: boolean;
  /**
   * The journal's curated instrument universe (cyclus D), read from
   * `instrument_config`. Normalized/sorted. Drives the trade-form instrument select
   * and the Settings instrument editor. Empty for a forex journal (it uses the pair
   * enum) and for a fresh non-forex journal until the user curates one.
   */
  instruments: string[];
  /**
   * Adds a symbol to the active journal's instrument list, normalized (trim +
   * uppercase). Idempotent — a value already present is a no-op. Persists to
   * `methodologies.instrument_config` when the journal is the user's own; on a
   * read-only template it only returns the normalized value (the caller still uses
   * it for the trade). Returns the normalized symbol, or null for blank input.
   */
  addInstrument: (raw: string) => Promise<string | null>;
  /** Removes a symbol from the active own journal's instrument list. */
  removeInstrument: (value: string) => Promise<void>;
  /**
   * Appends a custom field to the active own journal (the trade form's inline
   * "+ veld toevoegen" — the lightweight sibling of useMethodologyEditor.addField).
   * Optimistically appended to `fields` so the new input renders immediately,
   * without remounting the form (react-hook-form state survives). Throws on a
   * read-only template — callers gate on `isOwnMethodology`.
   */
  addField: (input: InlineFieldInput) => Promise<MethodologyField>;
  /**
   * Updates label/options of an own custom field from within the form (inline
   * beheer). field_key/type are immutable here; locked legacy fields refuse.
   * Optimistic in-place swap in `fields`.
   */
  updateField: (id: string, patch: { label?: string; options?: string[] | null }) => Promise<MethodologyField>;
  /** Deletes an own custom field. Old trades keep their stored value in trades.custom; it just stops rendering/analysing. */
  deleteField: (id: string) => Promise<void>;
  /**
   * Renames one option of an own enum field WITH data migration: the option list,
   * any sibling show_when conditions referencing the old value, and every trade
   * of this journal whose trades.custom holds the old value all move to the new
   * name in one action — so a rename never splits history into two buckets.
   * Returns how many trades were migrated.
   */
  renameFieldOption: (fieldId: string, oldValue: string, newValue: string) => Promise<{ migrated: number }>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Loads the signed-in user's active methodology (profiles.methodology_id, or the
 * built-in system template as a fallback) with its fields. Read-only source of
 * truth for the fase list — replaces the hard-coded FASES constant in the trade
 * form and filters (Scope C, cyclus 1). Since plak 2b the fase list comes from
 * the `fase` field, not the (now-transitional) methodology_fases table.
 *
 * Internal: holds the actual state. Mounted exactly once by MethodologyProvider;
 * every consumer reads the shared instance via useMethodology(), so an inline
 * mutation (add/update/delete field, instrument, option-rename) is immediately
 * visible everywhere — form, filters, sidebar, analysis — without refetching.
 */
function useMethodologyState(): MethodologyData {
  const { profile } = useAuth();
  const methodologyId = profile?.methodology_id ?? null;

  const [methodology, setMethodology] = useState<Methodology | null>(null);
  const [fields, setFields] = useState<MethodologyField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Same guard as useTrades: a slow response from a previous journal must not land
  // after a newer request and overwrite its fields — the trade form would render
  // the wrong journal's custom fields (M3).
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    // Resolve which methodology to load: the profile's, else the built-in Weekly
    // Phase Method template — pinned by id, since the preset catalogue (0027/0028)
    // added many is_system rows and an unordered limit(1) would pick arbitrarily.
    let id = methodologyId;
    if (!id) {
      const { data: sys } = await supabase
        .from("methodologies")
        .select("id")
        .eq("id", WPM_TEMPLATE_METHODOLOGY_ID)
        .maybeSingle();
      id = (sys as { id: string } | null)?.id ?? null;
    }
    if (requestId !== requestIdRef.current) return; // superseded by a newer refresh

    if (!id) {
      setMethodology(null);
      setFields([]);
      setLoading(false);
      return;
    }

    const [m, fl] = await Promise.all([
      supabase.from("methodologies").select("*").eq("id", id).maybeSingle(),
      supabase.from("methodology_fields").select("*").eq("methodology_id", id).order("sort_order"),
    ]);
    if (requestId !== requestIdRef.current) return; // superseded by a newer refresh

    const err = m.error ?? fl.error;
    if (err) {
      // Keep the previous methodology/fields on a flaky fetch (M7): wiping them
      // would make the legacy fase block & custom fields vanish from an open form.
      setError(toErrorMessage(err));
      setLoading(false);
      return;
    }

    setMethodology((m.data as Methodology | null) ?? null);
    setFields((fl.data as MethodologyField[] | null) ?? []);
    setLoading(false);
  }, [methodologyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const faseNames = useMemo(() => {
    const faseField = fields.find((f) => f.field_key === "fase" && f.field_type === "enum");
    const opts = faseField?.options ?? [];
    if (opts.length > 0) return opts;
    // No fase field. Only fall back to the built-in Weekly Phase Method fases while the
    // methodology is still loading, so the form/filter never flashes an empty
    // select. Once loaded, an own methodology with no fase field must NOT get
    // Weekly Phase Method's fases imposed — new users start from an empty journal
    // (Scope C, cyclus 1b plak 3).
    return loading ? [...FASES] : [];
  }, [fields, loading]);

  const isLegacyMethodology = useMemo(
    () => loading || fields.some((f) => f.field_key === "fase"),
    [fields, loading]
  );

  // Forex while loading so a forex owner's pair select never flips to a free field on open.
  const isForexJournal = useMemo(
    () => loading || methodology?.asset_class === "forex",
    [loading, methodology]
  );

  const isOwnMethodology = useMemo(
    () => methodology != null && !methodology.is_system && methodology.user_id != null,
    [methodology]
  );

  const instruments = useMemo(
    () => instrumentsOfConfig(methodology?.instrument_config),
    [methodology]
  );

  const addInstrument = useCallback(
    async (raw: string): Promise<string | null> => {
      const norm = normalizeInstrument(raw);
      if (!norm) return null;
      if (!methodology || methodology.is_system || methodology.user_id == null) return norm;
      if (instruments.includes(norm)) return norm;

      const nextConfig = {
        ...(methodology.instrument_config ?? {}),
        instruments: [...instruments, norm],
      };
      const { error: err } = await supabase
        .from("methodologies")
        .update({ instrument_config: nextConfig })
        .eq("id", methodology.id);
      if (err) throw err;
      // Optimistic local update so the new symbol is immediately selectable without
      // a full refetch (the trade form adds-then-selects in one interaction).
      setMethodology((m) => (m ? { ...m, instrument_config: nextConfig } : m));
      return norm;
    },
    [methodology, instruments]
  );

  const removeInstrument = useCallback(
    async (value: string): Promise<void> => {
      const norm = normalizeInstrument(value);
      if (!methodology || methodology.is_system || methodology.user_id == null) return;
      if (!instruments.includes(norm)) return;

      const nextConfig = {
        ...(methodology.instrument_config ?? {}),
        instruments: instruments.filter((i) => i !== norm),
      };
      const { error: err } = await supabase
        .from("methodologies")
        .update({ instrument_config: nextConfig })
        .eq("id", methodology.id);
      if (err) throw err;
      setMethodology((m) => (m ? { ...m, instrument_config: nextConfig } : m));
    },
    [methodology, instruments]
  );

  const addField = useCallback(
    async (input: InlineFieldInput): Promise<MethodologyField> => {
      if (!methodology || methodology.is_system || methodology.user_id == null) {
        throw new Error("methodology is read-only");
      }
      const nextSort = (fields.at(-1)?.sort_order ?? 0) + 1;
      const { data, error: err } = await supabase
        .from("methodology_fields")
        .insert({ methodology_id: methodology.id, ...input, required: false, sort_order: nextSort })
        .select("*")
        .single();
      if (err) throw err;
      const row = data as MethodologyField;
      // Optimistic local append so the new input renders immediately in the open
      // form (mirrors addInstrument's add-then-use-in-one-interaction).
      setFields((f) => [...f, row]);
      return row;
    },
    [methodology, fields]
  );

  // Shared guard for the inline field mutations: own methodology only, and the
  // seeded legacy WPM fields stay untouchable (same backstop as useMethodologyEditor).
  const requireEditableField = useCallback(
    (id: string): MethodologyField => {
      if (!methodology || methodology.is_system || methodology.user_id == null) {
        throw new Error("methodology is read-only");
      }
      const target = fields.find((f) => f.id === id);
      if (!target) throw new Error("field not found");
      if (isLockedLegacyField(target, fields)) throw new Error("legacy field is locked");
      return target;
    },
    [methodology, fields]
  );

  const updateField = useCallback(
    async (id: string, patch: { label?: string; options?: string[] | null }): Promise<MethodologyField> => {
      requireEditableField(id);
      const { data, error: err } = await supabase
        .from("methodology_fields")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (err) throw err;
      const row = data as MethodologyField;
      setFields((fs) => fs.map((f) => (f.id === id ? row : f)));
      return row;
    },
    [requireEditableField]
  );

  const deleteField = useCallback(
    async (id: string): Promise<void> => {
      requireEditableField(id);
      const { error: err } = await supabase.from("methodology_fields").delete().eq("id", id);
      if (err) throw err;
      setFields((fs) => fs.filter((f) => f.id !== id));
    },
    [requireEditableField]
  );

  const renameFieldOption = useCallback(
    async (fieldId: string, oldValue: string, newValue: string): Promise<{ migrated: number }> => {
      const target = requireEditableField(fieldId);
      const next = newValue.trim();
      if (target.field_type !== "enum" || !target.options?.includes(oldValue)) {
        throw new Error("option not found");
      }
      if (!next || next === oldValue) return { migrated: 0 };
      // Renaming onto another existing option would merge two buckets — refuse
      // (a case-only change of the same option is fine).
      const collides = target.options.some(
        (o) => o !== oldValue && o.toLowerCase() === next.toLowerCase()
      );
      if (collides) throw new Error("option already exists");

      // One atomic RPC (M5 / migration 0045): option list + sibling show_when
      // conditions + every affected trade's custom bag move together server-side —
      // a mid-flight network failure can no longer leave a half-migrated journal.
      const { data, error: rpcErr } = await supabase.rpc("rename_field_option", {
        p_field_id: fieldId,
        p_old_value: oldValue,
        p_new_value: next,
      });
      if (rpcErr) throw rpcErr;
      const migrated = (data as number | null) ?? 0;

      // Mirror the server's rewrite in shared local state (the RPC returns only
      // the migrated-trade count).
      const options = target.options.map((o) => (o === oldValue ? next : o));
      const siblings = fields.filter(
        (f) => f.show_when_field_id === fieldId && f.show_when_values?.includes(oldValue)
      );

      // Any mounted trades view (Journal list/Analyse) holds pre-migration rows in
      // memory — tell useTrades to refetch so buckets rename immediately, not on
      // the next navigation. Window event: useMethodology has no TradesApi handle.
      if (migrated > 0) window.dispatchEvent(new CustomEvent(TRADES_MIGRATED_EVENT));

      // Shared local state, so every open view re-renders with the new name.
      setFields((fs) =>
        fs.map((f) => {
          if (f.id === fieldId) return { ...f, options };
          if (siblings.some((s) => s.id === f.id)) {
            return {
              ...f,
              show_when_values: (f.show_when_values ?? []).map((v) => (v === oldValue ? next : v)),
            };
          }
          return f;
        })
      );
      return { migrated };
    },
    [requireEditableField, fields]
  );

  return {
    methodology,
    fields,
    faseNames,
    isLegacyMethodology,
    isForexJournal,
    isOwnMethodology,
    instruments,
    addInstrument,
    removeInstrument,
    addField,
    updateField,
    deleteField,
    renameFieldOption,
    loading,
    error,
    refresh,
  };
}

/** Fired after a rename migration rewrote trades server-side; useTrades listens and refetches. */
export const TRADES_MIGRATED_EVENT = "beyen:trades-migrated";

const MethodologyContext = createContext<MethodologyData | null>(null);

/**
 * Single shared methodology state for the signed-in app (wraps AppShell in the
 * router). Before this, every consumer ran its own copy of the hook — ten
 * parallel fetches that could desync after an inline mutation. Mount once;
 * consumers keep the exact same `useMethodology()` API as before.
 */
export function MethodologyProvider({ children }: { children: ReactNode }) {
  const value = useMethodologyState();
  return <MethodologyContext.Provider value={value}>{children}</MethodologyContext.Provider>;
}

export function useMethodology(): MethodologyData {
  const ctx = useContext(MethodologyContext);
  if (!ctx) throw new Error("useMethodology must be used within MethodologyProvider");
  return ctx;
}
