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
//
// Copy loopt sinds F4b via i18nExt: de taal wordt één keer opgehaald vóór de
// eerste render (boot) en een wissel in de popup hertekent de huidige weergave
// (currentView). De ingevulde waarden leven in deze closure, niet in de DOM,
// dus zo'n hertekening kost geen invoer.
import type { Direction, Outcome } from "../../../../src/lib/constants";
import { plannedRR } from "../../../../src/lib/priceMath";
import type { WallClock } from "../../../../src/lib/tradePayload";
import type { ChartState, PositionState } from "../../adapter/parse";
import type { JournalField, JournalSchema } from "../../db";
import { ensureLang, onLangChange, t, type MessageKey } from "../../i18nExt";
import { sendToSw, type TargetsInfo } from "../../messages";
import type { LogTradeRequest } from "../../tradeFlow";
import { clear, el, on } from "./dom";
import { logTradeErrorCopy, type ErrorCopy } from "./errors";
import {
  customFromValues, formFields, isLegacyJournal, legacyFromValues, missingRequired, selectedFase,
  type FormValues,
} from "./fields";
import { renderDynamicForm, type DynamicForm } from "./form";
import { renderLegacyForm, type LegacyCustomOptions } from "./legacyForm";
import {
  formatBarTime, formatPrice, formatResolution, formatRR, newClientUuid, parseNumberInput,
} from "./format";
import { ICON_CHECK, ICON_CLOSE, ICON_EXTERNAL, ICON_PENCIL, ICON_REFRESH, markSvg } from "./icons";
import { isOnboardingDismissed, renderOnboardingCard } from "./onboarding";
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

interface Section {
  section: HTMLElement;
  body: HTMLElement;
  /** Kopje van de sectie; de tekst wordt bij elke (her)opbouw gezet, zodat een
   * taalwissel niet met stale koppen achterblijft. */
  title: HTMLElement;
  titleKey: MessageKey;
}

function sectionEl(titleKey: MessageKey, extra?: HTMLElement): Section {
  const title = el("h3", { class: "by-sec-title" });
  const head = el("div", { class: "by-sec-head" }, [title, el("span", { class: "by-spacer" }), extra]);
  const body = el("div");
  return { section: el("section", { class: "by-sec" }, [head, body]), body, title, titleKey };
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
  /** Eigen extra waarden voor entry/trade concept; alleen een legacy journal haalt ze op. */
  let customOptions: LegacyCustomOptions = { entry: [], tradeConcept: [] };

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
  const modeSec = sectionEl("panel.sec.mode");
  const journalSec = sectionEl("panel.sec.journal");
  const extraSec = sectionEl("panel.sec.extra");
  const snapshotsSec = renderSnapshotsSection();

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
    for (const sec of [chartSec, positionSec, targetSec, modeSec, journalSec, extraSec]) {
      sec.title.textContent = t(sec.titleKey);
    }
    refreshBtn.setAttribute("title", t("panel.refreshTitle"));
    refreshLabel.textContent = t("panel.refresh");
    submitBtn.textContent = t("panel.submit");

    if (showOnboarding) {
      body.appendChild(
        renderOnboardingCard(() => {
          showOnboarding = false;
          buildForm();
        })
      );
    }

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
  }

  const modeExtra = el("div", { style: "margin-top:10px;" });

  function renderMode(): void {
    clear(modeSec.body);
    clear(modeExtra);

    const seg = el("div", { class: "by-seg", attrs: { role: "group", "aria-label": t("panel.modeLabel") } });
    for (const [key, label] of [
      ["live", t("panel.modeLive")],
      ["backtest", t("panel.modeBacktest")],
    ] as const) {
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
      modeExtra.appendChild(el("p", { class: "by-hint", style: "margin:0;", text: t("panel.modeLiveHint") }));
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
      attrs: { type: "number", step: "any", inputmode: "decimal", placeholder: t("panel.resultPlaceholder") },
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
          document.createTextNode(t("panel.resultLabel")),
          el("span", { class: "by-req", text: " *" }),
        ]),
        resultInput,
      ])
    );
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

    // Het legacy-WPM-blok staat bovenaan, net als in de web-form: eerst de
    // vaste kolommen (fase, entry, confirms, kenmerken), dan de eigen velden.
    const legacy = isLegacyJournal(journal.fields);
    if (legacy) {
      journalSec.body.appendChild(
        renderLegacyForm({
          allFields: journal.fields,
          values,
          hideFase: targets?.hideFase === true,
          customOptions,
          onChange: () => {
            // Een fase-wissel kan een show_when-veld openen of dichtklappen.
            form?.sync();
            updatePending();
          },
        }).element
      );
    }

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
    } else if (!journalNote && !legacy) {
      journalSec.body.appendChild(
        el("p", { class: "by-hint", style: "margin:0;", text: t("panel.noJournalFields") })
      );
    }
  }

  function renderExtra(): void {
    clear(extraSec.body);

    const risk = el("input", {
      class: "by-input",
      attrs: { type: "number", step: "any", inputmode: "decimal", placeholder: t("panel.riskPlaceholder") },
    });
    risk.value = riskPct;
    on(risk, "input", () => {
      riskPct = risk.value;
      updatePending();
    });

    const notesInput = el("textarea", {
      class: "by-input",
      attrs: { rows: "3", placeholder: t("panel.notesPlaceholder") },
    });
    notesInput.value = notes;
    on(notesInput, "input", () => {
      notes = notesInput.value;
    });

    extraSec.body.appendChild(el("div", {}, [el("span", { class: "by-label", text: t("panel.riskLabel") }), risk]));
    extraSec.body.appendChild(
      el("div", { style: "margin-top:8px;" }, [
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

    let tradeMode: LogTradeRequest["mode"] = { kind: "live-open" };
    if (mode === "backtest") {
      if (!outcome) return { ok: false, message: t("panel.v.pickOutcome") };
      const pct = parseNumberInput(resultPct);
      if (pct == null) return { ok: false, message: t("panel.v.needResult") };
      if (outcome === "Loss" && pct > 0) return { ok: false, message: t("panel.v.lossNegative") };
      if (outcome === "Win" && pct < 0) return { ok: false, message: t("panel.v.winPositive") };
      tradeMode = { kind: "post-hoc", outcome, resultaatPct: pct };
    }

    const missing = journal ? missingRequired(formFieldList, journal.fields, values) : [];
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

    // Legacy journal: de getoonde fase scoopt de kenmerken die meegaan. Met
    // hide_fase toont het paneel geen fase-keuze, dus gaat er ook geen keuze mee
    // — de server houdt dan z'n stille default aan.
    const legacy = journal && isLegacyJournal(journal.fields);
    const shownFase = legacy && journal ? selectedFase(journal.fields, values) : null;

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
        fase: shownFase && !targets?.hideFase ? shownFase : null,
        legacy: shownFase ? legacyFromValues(shownFase, values) : null,
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
    submitBtn.textContent = t("panel.submitBusy");
    try {
      const result = await sendToSw({ type: "log-trade", request: built.request });
      if (result.ok) {
        // Alleen bij een échte insert zitten de snapshots in een trade; bij een
        // duplicate is er niets weggeschreven, dus zijn onze uploads wezen.
        if (result.duplicate) snapshotsSec.reset();
        else snapshotsSec.consume();
        showView(() => showSuccess(result.duplicate));
        return;
      }
      showError(logTradeErrorCopy(result));
    } catch {
      showError({ message: t("panel.reload.retry") });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = t("panel.submit");
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

    showState(
      el("div", { class: "by-state" }, [
        el("div", { class: "by-state-icon is-win", unsafeHtml: ICON_CHECK }),
        el("p", {
          class: "by-state-title",
          text: duplicate ? t("panel.duplicate.title") : t("panel.success.title"),
        }),
        el("p", {
          class: "by-state-text",
          text: duplicate ? t("panel.duplicate.text") : t("panel.success.text"),
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
      chartError = result.ok ? null : { raw: result.error };
    } catch {
      chart = null;
      chartError = { key: "panel.reload.short" };
    }
    chartLoading = false;
    renderChart();
    renderPosition();
    updatePending();
  }

  /** Eén keer per paneel-mount; mislukt de lezing, dan blijven de basisopties over. */
  async function loadCustomOptions(): Promise<LegacyCustomOptions> {
    try {
      const result = await sendToSw({ type: "custom-options" });
      if (result.ok) return { entry: result.entry, tradeConcept: result.tradeConcept };
    } catch {
      /* stil: alleen de gedeelde vaste lijsten */
    }
    return { entry: [], tradeConcept: [] };
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
      // Alleen een legacy journal heeft de twee addable-velden; op elk ander
      // journal zou dit een lege query voor niets zijn.
      customOptions = journal && isLegacyJournal(journal.fields) ? await loadCustomOptions() : { entry: [], tradeConcept: [] };
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
      // Sluiten met niet-gelogde snapshots = wezen in de bucket; die gaan mee weg.
      snapshotsSec.dispose();
      panel.remove();
    },
  };
}
