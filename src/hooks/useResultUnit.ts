import { useResultDisplay } from "@/hooks/useResultDisplay";
import type { ResultUnit } from "@/lib/constants";

/**
 * Effectieve resultaat-eenheid voor de weergavelaag (Fase J) — verkorte vorm van
 * useResultDisplay().unit voor plekken die geen saldo nodig hebben (%/R-suffix e.d.).
 * Beta-gate en de currency-zonder-saldo-terugval zitten in ResultDisplayProvider.
 */
export function useResultUnit(): ResultUnit {
  return useResultDisplay().unit;
}
