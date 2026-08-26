import { useCallback, useEffect, useState } from "react";
import {
  applyOrder,
  moveId,
  readLayout,
  toggleId,
  writeLayout,
  EMPTY_LAYOUT,
  type AnalyseLayout,
} from "@/lib/analyseLayout";

/**
 * React wrapper around the per-user Analyse layout (order + collapsed sections).
 * Reads the saved layout for `userId` and persists every change back. `visibleIds`
 * is the current context's default-ordered section ids (some sections are
 * conditional), so ordering/reordering always operates on exactly what's on screen.
 */
export function useAnalyseLayout(userId: string | null) {
  const [layout, setLayout] = useState<AnalyseLayout>(() => readLayout(userId));

  // Re-read when the signed-in user changes (two accounts, same browser).
  useEffect(() => {
    setLayout(readLayout(userId));
  }, [userId]);

  const persist = useCallback(
    (next: AnalyseLayout) => {
      setLayout(next);
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

  const toggleCollapse = useCallback((id: string) => persist({ ...layout, collapsed: toggleId(layout.collapsed, id) }), [layout, persist]);
  const isCollapsed = useCallback((id: string) => layout.collapsed.includes(id), [layout.collapsed]);
  const reset = useCallback(() => persist(EMPTY_LAYOUT), [persist]);
  const isCustomized = layout.order.length > 0 || layout.collapsed.length > 0;

  return { orderedIds, move, toggleCollapse, isCollapsed, reset, isCustomized };
}
