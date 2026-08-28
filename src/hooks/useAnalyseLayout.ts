import { useCallback, useEffect, useState } from "react";
import {
  applyOrder,
  moveId,
  readLayout,
  toggleId,
  writeLayout,
  hasStoredLayout,
  clearLayout,
  EMPTY_LAYOUT,
  type AnalyseLayout,
} from "@/lib/analyseLayout";

/**
 * React wrapper around the per-user Analyse layout (order + collapsed sections).
 * Reads the saved layout for `userId` and persists every change back. `visibleIds`
 * is the current context's default-ordered section ids (some sections are
 * conditional), so ordering/reordering always operates on exactly what's on screen.
 *
 * `defaultOpenIds` are the sections that stay open on a genuine first visit; every
 * other section starts collapsed until the user has saved a layout (BINDEND rule:
 * a new analysis section lands default-collapsed — it never expands the page for
 * everyone). Once the user interacts, their explicit collapsed set is authoritative.
 */
export function useAnalyseLayout(userId: string | null, defaultOpenIds: string[] = []) {
  const [layout, setLayout] = useState<AnalyseLayout>(() => readLayout(userId));
  // Pristine = the user has never saved a layout → apply the default-collapsed view.
  const [pristine, setPristine] = useState<boolean>(() => !hasStoredLayout(userId));

  // Re-read when the signed-in user changes (two accounts, same browser).
  useEffect(() => {
    setLayout(readLayout(userId));
    setPristine(!hasStoredLayout(userId));
  }, [userId]);

  const persist = useCallback(
    (next: AnalyseLayout) => {
      setLayout(next);
      setPristine(false);
      writeLayout(userId, next);
    },
    [userId]
  );

  const orderedIds = useCallback((visibleIds: string[]) => applyOrder(visibleIds, layout.order), [layout.order]);

  const move = useCallback(
    (visibleIds: string[], fromId: string, toId: string) =>
      persist({ ...layout, order: moveId(applyOrder(visibleIds, layout.order), fromId, toId) }),
    [layout, persist]
  );

  // On the first interaction from a pristine layout, materialise the currently-shown
  // collapsed set (everything except the default-open sections) before toggling, so
  // expanding one default-collapsed section doesn't accidentally collapse the rest.
  const toggleCollapse = useCallback(
    (id: string, visibleIds: string[]) => {
      const base = pristine ? visibleIds.filter((x) => !defaultOpenIds.includes(x)) : layout.collapsed;
      persist({ ...layout, collapsed: toggleId(base, id) });
    },
    [layout, persist, pristine, defaultOpenIds]
  );

  const isCollapsed = useCallback(
    (id: string) => (pristine ? !defaultOpenIds.includes(id) : layout.collapsed.includes(id)),
    [pristine, defaultOpenIds, layout.collapsed]
  );

  const reset = useCallback(() => {
    clearLayout(userId);
    setLayout(EMPTY_LAYOUT);
    setPristine(true);
  }, [userId]);

  // A pristine layout is the default, not a customization — the reset affordance
  // only makes sense once the user has actually changed something.
  const isCustomized = !pristine;

  return { orderedIds, move, toggleCollapse, isCollapsed, reset, isCustomized };
}
