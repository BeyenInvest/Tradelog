// Het log-paneel zelf (F2d): status → chart lezen → position-tool → doel →
// modus → dynamische form → "Log trade". Vanilla TS, geen framework.
//
// Twee regels die de opbouw verklaren:
//  1. Het paneel REKENT NIETS. Prijzen/R:R komen uit de adapter (F2a) en
//     priceMath (F2b); validatie en payload uit tradePayload/tradeFlow. Hier
//     staat alleen weergave, keuze en degradatie-copy.
//  2. Secties die van data veranderen worden herbouwd; alles waar de user in
//     typt (form-rijen, overrides) wordt op z'n plek bijgewerkt — een rebuild
//     zou focus en caret weggooien.
import type { Direction, Outcome } from "../../../../src/lib/constants";
import { plannedRR } from "../../../../src/lib/priceMath";
import type { WallClock } from "../../../../src/lib/tradePayload";
import type { ChartState, PositionState } from "../../adapter/parse";
import type { JournalField, JournalSchema } from "../../db";
import { sendToSw, type TargetsInfo } from "../../messages";
import type { LogTradeRequest } from "../../tradeFlow";
import { clear, el, on } from "./dom";
import { logTradeErrorCopy, type ErrorCopy } from "./errors";
import {
  customFromValues, formFields, missingRequired, skippedLegacyFields, type FormValues,
} from "./fields";
import { renderDynamicForm, type DynamicForm } from "./form";
import {
  formatBarTime, formatPrice, formatResolution, formatRR, newClientUuid, parseNumberInput,
} from "./format";
import { ICON_CHECK, ICON_CLOSE, ICON_EXTERNAL, ICON_PENCIL, ICON_REFRESH, markSvg } from "./icons";
import { renderSnapshotsSection } from "./snapshotsSection";

const JOURNAL_URL = "https://www.beyen.app/journal";
/** Per tab onthouden (sessionStorage = precies één tab, plan F2d). */
const TARGET_KEY = "beyen-tv-ext:target";

type Mode = "live" | "backtest";
type PriceKey = "entry" | "stop" | "target";

export interface PanelApp {
  element: HTMLElement;
  destroy(): void;
}

function note(text: string, variant: "" | "is-warn" | "is-gold" = ""): HTMLElement {
  return el("div", { class: `by-note ${variant}`.trim(), text });
}

function readFail(reason: string): HTMLElement {
  return el("p", { class: "by-error by-readfail", text: `⚠ ${reason}` });
}

function sectionEl(title: string, extra?: HTMLElement): { section: HTMLElement; body: HTMLElement } {
  const head = el("div", { class: "by-sec-head" }, [
    el("h3", { class: "by-sec-title", text: title }),
    el("span", { class: "by-spacer" }),
    extra,
  ]);
  const body = el("div");
  return { section: el("section", { class: "by-sec" }, [head, body]), body };
}

export function mountPanelApp(host: HTMLElement, options: { onClose: () => void }): PanelApp {
  // ── Data ────────────────────────────────────────────────────────────────
  let chart: ChartState | null = null;
  let chartError: string | null = null;
  let chartLoading = false;
  let journal: JournalSchema | null = null;
  let journalNote: string | null = null;
  let targets: TargetsInfo | null = null;

  // ── Keuzes van de user ──────────────────────────────────────────────────
  let selectedPositionId: string | null = null;
  let overrides: Partial<Record<PriceKey, number | null>> & { direction?: Direction | null } = {};
  let targetKey = storedTarget();
  let mode: Mode = "live";
  let outcome: Outcome | null = null;
  let resultPct = "";
  let riskPct = "";
  let notes = "";
  let manualDate = "";
  let manualTime = "";
  let values: FormValues = {};
  /** Eén keer per formulier-sessie; blijft gelijk bij een retry (idempotentie). */
  let clientUuid = newClientUuid();

  let form: DynamicForm | null = null;
  let formFieldList: JournalField[] = [];

  // ── Skelet ──────────────────────────────────────────────────────────────
  const closeBtn = el("button", {
    class: "by-icon",
    unsafeHtml: ICON_CLOSE,
    attrs: { type: "button", title: "Paneel sluiten", "aria-label": "Paneel sluiten" },
  });
  on(closeBtn, "click", () => options.onClose());

  const head = el("div", { class: "by-head" }, [
    el("span", { class: "by-mark", unsafeHtml: markSvg(18) }),
    el("span", { class: "by-title", text: "Beyen" }),
    el("span", { class: "by-badge", text: "beta" }),
    el("span", { class: "by-spacer" }),
    closeBtn,
  ]);
  const body = el("div", { class: "by-body" });
  const foot = el("div", { class: "by-foot" });
  const panel = el("div", { class: "by-panel by-card", attrs: { role: "dialog", "aria-label": "Beyen — trade loggen" } }, [
    head, body, foot,
  ]);
  host.appendChild(panel);

  // ── Hulpjes ─────────────────────────────────────────────────────────────
  function storedTarget(): string {
    try {
      return sessionStorage.getItem(TARGET_KEY) ?? "live";
    } catch {
      return "live"; // sessionStorage kan geblokkeerd zijn; geen reden om te falen
    }
  }
  function storeTarget(value: string): void {
    try {
      sessionStorage.setItem(TARGET_KEY, value);
    } catch {
      /* stil: de keuze blijft dan alleen in dit paneel gelden */
    }
  }

  function positions(): PositionState[] {
    return chart?.positions.ok ? chart.positions.value : [];
  }
  function selectedPosition(): PositionState | null {
    const list = positions();
    return list.find((p) => p.id === selectedPositionId) ?? list[0] ?? null;
  }
  function chartPrice(key: PriceKey): number | null {
    const prices = selectedPosition()?.prices;
    if (!prices) return null;
    return key === "target" ? prices.target : prices[key];
  }
  function effPrice(key: PriceKey): number | null {
    const override = overrides[key];
    return override != null ? override : chartPrice(key);
  }
  function effDirection(): Direction | null {
    return overrides.direction ?? selectedPosition()?.direction ?? null;
  }
  function effRR(): number | null {
    const entry = effPrice("entry");
    const stop = effPrice("stop");
    const target = effPrice("target");
    if (entry == null || stop == null || target == null) return null;
    return plannedRR(entry, stop, target);
  }
  function needsManualTime(): boolean {
    const position = selectedPosition();
    return !position || position.entryTimeSec == null;
  }

  // ── Volledige staten (loading / niet gekoppeld / succes) ────────────────
  function showState(node: HTMLElement): void {
    clear(body);
    clear(foot);
    foot.hidden = true;
    body.appendChild(node);
  }

  function simpleState(title: string, text: string, action?: HTMLElement): HTMLElement {
    return el("div", { class: "by-state" }, [
      el("div", { class: "by-state-icon", unsafeHtml: markSvg(20) }),
      el("p", { class: "by-state-title", text: title }),
      el("p", { class: "by-state-text", text }),
      action,
    ]);
  }

  function notLinkedState(): HTMLElement {
    const retry = el("button", { class: "by-btn by-btn-ghost", text: "Opnieuw controleren", attrs: { type: "button" } });
    on(retry, "click", () => void boot());
    return simpleState(
      "Nog niet gekoppeld",
      "Open de extensie-popup (het Beyen-icoon in je Chrome-werkbalk) en plak daar de koppelcode uit Beyen → Instellingen. Daarna log je vanaf deze chart rechtstreeks in je journal.",
      retry
    );
  }

  function reloadState(): HTMLElement {
    return simpleState(
      "Extensie herladen",
      "De achtergrond van de extensie is opnieuw gestart. Ververs deze TradingView-pagina om het paneel weer te verbinden."
    );
  }

  // ── Secties ─────────────────────────────────────────────────────────────
  const refreshBtn = el("button", {
    class: "by-btn by-btn-ghost by-btn-sm",
    attrs: { type: "button", title: "Chart opnieuw lezen" },
  });
  refreshBtn.appendChild(el("span", { unsafeHtml: ICON_REFRESH }));
  refreshBtn.appendChild(el("span", { text: "Ververs chart" }));
  on(refreshBtn, "click", () => void refreshChart());

  const chartSec = sectionEl("Chart", refreshBtn);
  const positionSec = sectionEl("Position-tool");
  const targetSec = sectionEl("Doel");
  const modeSec = sectionEl("Modus");
  const journalSec = sectionEl("Journal-velden");
  const extraSec = sectionEl("Extra");
  const snapshotsSec = renderSnapshotsSection();

  const submitBtn = el("button", { class: "by-btn by-btn-block", text: "Log trade", attrs: { type: "button" } });
  on(submitBtn, "click", () => void submit());
  const errorBox = el("div", { class: "by-note is-warn" });
  errorBox.hidden = true;
  const pendingLine = el("p", { class: "by-hint", style: "margin:8px 0 0;" });

  function buildForm(): void {
    clear(body);
    clear(foot);
    foot.hidden = false;

    body.appendChild(chartSec.section);
    body.appendChild(positionSec.section);
    body.appendChild(targetSec.section);
    body.appendChild(modeSec.section);
    body.appendChild(journalSec.section);
    body.appendChild(extraSec.section);
    body.appendChild(snapshotsSec.element);

    foot.appendChild(errorBox);
    foot.appendChild(submitBtn);
    foot.appendChild(pendingLine);

    renderChart();
    renderPosition();
    renderTarget();
    renderMode();
    renderJournalFields();
    renderExtra();
    showError(null);
    updatePending();
  }

  function renderChart(): void {
    clear(chartSec.body);
    refreshBtn.disabled = chartLoading;
    if (chartLoading) {
      chartSec.body.appendChild(el("p", { class: "by-muted", text: "Chart lezen…" }));
      return;
    }
    if (chartError) {
      chartSec.body.appendChild(note(chartError, "is-warn"));
      return;
    }
    if (!chart) return;

    const line = el("div", { class: "by-row" }, [
      el("span", {
        class: chart.symbol.ok ? "by-symbol" : "by-symbol by-faint",
        text: chart.symbol.ok ? chart.symbol.value : "—",
      }),
      chart.resolution.ok ? el("span", { class: "by-tf", text: formatResolution(chart.resolution.value) }) : null,
    ]);
    chartSec.body.appendChild(line);

    for (const reading of [chart.symbol, chart.resolution, chart.tick]) {
      if (!reading.ok) chartSec.body.appendChild(readFail(reading.reason));
    }
  }

  function renderPosition(): void {
    clear(positionSec.body);
    if (!chart || chartLoading) return;

    if (!chart.positions.ok) {
      positionSec.body.appendChild(readFail(chart.positions.reason));
      return;
    }

    const list = positions();
    if (list.length === 0) {
      positionSec.body.appendChild(
        note("Teken een long- of short-position-tool op de chart en ververs — dan vult Beyen richting, entry, stop, target en R:R vanzelf in.")
      );
      renderManualTime();
      return;
    }
    if (!list.some((p) => p.id === selectedPositionId)) selectedPositionId = list[0]?.id ?? null;

    if (list.length > 1) {
      const select = el("select", { class: "by-select", attrs: { "aria-label": "Kies de position-tool" } });
      for (const position of list) {
        select.appendChild(
          el("option", {
            text: `${position.direction} · entry ${formatPrice(position.prices?.entry ?? position.entry)}`,
            attrs: { value: position.id },
          })
        );
      }
      select.value = selectedPositionId ?? "";
      on(select, "change", () => {
        selectedPositionId = select.value;
        overrides = {}; // overrides horen bij één tool, niet bij de volgende
        renderPosition();
        updatePending();
      });
      positionSec.body.appendChild(
        el("div", { style: "margin-bottom:8px;" }, [
          el("p", { class: "by-hint", style: "margin:0 0 5px;", text: `${list.length} position-tools op deze chart — kies er één.` }),
          select,
        ])
      );
    }

    const updaters: (() => void)[] = [];
    const refreshRows = () => {
      for (const update of updaters) update();
      updatePending();
    };

    const addMetric = (
      label: string,
      read: () => { text: string; cls?: string; src: string; manual: boolean },
      editor?: (register: (paint: () => void) => void) => HTMLElement
    ) => {
      const value = el("span", { class: "by-metric-value" });
      const src = el("span", { class: "by-src" });
      const row = el("div", { class: "by-metric" }, [
        el("span", { class: "by-metric-label", text: label }),
        value,
        src,
      ]);
      let editWrap: HTMLElement | null = null;
      if (editor) {
        editWrap = el("div", { class: "by-metric-edit" });
        editWrap.hidden = true;
        editWrap.appendChild(editor((paint) => updaters.push(paint)));
        const pencil = el("button", {
          class: "by-icon",
          unsafeHtml: ICON_PENCIL,
          attrs: { type: "button", title: `${label} handmatig invullen`, "aria-label": `${label} handmatig invullen` },
        });
        on(pencil, "click", () => {
          const wrap = editWrap;
          if (!wrap) return;
          wrap.hidden = !wrap.hidden;
          if (!wrap.hidden) wrap.querySelector<HTMLElement>("input, button, select")?.focus();
        });
        row.appendChild(pencil);
      }
      const update = () => {
        const data = read();
        value.textContent = data.text;
        value.className = `by-metric-value${data.cls ? ` ${data.cls}` : ""}`;
        src.textContent = data.src;
        src.classList.toggle("is-manual", data.manual);
      };
      updaters.push(update);
      update();
      positionSec.body.appendChild(row);
      if (editWrap) positionSec.body.appendChild(editWrap);
    };

    addMetric(
      "Richting",
      () => {
        const direction = effDirection();
        return {
          text: direction ?? "—",
          cls: direction === "Long" ? "by-win" : direction === "Short" ? "by-loss" : "by-faint",
          src: overrides.direction ? "handmatig" : "via TradingView",
          manual: !!overrides.direction,
        };
      },
      (register) => {
        const wrap = el("div", { class: "by-toggle" });
        const buttons: HTMLButtonElement[] = [];
        for (const direction of ["Long", "Short"] as const) {
          const btn = el("button", { class: "by-toggle-btn", text: direction, attrs: { type: "button" } });
          on(btn, "click", () => {
            overrides.direction = overrides.direction === direction ? null : direction;
            refreshRows();
          });
          buttons.push(btn);
          wrap.appendChild(btn);
        }
        const paint = () => {
          for (const btn of buttons) btn.classList.toggle("is-active", btn.textContent === effDirection());
        };
        register(paint);
        paint();
        return wrap;
      }
    );

    const priceRow = (label: string, key: PriceKey) =>
      addMetric(
        label,
        () => ({
          text: formatPrice(effPrice(key)),
          cls: "by-mono",
          src: overrides[key] != null ? "handmatig" : "via TradingView",
          manual: overrides[key] != null,
        }),
        () => {
          const input = el("input", {
            class: "by-input",
            attrs: { type: "number", step: "any", inputmode: "decimal", placeholder: `${label} handmatig` },
          });
          const current = overrides[key];
          if (current != null) input.value = String(current);
          on(input, "input", () => {
            overrides[key] = parseNumberInput(input.value);
            refreshRows();
          });
          return input;
        }
      );

    priceRow("Entry", "entry");
    priceRow("Stop", "stop");
    priceRow("Target", "target");

    addMetric("R:R", () => ({
      text: formatRR(effRR()),
      cls: "by-mono",
      src: "berekend",
      manual: false,
    }));

    const position = selectedPosition();
    if (position?.entryTimeSec != null) {
      addMetric("Tijd", () => ({
        text: formatBarTime(position.entryTimeSec),
        cls: "by-mono",
        src: "via TradingView",
        manual: false,
      }));
    }
    if (position && !position.prices) {
      positionSec.body.appendChild(
        readFail("Prijzen niet berekenbaar (tick-size onbekend) — vul entry en stop handmatig in.")
      );
    }
    renderManualTime();
  }

  function renderManualTime(): void {
    if (!needsManualTime()) return;
    const dateInput = el("input", { class: "by-input", attrs: { type: "date" } });
    dateInput.value = manualDate;
    on(dateInput, "input", () => {
      manualDate = dateInput.value;
      updatePending();
    });
    const timeInput = el("input", { class: "by-input", attrs: { type: "time" } });
    timeInput.value = manualTime;
    on(timeInput, "input", () => {
      manualTime = timeInput.value;
      updatePending();
    });

    positionSec.body.appendChild(
      el("div", { style: "margin-top:10px;" }, [
        el("span", { class: "by-label" }, [
          document.createTextNode("Datum en tijd van de entry"),
          el("span", { class: "by-req", text: " *" }),
        ]),
        el("div", { class: "by-row" }, [dateInput, timeInput]),
        el("p", {
          class: "by-hint",
          style: "margin:5px 0 0;",
          text: "De chart geeft hier geen bar-tijd — vul 'm zelf in (in je eigen tijdzone uit Beyen).",
        }),
      ])
    );
  }

  function renderTarget(): void {
    clear(targetSec.body);
    const select = el("select", { class: "by-select", attrs: { "aria-label": "Waar komt deze trade terecht" } });
    select.appendChild(el("option", { text: "Journal (live)", attrs: { value: "live" } }));
    for (const project of targets?.projects ?? []) {
      select.appendChild(el("option", { text: `Backtest: ${project.naam}`, attrs: { value: `project:${project.id}` } }));
    }
    const known = Array.from(select.options).some((o) => o.value === targetKey);
    if (!known) targetKey = "live";
    select.value = targetKey;
    on(select, "change", () => {
      targetKey = select.value;
      storeTarget(targetKey);
      // Een backtest-project zonder resultaat is zelden de bedoeling; de modus
      // volgt het doel, maar blijft daarna gewoon omschakelbaar.
      mode = targetKey === "live" ? "live" : "backtest";
      renderMode();
      updatePending();
    });
    targetSec.body.appendChild(select);

    const activeName =
      targets?.journals.find((j) => j.id === targets?.activeJournalId)?.naam ?? journal?.naam ?? null;
    if (activeName) {
      targetSec.body.appendChild(
        el("p", { class: "by-hint", style: "margin:6px 0 0;", text: `Actief journal: ${activeName}` })
      );
    }
    if (!targets) {
      targetSec.body.appendChild(
        el("p", { class: "by-hint", style: "margin:6px 0 0;", text: "Backtest-projecten konden niet geladen worden." })
      );
    }
  }

  const modeExtra = el("div", { style: "margin-top:10px;" });

  function renderMode(): void {
    clear(modeSec.body);
    clear(modeExtra);

    const seg = el("div", { class: "by-seg", attrs: { role: "group", "aria-label": "Modus" } });
    for (const [key, label] of [["live", "Live (open trade)"], ["backtest", "Backtest (met resultaat)"]] as const) {
      const btn = el("button", { class: "by-seg-btn", text: label, attrs: { type: "button" } });
      btn.classList.toggle("is-active", mode === key);
      on(btn, "click", () => {
        mode = key;
        renderMode();
        updatePending();
      });
      seg.appendChild(btn);
    }
    modeSec.body.appendChild(seg);
    modeSec.body.appendChild(modeExtra);

    if (mode === "live") {
      modeExtra.appendChild(
        el("p", { class: "by-hint", style: "margin:0;", text: "De trade komt als lopend in je journal; het resultaat vul je later in Beyen aan." })
      );
      return;
    }

    const outcomes = el("div", { class: "by-outcomes" });
    for (const value of ["Win", "Loss", "BE"] as const) {
      const btn = el("button", {
        class: "by-oc",
        text: value,
        attrs: { type: "button", "data-outcome": value },
      });
      btn.classList.toggle("is-active", outcome === value);
      on(btn, "click", () => {
        outcome = value;
        renderMode();
        updatePending();
      });
      outcomes.appendChild(btn);
    }

    const resultInput = el("input", {
      class: "by-input",
      attrs: { type: "number", step: "any", inputmode: "decimal", placeholder: "bv. 1.8 of -0.5" },
    });
    resultInput.value = resultPct;
    on(resultInput, "input", () => {
      resultPct = resultInput.value;
      updatePending();
    });

    modeExtra.appendChild(outcomes);
    modeExtra.appendChild(
      el("div", { style: "margin-top:8px;" }, [
        el("span", { class: "by-label" }, [
          document.createTextNode("Resultaat %"),
          el("span", { class: "by-req", text: " *" }),
        ]),
        resultInput,
      ])
    );
  }

  function renderJournalFields(): void {
    clear(journalSec.body);
    form = null;

    if (journalNote) journalSec.body.appendChild(note(journalNote, "is-gold"));
    if (!journal) return;

    formFieldList = formFields(journal.fields);
    if (formFieldList.length > 0) {
      form = renderDynamicForm({
        allFields: journal.fields,
        fields: formFieldList,
        values,
        onChange: () => {
          form?.sync();
          updatePending();
        },
      });
      journalSec.body.appendChild(form.element);
    } else if (!journalNote) {
      journalSec.body.appendChild(
        el("p", { class: "by-hint", style: "margin:0;", text: "Dit journal heeft geen eigen velden." })
      );
    }

    const skipped = skippedLegacyFields(journal.fields);
    if (skipped.length > 0) {
      journalSec.body.appendChild(
        el("p", {
          class: "by-hint",
          style: "margin:10px 0 0;",
          text: `De WPM-kenmerken (${skipped.map((f) => f.label).join(", ")}) vul je na het loggen in Beyen aan — die horen bij vaste kolommen, niet bij de custom velden.`,
        })
      );
    }
  }

  function renderExtra(): void {
    clear(extraSec.body);

    const risk = el("input", {
      class: "by-input",
      attrs: { type: "number", step: "any", inputmode: "decimal", placeholder: "standaard 1%" },
    });
    risk.value = riskPct;
    on(risk, "input", () => {
      riskPct = risk.value;
      updatePending();
    });

    const notesInput = el("textarea", { class: "by-input", attrs: { rows: "3", placeholder: "Wat zag je hier?" } });
    notesInput.value = notes;
    on(notesInput, "input", () => {
      notes = notesInput.value;
    });

    extraSec.body.appendChild(
      el("div", {}, [el("span", { class: "by-label", text: "Risico %" }), risk])
    );
    extraSec.body.appendChild(
      el("div", { style: "margin-top:8px;" }, [
        el("span", { class: "by-label", text: "Notities" }),
        notesInput,
      ])
    );
  }

  // ── Validatie + verzenden ───────────────────────────────────────────────
  type Built =
    | { ok: true; request: LogTradeRequest }
    | { ok: false; message: string; missingKeys?: string[] };

  function buildRequest(): Built {
    if (!chart || !chart.symbol.ok) {
      return { ok: false, message: "Zonder symbool kan er niets gelogd worden — ververs de chart." };
    }

    const position = selectedPosition();
    const direction = position ? effDirection() : null;
    const entry = position ? effPrice("entry") : null;
    const stop = position ? effPrice("stop") : null;
    const target = position ? effPrice("target") : null;
    if ((entry == null) !== (stop == null)) {
      return { ok: false, message: "Vul entry én stop in — met maar één van de twee valt er geen R te berekenen." };
    }
    const prices = entry != null && stop != null ? { entry, stop, target } : null;

    const entryTimeUtcSec = position?.entryTimeSec ?? null;
    let manualDateTime: WallClock | null = null;
    if (entryTimeUtcSec == null) {
      if (!manualDate || !manualTime) {
        return { ok: false, message: "Vul de datum en tijd van de entry in." };
      }
      manualDateTime = { date: manualDate, time: manualTime };
    }

    let tradeMode: LogTradeRequest["mode"] = { kind: "live-open" };
    if (mode === "backtest") {
      if (!outcome) return { ok: false, message: "Kies Win, Loss of BE." };
      const pct = parseNumberInput(resultPct);
      if (pct == null) return { ok: false, message: "Vul het resultaat in % in." };
      if (outcome === "Loss" && pct > 0) {
        return { ok: false, message: "Een Loss hoort een negatief resultaat te hebben." };
      }
      if (outcome === "Win" && pct < 0) {
        return { ok: false, message: "Een Win hoort een positief resultaat te hebben." };
      }
      tradeMode = { kind: "post-hoc", outcome, resultaatPct: pct };
    }

    const missing = journal ? missingRequired(formFieldList, journal.fields, values) : [];
    if (missing.length > 0) {
      return {
        ok: false,
        message: `Nog verplicht: ${missing.map((f) => f.label).join(", ")}.`,
        missingKeys: missing.map((f) => f.fieldKey),
      };
    }

    const risk = parseNumberInput(riskPct);
    if (riskPct.trim() && risk == null) return { ok: false, message: "Risico % is geen getal." };
    if (risk != null && risk <= 0) return { ok: false, message: "Risico % moet groter dan 0 zijn." };

    return {
      ok: true,
      request: {
        symbolRaw: chart.symbol.value,
        target: targetKey === "live" ? { type: "live" } : { type: "project", projectId: targetKey.slice("project:".length) },
        mode: tradeMode,
        direction,
        prices,
        entryTimeUtcSec,
        manualDateTime,
        riskPct: risk,
        custom: journal ? customFromValues(formFieldList, journal.fields, values) : {},
        notes: notes.trim() ? notes.trim() : null,
        clientUuid,
        screenshots: snapshotsSec.screenshots(),
      },
    };
  }

  function showError(copy: ErrorCopy | null): void {
    clear(errorBox);
    errorBox.hidden = !copy;
    if (!copy) return;
    errorBox.appendChild(el("span", { text: copy.message }));
    if (copy.detail) {
      errorBox.appendChild(el("span", { class: "by-mono by-hint", style: "display:block;margin-top:4px;", text: copy.detail }));
    }
  }

  function updatePending(): void {
    const built = buildRequest();
    pendingLine.textContent = built.ok ? "" : built.message;
    pendingLine.hidden = built.ok;
  }

  async function submit(): Promise<void> {
    const built = buildRequest();
    form?.markMissing(built.ok ? [] : built.missingKeys ?? []);
    if (!built.ok) {
      showError({ message: built.message });
      return;
    }
    showError(null);
    submitBtn.disabled = true;
    submitBtn.textContent = "Loggen…";
    try {
      const result = await sendToSw({ type: "log-trade", request: built.request });
      if (result.ok) {
        // Alleen bij een échte insert zitten de snapshots in een trade; bij een
        // duplicate is er niets weggeschreven, dus zijn onze uploads wezen.
        if (result.duplicate) snapshotsSec.reset();
        else snapshotsSec.consume();
        showSuccess(result.duplicate);
        return;
      }
      showError(logTradeErrorCopy(result));
    } catch {
      showError({ message: "De extensie is herladen — ververs deze TradingView-pagina en probeer opnieuw." });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log trade";
    }
  }

  function showSuccess(duplicate: boolean): void {
    const link = el("a", {
      class: "by-link",
      attrs: { href: JOURNAL_URL, target: "_blank", rel: "noopener noreferrer" },
    });
    link.appendChild(el("span", { text: "Open in Beyen" }));
    link.appendChild(el("span", { unsafeHtml: ICON_EXTERNAL }));

    const again = el("button", { class: "by-btn", text: "Nog één loggen", attrs: { type: "button" } });
    on(again, "click", () => {
      resetForm();
      buildForm();
      void refreshChart();
    });

    showState(
      el("div", { class: "by-state" }, [
        el("div", { class: "by-state-icon is-win", unsafeHtml: ICON_CHECK }),
        el("p", { class: "by-state-title", text: duplicate ? "Deze trade was al gelogd" : "Trade gelogd" }),
        el("p", {
          class: "by-state-text",
          text: duplicate
            ? "Dezelfde chart-trade stond al in je journal — er is niets dubbel aangemaakt."
            : "De trade staat in je Beyen-journal.",
        }),
        el("div", { class: "by-stack", style: "align-items:center;gap:12px;" }, [link, again]),
      ])
    );
  }

  function resetForm(): void {
    clientUuid = newClientUuid();
    values = {};
    overrides = {};
    outcome = null;
    resultPct = "";
    riskPct = "";
    notes = "";
    manualDate = "";
    manualTime = "";
    // Verse snapshot-staat; wat er nog niet in een trade zit, wordt hier
    // opgeruimd (na een geslaagde log is die lijst al leeg — zie submit()).
    snapshotsSec.reset();
    // Doel en modus blijven staan: wie vijf backtest-trades logt, wil die keuze
    // niet vijf keer opnieuw maken.
  }

  // ── Laden ───────────────────────────────────────────────────────────────
  async function refreshChart(): Promise<void> {
    chartLoading = true;
    chartError = null;
    renderChart();
    renderPosition();
    try {
      const result = await sendToSw({ type: "chart-state" });
      chart = result.ok ? result.state : null;
      chartError = result.ok ? null : result.error;
    } catch {
      chart = null;
      chartError = "De extensie is herladen — ververs deze TradingView-pagina.";
    }
    chartLoading = false;
    renderChart();
    renderPosition();
    updatePending();
  }

  async function boot(): Promise<void> {
    showState(simpleState("Verbinden…", "Even je Beyen-account controleren."));
    try {
      const status = await sendToSw({ type: "status" });
      if (!status.linked) {
        showState(notLinkedState());
        return;
      }
      const [dump, targetsResult] = await Promise.all([
        sendToSw({ type: "journal-dump" }),
        sendToSw({ type: "targets" }),
      ]);
      if (dump.ok) {
        journal = dump.journal;
        journalNote = journal ? null : "Je hebt nog geen actief journal in Beyen — de trade wordt zonder journal-velden gelogd.";
      } else {
        journal = null;
        journalNote = `Journal-velden konden niet geladen worden (${dump.error}) — loggen kan wel.`;
      }
      targets = targetsResult.ok ? targetsResult : null;
      buildForm();
      await refreshChart();
    } catch {
      showState(reloadState());
    }
  }

  void boot();

  return {
    element: panel,
    destroy() {
      // Sluiten met niet-gelogde snapshots = wezen in de bucket; die gaan mee weg.
      snapshotsSec.dispose();
      panel.remove();
    },
  };
}
