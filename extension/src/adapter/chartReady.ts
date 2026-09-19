// Chart-readiness voor de snapshot-cyclus (F3a-fix): na een timeframe-switch
// pollen tot TV de nieuwe candles echt geladen heeft, i.p.v. een blinde vaste
// timer. De Daily-capture pakte anders een nog-ladende chart zodra de fetch
// langer duurde dan de oude 1,5 s.
//
// Gelaagd en defensief (zelfde degradatie-filosofie als parse.ts):
//   1. `resolution() === target` — de switch is echt toegepast;
//   2. `dataReady()` (charting-library-API, op de website geprobed) — het
//      officiële "series-data geladen"-signaal;
//   3. zonder `dataReady`: de laatste bar bestaat én is stabiel over twee
//      opeenvolgende polls (S1-bewezen leespad, zie readState in tvMain);
//   4. alles onleesbaar (TV-drift) → na BLIND_FALLBACK_MS gewoon door — dat is
//      exact het oude gedrag als vloer, nooit slechter.
// De cap (READY_TIMEOUT_MS) houdt de cyclus vlot: klaar = meteen door (meestal
// sneller dan de oude vaste timer), nooit langer dan ~5 s per slot wachten.

export const READY_POLL_MS = 150;
export const READY_TIMEOUT_MS = 5000;
export const BLIND_FALLBACK_MS = 1500; // oude vaste wachttijd, alleen nog als de adapter blind is
/** Korte adem ná ready (alleen als er echt gewacht is) zodat trage studies
 * ("… loading") hun tekst kwijt zijn vóór de capture. */
export const GRACE_MS = 200;

/** Wat de laatste-bar-probe deze poll zag. */
export type BarProbe =
  | { kind: "bar"; time: number | null } // er ís een bar; time null = geen bruikbare tijd (dan geen stabiliteitscheck)
  | { kind: "empty" } // leespad werkt, maar de serie is (nog) leeg — typisch mid-switch
  | { kind: "unreadable" }; // leespad kapot/afwezig (TV-drift)

/** Synchrone lezers over de page-world-API — elke lezer geeft null/unreadable
 * terug bij drift i.p.v. te gooien (de impl zit in tvMain.ts). */
export interface ReadyProbe {
  resolution(): string | null;
  /** TV's dataReady(): true/false, of null als de methode ontbreekt/afwijkt. */
  dataReady(): boolean | null;
  lastBar(): BarProbe;
}

export type ReadySignal = "data-ready" | "bar-stable" | "blind-fallback" | "timeout";

export interface WaitReadyOutcome {
  /** false alleen bij timeout — de cyclus captured dan alsnog (gelogd). */
  ready: boolean;
  signal: ReadySignal;
  waitedMs: number;
  polls: number;
}

export interface WaitReadyOptions {
  timeoutMs?: number;
  pollMs?: number;
  blindMs?: number;
  /** Injecteerbaar voor tests (virtuele klok). */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export async function waitForChartReady(
  probe: ReadyProbe,
  target: string,
  opts: WaitReadyOptions = {},
): Promise<WaitReadyOutcome> {
  const timeoutMs = opts.timeoutMs ?? READY_TIMEOUT_MS;
  const pollMs = opts.pollMs ?? READY_POLL_MS;
  const blindMs = opts.blindMs ?? BLIND_FALLBACK_MS;
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const start = now();
  let prevBarTime: number | null = null;
  let polls = 0;

  for (;;) {
    polls += 1;
    const waited = now() - start;
    const res = probe.resolution();
    const dataReady = probe.dataReady();
    const bar = probe.lastBar();

    if (res === target) {
      // dataReady=true met een lége serie is nog mid-switch — de bar-check mag
      // alleen veto'en als hij ook echt leesbaar is.
      if (dataReady === true && bar.kind !== "empty") {
        return { ready: true, signal: "data-ready", waitedMs: waited, polls };
      }
      if (dataReady === null && bar.kind === "bar" && bar.time !== null) {
        if (prevBarTime !== null && bar.time === prevBarTime) {
          return { ready: true, signal: "bar-stable", waitedMs: waited, polls };
        }
        prevBarTime = bar.time;
      } else {
        prevBarTime = null;
      }
    } else {
      // Verkeerd (of onleesbaar) timeframe: eerdere bar-tijd zegt niets meer.
      prevBarTime = null;
    }

    // Volledig blind (alle drie de lezers kapot) → oude vaste wachttijd als vloer.
    if (res === null && dataReady === null && bar.kind === "unreadable" && waited >= blindMs) {
      return { ready: true, signal: "blind-fallback", waitedMs: waited, polls };
    }
    if (waited >= timeoutMs) {
      return { ready: false, signal: "timeout", waitedMs: waited, polls };
    }
    await sleep(pollMs);
  }
}
