// D1 (deep review 2026-09-17): de staleness-guard van submit(). Het paneel kan
// minutenlang openstaan terwijl de user van symbool wisselt of de position-tool
// versleept — de enige route naar stil verkeerde data. Vlak vóór het loggen
// haalt submit() een verse chart-state op en vergelijkt die hier met wat het
// paneel toont: symbool, de geselecteerde position-tool (id) en z'n prijzen.
// Pure functie — geen DOM, geen chrome — zodat de vergelijking testbaar is.
import type { ChartState, PositionState } from "../../adapter/parse";

/**
 * Position-tools van nieuw naar oud: de tool het verst naar rechts op de chart
 * (laatste entry-bar) eerst; gelijke of ontbrekende tijd → later in TV's lijst
 * eerst. Backtesters laten oude tools bewust staan om later terug te kijken —
 * de trade die ze nú loggen is de laatste, niet de eerste (owner 2026-10-08).
 * Een tool zonder leesbare entry-tijd zakt achteraan.
 */
export function positionsNewestFirst(list: readonly PositionState[]): PositionState[] {
  return list
    .map((p, index) => ({ p, index }))
    .sort((a, b) => {
      const ta = a.p.entryTimeSec ?? -Infinity;
      const tb = b.p.entryTimeSec ?? -Infinity;
      return ta !== tb ? tb - ta : b.index - a.index;
    })
    .map(({ p }) => p);
}

/** Welke tool het paneel als "de geselecteerde" ziet: expliciete keuze, anders
 * de nieuwste — gedeeld met selectedPosition() in panelApp, zodat de
 * staleness-guard exact dezelfde tool vergelijkt als het paneel toont. */
export function pickPosition(list: readonly PositionState[], selectedId: string | null): PositionState | null {
  return list.find((p) => p.id === selectedId) ?? positionsNewestFirst(list)[0] ?? null;
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
  const shownPos = shown.positions.ok ? pickPosition(shown.positions.value, selectedId) : null;
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
