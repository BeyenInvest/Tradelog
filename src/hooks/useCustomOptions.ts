import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toErrorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import type { CustomOption } from "@/lib/types";

/** Per-user extra values for a fixed-list form field (e.g. field="entry"), merged client-side on top of the shared constant list. */
export function useCustomOptions(field: string) {
  const { session } = useAuth();
  const userId = session!.user.id;
  const [options, setOptions] = useState<CustomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Guard against a slow response for a previous `field` landing after a newer
  // request and overwriting its options (M3 — same pattern as useTrades).
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("custom_options")
      .select("*")
      .eq("user_id", userId)
      .eq("field", field)
      .order("created_at", { ascending: true });
    if (requestId !== requestIdRef.current) return; // superseded by a newer request
    if (err) setError(toErrorMessage(err));
    else setOptions(data as CustomOption[]);
    setLoading(false);
  }, [userId, field]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function addOption(value: string): Promise<CustomOption> {
    const { data, error: err } = await supabase.from("custom_options").insert({ field, value }).select().single();
    if (err) throw err;
    const created = data as CustomOption;
    setOptions((prev) => [...prev, created]);
    return created;
  }

  async function deleteOption(id: string): Promise<void> {
    const { error: err } = await supabase.from("custom_options").delete().eq("id", id);
    if (err) throw err;
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }

  return { options, loading, error, addOption, deleteOption };
}
