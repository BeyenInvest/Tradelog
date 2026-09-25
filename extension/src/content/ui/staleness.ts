// D1 (deep review 2026-09-17): de staleness-guard van submit(). Het paneel kan
// minutenlang openstaan terwijl de user van symbool wisselt of de position-tool
// versleept — de enige route naar stil verkeerde data. Vlak vóór het loggen
// haalt submit() een verse chart-state op en vergelijkt die hier met wat het
// paneel toont: symbool, de geselecteerde position-tool (id) en z'n prijzen.
// Pure functie — geen DOM, geen chrome — zodat de vergelijking testbaar is.
import type { ChartState, PositionState } from "../../adapter/parse";

/** Welke tool het paneel als "de geselecteerde" ziet: expliciete keuze, anders
 * de eerste — exact de fallback van selectedPosition() in panelApp. */
function pickPosition(state: ChartState, selectedId: string | null): PositionState | null {
  if (!state.positions.ok) return null;
  const list = state.positions.value;
  return list.find((p) => p.id === selectedId) ?? list[0] ?? null;
}

/**
 * true = de chart is intussen veranderd en de log mag NIET doorgaan; het paneel
 * toont dan de verse staat + één waarschuwingsregel. Filosofie: alleen blokkeren
 * op een aantoonbaar verschil in wat er de DB in zou gaan (symbool, tool,
 * prijzen) — een verse lezing die iets níét kan lezen wat eerst wél leesbaar
 * was telt ook (we kunnen dan niet bevestigen dat de data nog klopt).
 */
export function chartStateStale(
  shown: ChartState | null,
  fresh: ChartState,
  selectedId: string | null
): boolean {
  if (!shown) return false; // zonder getoonde staat valt er niets te verouderen

  // Symbool: de payload draagt shown.symbol — elk verschil is direct fout.
  if (shown.symbol.ok) {
    if (!fresh.symbol.ok || fresh.symbol.value !== shown.symbol.value) return true;
  }

  // Position-tool: alleen relevant als het paneel er één toont (zonder tool is
  // alles handmatige invoer en valt er tool-kant niets te verouderen).
  const shownPos = pickPosition(shown, selectedId);
  if (!shownPos) return false;
  if (!fresh.positions.ok) return true; // eerst leesbaar, nu niet → niet te bevestigen
  const freshPos = fresh.positions.value.find((p) => p.id === shownPos.id);
  if (!freshPos) return true; // tool is weg of vervangen
  // entryTimeSec/endTimeSec tellen mee: horizontaal verslepen verandert de
  // entry-tijd en de sluitdatum-prefill — dat gaat óók de DB in.
  return (
    freshPos.direction !== shownPos.direction ||
    freshPos.entry !== shownPos.entry ||
    freshPos.stopLevelTicks !== shownPos.stopLevelTicks ||
    freshPos.profitLevelTicks !== shownPos.profitLevelTicks ||
    freshPos.entryTimeSec !== shownPos.entryTimeSec ||
    freshPos.endTimeSec !== shownPos.endTimeSec
  );
}
