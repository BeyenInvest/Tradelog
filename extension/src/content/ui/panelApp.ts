// Het log-paneel zelf (F2d): status → chart lezen → position-tool → journal
// (doel + resultaat) → dynamische form → "Log trade". Vanilla TS, geen framework.
//
// Twee regels die de opbouw verklaren:
//  1. Het paneel REKENT NIETS. Prijzen/R:R komen uit de adapter (F2a) en
//     priceMath (F2b); validatie en payload uit tradePayload/tradeFlow. Hier
//     staat alleen weergave, keuze en degradatie-copy.
//  2. Secties die van data veranderen worden herbouwd; alles waar de user in
//     typt (form-rijen, overrides) wordt op z'n plek bijgewerkt — een rebuild
//     zou focus en caret weggooien.
//
// Copy loopt sinds F4b via i18nExt: de taal wordt één keer opgehaald vóór de
// eerste render (boot) en een wissel in de popup hertekent de huidige weergave
// (currentView). De ingevulde waarden leven in deze closure, niet in de DOM,
// dus zo'n hertekening kost geen invoer.
import type { Direction, Outcome } from "../../../../src/lib/constants";
import { plannedRR, suggestedResultPct } from "../../../../src/lib/priceMath";
// Bewust uit wallClock.ts en niet uit tradePayload.ts: die laatste sleept
// validation.ts + zod de content-script-bundel in (~140 KB extra).
import { wallClockInTimezone, type WallClock } from "../../../../src/lib/wallClock";
import type { ChartState, PositionState } from "../../adapter/parse";
import type { JournalField, JournalSchema } from "../../db";
import { ensureLang, onLangChange, t, type MessageKey } from "../../i18nExt";
import { sendToSw, type TargetsInfo } from "../../messages";
import type { SnapshotSlot } from "../../snapshots";
import type { LogTradeRequest } from "../../tradeFlow";
import { renderCloseSection } from "./closeSection";
import { mergeScreenshots } from "./closeState";
import { clear, el, on } from "./dom";
import { logTradeErrorCopy, type ErrorCopy } from "./errors";
import {
  ccFromTime, customFromValues, formFields, missingRequired, orderedFormFields, type FormValues,
} from "./fields";
import { renderDynamicForm, type DynamicForm } from "./form";
import {
  formatBarTime, formatPrice, formatResolution, formatRR, JOURNAL_URL, newClientUuid, parseNumberInput,
} from "./format";
import { ICON_CHECK, ICON_CLOSE, ICON_EXTERNAL, ICON_PENCIL, ICON_REFRESH, markSvg } from "./icons";
import { isOnboardingDismissed, renderOnboardingCard } from "./onboarding";
import { renderSnapshotsSection } from "./snapshotsSection";

/** Per tab onthouden (sessionStorage = precies één tab, plan F2d). */
const TARGET_KEY = "beyen-tv-ext:target";

/** Eén keuze voor "hoe staat deze trade ervoor": lopend, of afgelopen met een
 * uitkomst. Vervangt de oude modus-toggle + aparte outcome-keuze. */
type Result = "running" | Outcome;
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

interface Section {
  section: HTMLElement;
  body: HTMLElement;
  /** Kopje van de sectie; de tekst wordt bij elke (her)opbouw gezet, zodat een
   * taalwissel niet met stale koppen achterblijft. */
  title: HTMLElement;
  titleKey: MessageKey;
}

function sectionEl(titleKey: MessageKey, extra?: HTMLElement, headless = false): Section {
  const title = el("h3", { class: "by-sec-title" });
  const head = el("div", { class: "by-sec-head" }, [title, el("span", { class: "by-spacer" }), extra]);
  const body = el("div");
  // Kop-loze sectie (owner 2026-09-19: geen "EXTRA"-tussenkop meer): de head
  // wordt niet aangehangen; `title` blijft een losse node zodat de titel-paint
  // (die over alle secties loopt) er stil overheen kan.
  const section = el("section", { class: "by-sec" }, headless ? [body] : [head, body]);
  return { section, body, title, titleKey };
}

export function mountPanelApp(host: HTMLElement, options: { onClose: () => void }): PanelApp {
  // ── Data ────────────────────────────────────────────────────────────────
  let chart: ChartState | null = null;
  // Meldingen bewaren we als sleutel + gegevens, niet als afgewerkte zin: een
  // taalwissel hertekent dan ook een fout die al op het scherm stond.
  let chartError: { key: "panel.reload.short" } | { raw: string } | null = null;
  let chartLoading = false;
  let journal: JournalSchema | null = null;
  let journalNote: { kind: "missing" } | { kind: "load-failed"; error: string } | null = null;
  let targets: TargetsInfo | null = null;

  // ── Keuzes van de user ──────────────────────────────────────────────────
  let selectedPositionId: string | null = null;
  let overrides: Partial<Record<PriceKey, number | null>> & { direction?: Direction | null } = {};
  let targetKey = storedTarget();
  let result: Result | null = defaultResult();
  let resultPct = "";
  /** Het laatst automatisch ingevulde resultaat%; wat de user zelf typte wijkt
   * hiervan af en wordt daarom nooit overschreven. */
  let resultAuto: string | null = null;
  /** Zodra de user zelf in het veld typte (of het wiste) blijft het voorstel
   * eraf — anders vult een gewist veld zich meteen weer met het voorstel. Een
   * nieuwe outcome-keuze zet de prefill weer aan, tenzij er een eigen waarde
   * staat. */
  let resultTouched = false;
  let riskPct = "";
  let notes = "";
  let manualDate = "";
  let manualTime = "";
  let values: FormValues = {};
  /** Eén keer per formulier-sessie; blijft gelijk bij een retry (idempotentie). */
  let clientUuid = newClientUuid();
  /** "Nog aanpassen" (F5): dezelfde clientUuid, maar het schrijfpad wordt een
   * update van de zojuist gelogde rij in plaats van een nieuwe insert. */
  let editingLogged = false;
  /** De snapshot-paden die mét de log meegingen; een bewerking mag ze niet
   * leegvegen (de sectie zelf is na een geslaagde log alweer vers). */
  let loggedScreenshots: Partial<Record<SnapshotSlot, string | null>> | null = null;

  let form: DynamicForm | null = null;
  let formFieldList: JournalField[] = [];
  /** Eerste-run-hint: pas tonen als de storage-lezing terug is (boot). */
  let showOnboarding = false;

  // ── Skelet ──────────────────────────────────────────────────────────────
  const closeBtn = el("button", { class: "by-icon", unsafeHtml: ICON_CLOSE, attrs: { type: "button" } });
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
  const panel = el("div", { class: "by-panel by-card", attrs: { role: "dialog" } }, [head, body, foot]);
  host.appendChild(panel);

  /** Alles wat buiten body/foot leeft en toch taal draagt. */
  function paintChrome(): void {
    panel.setAttribute("aria-label", t("panel.launcher"));
    closeBtn.setAttribute("title", t("panel.close"));
    closeBtn.setAttribute("aria-label", t("panel.close"));
  }
  paintChrome();

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

  /**
   * Wat "Running | Win | Loss | BE" aanstaat zolang de user niets koos. Op het
   * live journal is lopend de normale gang van zaken; een backtest-project
   * zonder resultaat is zelden de bedoeling, dus dáár is de keuze bewust leeg
   * (Running blijft wél kiesbaar, zoals met de oude modus-toggle).
   */
  function defaultResult(): Result | null {
    return targetKey === "live" ? "running" : null;
  }

  /**
   * De entry-tijd als wall-clock ("HH:MM") in de profiel-tijdzone: de bar-tijd
   * van de position-tool, anders wat de user zelf invulde (die input staat al
   * in diezelfde tijdzone). Basis voor de CC-prefill.
   */
  function entryWallClockTime(): string | null {
    const entryTimeSec = selectedPosition()?.entryTimeSec;
    if (entryTimeSec != null && targets?.timezone) {
      return wallClockInTimezone(entryTimeSec * 1000, targets.timezone)?.time ?? null;
    }
    return manualTime || null;
  }

  // ── Volledige staten (loading / niet gekoppeld / succes) ────────────────
  /** De weergave die nu op het scherm staat, als functie — een taalwissel roept
   * 'm gewoon opnieuw aan (de ingevulde waarden staan in deze closure). */
  let currentView: () => void = () => {};

  function showView(view: () => void): void {
    currentView = view;
    view();
  }

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
    const retry = el("button", {
      class: "by-btn by-btn-ghost",
      text: t("panel.notLinked.retry"),
      attrs: { type: "button" },
    });
    on(retry, "click", () => void boot());
    return simpleState(t("panel.notLinked.title"), t("panel.notLinked.text"), retry);
  }

  function reloadState(): HTMLElement {
    return simpleState(t("panel.reload.title"), t("panel.reload.text"));
  }

  // ── Secties ─────────────────────────────────────────────────────────────
  const refreshBtn = el("button", { class: "by-btn by-btn-ghost by-btn-sm", attrs: { type: "button" } });
  refreshBtn.appendChild(el("span", { unsafeHtml: ICON_REFRESH }));
  const refreshLabel = el("span");
  refreshBtn.appendChild(refreshLabel);
  on(refreshBtn, "click", () => void refreshChart());

  const chartSec = sectionEl("panel.sec.chart", refreshBtn);
  const positionSec = sectionEl("panel.sec.position");
  const targetSec = sectionEl("panel.sec.target");
  const journalSec = sectionEl("panel.sec.journal");
  const extraSec = sectionEl("panel.sec.extra", undefined, true);
  const snapshotsSec = renderSnapshotsSection();
  const closeSec = renderCloseSection();

  const submitBtn = el("button", { class: "by-btn by-btn-block", attrs: { type: "button" } });
  on(submitBtn, "click", () => void submit());
  const errorBox = el("div", { class: "by-note is-warn" });
  errorBox.hidden = true;
  const pendingLine = el("p", { class: "by-hint", style: "margin:8px 0 0;" });

  function buildForm(): void {
    clear(body);
    clear(foot);
    foot.hidden = false;

    // Vaste copy die buiten de render-functies leeft: hier zetten, zodat één
    // buildForm() na een taalwissel het hele paneel klopt.
    paintChrome();
    for (const sec of [chartSec, positionSec, targetSec, journalSec, extraSec]) {
      sec.title.textContent = t(sec.titleKey);
    }
    refreshBtn.setAttribute("title", t("panel.refreshTitle"));
    refreshLabel.textContent = t("panel.refresh");
    submitBtn.textContent = t(editingLogged ? "panel.submitUpdate" : "panel.submit");

    if (showOnboarding) {
      body.appendChild(
        renderOnboardingCard(() => {
          showOnboarding = false;
          buildForm();
        })
      );
    }

    if (editingLogged) {
      body.appendChild(note(t("panel.editHint"), "is-gold"));
    }

    body.appendChild(chartSec.section);
    // Sluiten staat vlak onder de chart: "je hebt hier nog iets open" hoort de
    // eerste vraag te zijn, niet iets onderaan het log-formulier.
    body.appendChild(closeSec.element);
    body.appendChild(positionSec.section);
    body.appendChild(targetSec.section);
    body.appendChild(journalSec.section);
    body.appendChild(extraSec.section);
    body.appendChild(snapshotsSec.element);

    foot.appendChild(errorBox);
    foot.appendChild(submitBtn);
    foot.appendChild(pendingLine);

    renderChart();
    renderPosition();
    renderTarget();
    renderJournalFields();
    renderExtra();
    showError(null);
    updatePending();
  }

  function renderChart(): void {
    clear(chartSec.body);
    refreshBtn.disabled = chartLoading;
    if (chartLoading) {
      chartSec.body.appendChild(el("p", { class: "by-muted", text: t("panel.chartLoading") }));
      return;
    }
    if (chartError) {
      chartSec.body.appendChild(note("key" in chartError ? t(chartError.key) : chartError.raw, "is-warn"));
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
      positionSec.body.appendChild(note(t("panel.noPositions")));
      renderManualTime();
      return;
    }
    if (!list.some((p) => p.id === selectedPositionId)) selectedPositionId = list[0]?.id ?? null;

    if (list.length > 1) {
      const select = el("select", { class: "by-select", attrs: { "aria-label": t("panel.positionSelectLabel") } });
      for (const position of list) {
        select.appendChild(
          el("option", {
            text: t("panel.positionOption", {
              direction: position.direction,
              price: formatPrice(position.prices?.entry ?? position.entry),
            }),
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
          el("p", {
            class: "by-hint",
            style: "margin:0 0 5px;",
            text: t("panel.positionPick", { count: list.length }),
          }),
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
          attrs: {
            type: "button",
            title: t("panel.editTitle", { label }),
            "aria-label": t("panel.editTitle", { label }),
          },
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
      t("panel.metric.direction"),
      () => {
        const direction = effDirection();
        return {
          // Long/Short blijven de rauwe enum-waarde: trading-leenwoorden die in
          // beide talen hetzelfde zijn (zoals in de web-app).
          text: direction ?? "—",
          cls: direction === "Long" ? "by-win" : direction === "Short" ? "by-loss" : "by-faint",
          src: overrides.direction ? t("panel.src.manual") : t("panel.src.tv"),
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
          src: overrides[key] != null ? t("panel.src.manual") : t("panel.src.tv"),
          manual: overrides[key] != null,
        }),
        () => {
          const input = el("input", {
            class: "by-input",
            attrs: {
              type: "number",
              step: "any",
              inputmode: "decimal",
              placeholder: t("panel.editPlaceholder", { label }),
            },
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

    priceRow(t("panel.metric.entry"), "entry");
    priceRow(t("panel.metric.stop"), "stop");
    priceRow(t("panel.metric.target"), "target");

    addMetric(t("panel.metric.rr"), () => ({
      text: formatRR(effRR()),
      cls: "by-mono",
      src: t("panel.src.computed"),
      manual: false,
    }));

    // Risico staat bewust bij R:R (owner 2026-09-19): allebei over risk/reward.
    // Leeg = de standaard 1% (badge "standaard"); klik het potlood om per trade
    // een eigen % te zetten. De log gebruikt riskPct; leeg => 1%-default (F5a).
    addMetric(
      t("panel.metric.risk"),
      () => {
        const set = riskPct.trim() !== "";
        return {
          text: `${set ? riskPct.trim() : "1"}%`,
          cls: "by-mono",
          src: set ? t("panel.src.manual") : t("panel.src.default"),
          manual: set,
        };
      },
      () => {
        const input = el("input", {
          class: "by-input",
          attrs: { type: "number", step: "any", inputmode: "decimal", placeholder: t("panel.riskPlaceholder") },
        });
        input.value = riskPct;
        on(input, "input", () => {
          riskPct = input.value;
          refreshRows();
        });
        return input;
      }
    );

    const position = selectedPosition();
    if (position?.entryTimeSec != null) {
      addMetric(t("panel.metric.time"), () => ({
        text: formatBarTime(position.entryTimeSec),
        cls: "by-mono",
        src: t("panel.src.tv"),
        manual: false,
      }));
    }
    if (position && !position.prices) {
      positionSec.body.appendChild(readFail(t("panel.noTickPrices")));
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
          document.createTextNode(t("panel.manualTimeLabel")),
          el("span", { class: "by-req", text: " *" }),
        ]),
        el("div", { class: "by-row" }, [dateInput, timeInput]),
        el("p", { class: "by-hint", style: "margin:5px 0 0;", text: t("panel.manualTimeHint") }),
      ])
    );
  }

  function renderTarget(): void {
    clear(targetSec.body);
    const select = el("select", { class: "by-select", attrs: { "aria-label": t("panel.targetSelectLabel") } });
    select.appendChild(el("option", { text: t("panel.targetLive"), attrs: { value: "live" } }));
    for (const project of targets?.projects ?? []) {
      select.appendChild(
        el("option", {
          text: t("panel.targetProject", { name: project.naam }),
          attrs: { value: `project:${project.id}` },
        })
      );
    }
    const known = Array.from(select.options).some((o) => o.value === targetKey);
    if (!known) targetKey = "live";
    select.value = targetKey;
    on(select, "change", () => {
      targetKey = select.value;
      storeTarget(targetKey);
      // De resultaat-keuze volgt het nieuwe doel, maar blijft daarna gewoon
      // omschakelbaar — een lopende backtest-trade mag.
      result = defaultResult();
      renderResult();
      updatePending();
    });
    targetSec.body.appendChild(select);

    const activeName =
      targets?.journals.find((j) => j.id === targets?.activeJournalId)?.naam ?? journal?.naam ?? null;
    if (activeName) {
      targetSec.body.appendChild(
        el("p", {
          class: "by-hint",
          style: "margin:6px 0 0;",
          text: t("panel.activeJournal", { name: activeName }),
        })
      );
    }
    if (!targets) {
      targetSec.body.appendChild(
        el("p", { class: "by-hint", style: "margin:6px 0 0;", text: t("panel.targetsFailed") })
      );
    }

    targetSec.body.appendChild(resultWrap);
    renderResult();
  }

  // Doel en resultaat staan in dezelfde sectie, maar het doel-blok (de select)
  // blijft staan als alleen de resultaat-keuze wisselt — anders zou de select
  // z'n focus verliezen bij elke klik op Win/Loss/BE.
  const resultWrap = el("div", { style: "margin-top:10px;" });
  /** Het resultaat%-veld en z'n voorstel-hint, zolang die gemount zijn. */
  let resultInput: HTMLInputElement | null = null;
  let resultHint: HTMLElement | null = null;

  /** De hint hoort alleen te staan zolang het veld nog het voorstel toont. */
  function paintResultHint(): void {
    if (resultHint) resultHint.hidden = resultAuto == null || resultPct !== resultAuto;
  }

  function renderResult(): void {
    clear(resultWrap);
    resultInput = null;
    resultHint = null;

    const choices = el("div", {
      class: "by-outcomes is-quad",
      attrs: { role: "group", "aria-label": t("panel.resultGroupLabel") },
    });
    for (const value of ["running", "Win", "Loss", "BE"] as const) {
      const btn = el("button", {
        // Win/Loss/BE blijven de rauwe enum-waarde (leenwoorden); alleen
        // "Running" komt uit de woordenlijst.
        class: "by-oc",
        text: value === "running" ? t("panel.resultRunning") : value,
        attrs: { type: "button", "data-outcome": value },
      });
      btn.classList.toggle("is-active", result === value);
      on(btn, "click", () => {
        result = value;
        // Een nieuwe keuze mag het voorstel weer invullen — maar alleen als er
        // geen eigen waarde van de user staat.
        if (resultPct === "" || resultPct === resultAuto) resultTouched = false;
        renderResult();
        // updatePending() doet het auto-voorstel en vult het verse veld.
        updatePending();
      });
      choices.appendChild(btn);
    }
    resultWrap.appendChild(choices);

    if (result === "running") {
      resultWrap.appendChild(el("p", { class: "by-hint", style: "margin:8px 0 0;", text: t("panel.runningHint") }));
      return;
    }
    // Nog niets gekozen: geen veld. Wat er dan mist zegt de regel onder de knop.
    if (!result) return;

    const input = el("input", {
      class: "by-input",
      attrs: { type: "number", step: "any", inputmode: "decimal", placeholder: t("panel.resultPlaceholder") },
    });
    input.value = resultPct;
    on(input, "input", () => {
      resultPct = input.value;
      resultTouched = true;
      paintResultHint();
      updatePending();
    });
    resultInput = input;

    const hint = el("p", { class: "by-hint", style: "margin:5px 0 0;", text: t("panel.resultAutoHint") });
    resultHint = hint;
    paintResultHint();

    resultWrap.appendChild(
      el("div", { style: "margin-top:8px;" }, [
        el("span", { class: "by-label" }, [
          document.createTextNode(t("panel.resultLabel")),
          el("span", { class: "by-req", text: " *" }),
        ]),
        input,
        hint,
      ])
    );
  }

  /**
   * Het auto-voorstel voor resultaat%: "de trade liep af zoals getekend"
   * (suggestedResultPct). Het vult alleen een leeg veld of een veld dat nog
   * exact het vorige voorstel draagt — wat de user zelf typte blijft staan.
   */
  function syncResultSuggestion(): void {
    if (result == null || result === "running" || resultTouched) return;
    if (resultPct !== "" && resultPct !== resultAuto) return;
    const suggestion = suggestedResultPct(result, effRR(), parseNumberInput(riskPct));
    const next = suggestion == null ? "" : String(suggestion);
    if (next === resultPct) return;
    resultPct = next;
    resultAuto = suggestion == null ? null : next;
    if (resultInput) resultInput.value = resultPct;
    paintResultHint();
  }

  /** Het journal draagt een CC-veld (methodology_field met field_key "cc"); dan
   * geldt de CC-prefill uit de entry-tijd. Sinds de fase-retirement is `cc` een
   * gewoon custom veld i.p.v. een aparte WPM-kolom. */
  function hasCcField(): boolean {
    return journal?.fields.some((f) => f.fieldKey === "cc") === true;
  }

  /**
   * De CC is geen zichtbaar veld meer (owner 18-09: clutter) maar wordt
   * machinaal afgeleid uit de entry-tijd — de meest recente 4H-close in de
   * profiel-tijdzone (ccFromTime) — en reist onzichtbaar mee via `values`, zodat
   * customFromValues 'm alsnog in trades.custom zet (fase-retirement-contract).
   * Zonder bruikbare tijd gaat er niets mee.
   */
  function syncCc(): void {
    if (!hasCcField()) return;
    const time = entryWallClockTime();
    const cc = time ? ccFromTime(time) : null;
    if (cc == null) delete values["cc"];
    else values["cc"] = cc;
  }

  function renderJournalFields(): void {
    clear(journalSec.body);
    form = null;

    if (journalNote) {
      const text =
        journalNote.kind === "missing"
          ? t("panel.journalMissing")
          : t("panel.journalLoadFailed", { error: journalNote.error });
      journalSec.body.appendChild(note(text, "is-gold"));
    }
    if (!journal) return;

    // Alle methodology_fields lopen via het generieke pad — sinds de
    // fase-retirement zijn fase/weekly/confirms/kenmerken gewone velden. `cc`
    // filteren we uit de getóónde rijen (owner 18-09: machinaal berekend), maar
    // formFieldList houdt 'm wél zodat customFromValues 'm meestuurt.
    formFieldList = formFields(journal.fields);
    // WPM-journal: zelfde vaste volgorde als de web-app (kenmerk+nieuws boven de
    // confirms, geen "Markt"-kop); andere journals blijven op sortOrder. `cc`
    // blijft uit de getoonde rijen (machinaal), maar zit wél in formFieldList.
    const shownFields = orderedFormFields(formFieldList.filter((f) => f.fieldKey !== "cc"));
    if (shownFields.length > 0) {
      form = renderDynamicForm({
        allFields: journal.fields,
        fields: shownFields,
        values,
        onChange: () => {
          // Een keuze kan een show_when-veld openen of dichtklappen; sync werkt
          // meteen ook de select-waarden bij.
          form?.sync();
          updatePending();
        },
      });
      journalSec.body.appendChild(form.element);
    } else if (!journalNote) {
      journalSec.body.appendChild(
        el("p", { class: "by-hint", style: "margin:0;", text: t("panel.noJournalFields") })
      );
    }
  }

  function renderExtra(): void {
    clear(extraSec.body);

    // Risico staat nu bij R:R in de position-tool (owner 2026-09-19); hier blijft
    // alleen Notities over — kop-loze sectie.
    const notesInput = el("textarea", {
      class: "by-input",
      attrs: { rows: "3", placeholder: t("panel.notesPlaceholder") },
    });
    notesInput.value = notes;
    on(notesInput, "input", () => {
      notes = notesInput.value;
    });

    extraSec.body.appendChild(
      el("div", {}, [
        el("span", { class: "by-label", text: t("panel.notesLabel") }),
        notesInput,
      ])
    );
  }

  // ── Validatie + verzenden ───────────────────────────────────────────────
  type Built =
    | { ok: true; request: LogTradeRequest }
    | { ok: false; message: string; missingKeys?: string[] };

  function buildRequest(): Built {
    if (!chart || !chart.symbol.ok) return { ok: false, message: t("panel.v.noSymbol") };

    const position = selectedPosition();
    const direction = position ? effDirection() : null;
    const entry = position ? effPrice("entry") : null;
    const stop = position ? effPrice("stop") : null;
    const target = position ? effPrice("target") : null;
    if ((entry == null) !== (stop == null)) return { ok: false, message: t("panel.v.entryStopPair") };
    const prices = entry != null && stop != null ? { entry, stop, target } : null;

    const entryTimeUtcSec = position?.entryTimeSec ?? null;
    let manualDateTime: WallClock | null = null;
    if (entryTimeUtcSec == null) {
      if (!manualDate || !manualTime) return { ok: false, message: t("panel.v.needDateTime") };
      manualDateTime = { date: manualDate, time: manualTime };
    }

    if (result == null) return { ok: false, message: t("panel.v.pickResult") };
    let tradeMode: LogTradeRequest["mode"] = { kind: "live-open" };
    if (result !== "running") {
      const pct = parseNumberInput(resultPct);
      if (pct == null) return { ok: false, message: t("panel.v.needResult") };
      if (result === "Loss" && pct > 0) return { ok: false, message: t("panel.v.lossNegative") };
      if (result === "Win" && pct < 0) return { ok: false, message: t("panel.v.winPositive") };
      tradeMode = { kind: "post-hoc", outcome: result, resultaatPct: pct };
    }

    // cc is een onzichtbaar, machinaal veld (owner 18-09): het mag de submit
    // nooit blokkeren, dus buiten de verplicht-check houden.
    const checkFields = formFieldList.filter((f) => f.fieldKey !== "cc");
    const missing = journal ? missingRequired(checkFields, journal.fields, values) : [];
    if (missing.length > 0) {
      return {
        ok: false,
        message: t("panel.v.missingRequired", { fields: missing.map((f) => f.label).join(", ") }),
        missingKeys: missing.map((f) => f.fieldKey),
      };
    }

    const risk = parseNumberInput(riskPct);
    if (riskPct.trim() && risk == null) return { ok: false, message: t("panel.v.riskNaN") };
    if (risk != null && risk <= 0) return { ok: false, message: t("panel.v.riskPositive") };

    return {
      ok: true,
      request: {
        symbolRaw: chart.symbol.value,
        target: targetKey === "live" ? { type: "live" } : { type: "project", projectId: targetKey.slice("project:".length) },
        mode: tradeMode,
        direction,
        prices,
        entryTimeUtcSec,
        // Chart-"nu" voor de sluitdatum van een Win/Loss/BE-log (replay-bewust).
        closeTimeUtcSec: chart.lastBar.ok ? chart.lastBar.value.timeSec : null,
        manualDateTime,
        riskPct: risk,
        // Alle methodology-antwoorden (incl. fase/cc/…) gaan via de custom-bag.
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
    // Eerst de twee prefills: ze veranderen wat er nog mist. Ze draaien hier en
    // niet in elke call-site, want dit is precies het moment waarop iets van
    // invoer (prijs, risico, tijd, keuze) net veranderd is.
    syncResultSuggestion();
    syncCc();
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
    submitBtn.textContent = t(editingLogged ? "panel.submitUpdateBusy" : "panel.submitBusy");
    // Bij een bewerking gaat exact dezelfde payload mee, mét de screenshots van
    // de log erin — anders zou de update die kolommen leegschrijven.
    const request: LogTradeRequest = editingLogged
      ? { ...built.request, screenshots: mergeScreenshots(loggedScreenshots, snapshotsSec.screenshots()) }
      : built.request;
    try {
      const result = editingLogged
        ? await sendToSw({ type: "update-trade", request })
        : await sendToSw({ type: "log-trade", request });
      if (result.ok) {
        // Alleen bij een échte schrijfactie zitten de snapshots in een trade; bij
        // een duplicate is er niets weggeschreven, dus zijn onze uploads wezen.
        if (result.duplicate) snapshotsSec.reset();
        else snapshotsSec.consume();
        if (!result.duplicate) loggedScreenshots = request.screenshots ?? null;
        showView(() => showSuccess(result.duplicate));
        return;
      }
      showError(logTradeErrorCopy(result));
    } catch {
      showError({ message: t("panel.reload.retry") });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t(editingLogged ? "panel.submitUpdate" : "panel.submit");
    }
  }

  function showSuccess(duplicate: boolean): void {
    const link = el("a", {
      class: "by-link",
      attrs: { href: JOURNAL_URL, target: "_blank", rel: "noopener noreferrer" },
    });
    link.appendChild(el("span", { text: t("panel.success.open") }));
    link.appendChild(el("span", { unsafeHtml: ICON_EXTERNAL }));

    const again = el("button", { class: "by-btn", text: t("panel.success.again"), attrs: { type: "button" } });
    on(again, "click", () => {
      resetForm();
      showView(buildForm);
      void refreshChart();
    });

    // "Nog aanpassen": terug naar hetzelfde formulier met alle waarden intact
    // (die leven in deze closure) en dezelfde clientUuid — opslaan wordt dan een
    // update van precies die rij (import_ref), geen tweede trade.
    const edit = el("button", {
      class: "by-btn by-btn-ghost",
      text: t("panel.success.edit"),
      attrs: { type: "button" },
    });
    on(edit, "click", () => {
      editingLogged = true;
      showView(buildForm);
    });

    const updated = editingLogged && !duplicate;
    showState(
      el("div", { class: "by-state" }, [
        el("div", { class: "by-state-icon is-win", unsafeHtml: ICON_CHECK }),
        el("p", {
          class: "by-state-title",
          text: duplicate ? t("panel.duplicate.title") : updated ? t("panel.updated.title") : t("panel.success.title"),
        }),
        el("p", {
          class: "by-state-text",
          text: duplicate ? t("panel.duplicate.text") : updated ? t("panel.updated.text") : t("panel.success.text"),
        }),
        el("div", { class: "by-stack", style: "align-items:center;gap:12px;" }, [link, edit, again]),
      ])
    );
  }

  function resetForm(): void {
    clientUuid = newClientUuid();
    editingLogged = false;
    loggedScreenshots = null;
    values = {};
    overrides = {};
    result = defaultResult();
    resultPct = "";
    resultAuto = null;
    resultTouched = false;
    riskPct = "";
    notes = "";
    manualDate = "";
    manualTime = "";
    // Verse snapshot-staat; wat er nog niet in een trade zit, wordt hier
    // opgeruimd (na een geslaagde log is die lijst al leeg — zie submit()).
    snapshotsSec.reset();
    // Het doel blijft staan (wie vijf backtest-trades logt, wil dat niet vijf
    // keer opnieuw kiezen); de resultaat-keuze valt terug op de default van dát
    // doel — een tweede trade is zelden dezelfde uitkomst.
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
      chartError = result.ok ? null : { raw: result.error };
    } catch {
      chart = null;
      chartError = { key: "panel.reload.short" };
    }
    chartLoading = false;
    renderChart();
    renderPosition();
    updatePending();
    syncCloseSection();
  }

  /** De sluit-sectie leeft op dezelfde chart-lezing: symbool (welke trades),
   * laatste bar (exit-prefill + sluitdatum) en de journal-instelling voor MAE/MFE. */
  function syncCloseSection(): void {
    closeSec.setContext({
      symbolRaw: chart?.symbol.ok ? chart.symbol.value : null,
      bar: chart?.lastBar.ok ? chart.lastBar.value : null,
      trackExit: journal?.trackExit === true,
    });
  }

  async function boot(): Promise<void> {
    // Taal vóór de eerste zin op het scherm; de rest van het paneel leest 'm
    // daarna synchroon via t().
    await ensureLang();
    showView(() => showState(simpleState(t("panel.booting.title"), t("panel.booting.text"))));
    try {
      const status = await sendToSw({ type: "status" });
      if (!status.linked) {
        showView(() => showState(notLinkedState()));
        return;
      }
      const [dump, targetsResult, onboardingDone] = await Promise.all([
        sendToSw({ type: "journal-dump" }),
        sendToSw({ type: "targets" }),
        isOnboardingDismissed(),
      ]);
      if (dump.ok) {
        journal = dump.journal;
        journalNote = journal ? null : { kind: "missing" };
      } else {
        journal = null;
        journalNote = { kind: "load-failed", error: dump.error };
      }
      targets = targetsResult.ok ? targetsResult : null;
      showOnboarding = !onboardingDone;
      showView(buildForm);
      await refreshChart();
    } catch {
      showView(() => showState(reloadState()));
    }
  }

  // Taalwissel in de popup: dezelfde weergave nog eens tekenen. De ingevulde
  // waarden staan in deze closure, dus dat kost geen invoer.
  const stopLangWatch = onLangChange(() => currentView());

  void boot();

  return {
    element: panel,
    destroy() {
      stopLangWatch();
      closeSec.dispose();
      // Sluiten met niet-gelogde snapshots = wezen in de bucket; die gaan mee weg.
      snapshotsSec.dispose();
      panel.remove();
    },
  };
}
