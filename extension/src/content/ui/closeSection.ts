// De sluit-sectie van het paneel (F5b, plan §7.3): "Open trades op dit symbool"
// met per trade een rij (datum, richting, entry→SL, plan-R) en een compact
// sluit-formulier dat per trade openklapt.
//
// Drie regels, zoals de rest van het paneel:
//  1. Alle beslissingen komen uit closeState.ts (puur, getest) en het rekenwerk
//     uit previewClose/closeTradeFromChart — hier staat alleen weergave.
//  2. De ingevulde waarden leven in de `form`-closure, niet in de DOM. Een
//     hertekening (taalwissel, nieuwe chart-lezing) kost daarom geen invoer;
//     alleen typen zelf raakt de DOM niet aan (dat werkt de preview bij).
//  3. De sectie is er niet als er niets te sluiten valt: geen trades (of een
//     mislukte lezing) = verborgen sectie, geen extra ruis naast het log-formulier.
import type { OpenTradeMatch } from "../../closeFlow";
import type { LastBarInfo } from "../../adapter/parse";
import { GRADED_EVALUATIONS } from "../../../../src/lib/constants";
import { onLangChange, t } from "../../i18nExt";
import { sendToSw } from "../../messages";
import {
  buildCloseRequest, closePreview, evaluationLabelKey, exitInputs, exitPriceAvailable, initialForm,
  tradeSummary, tradesToShow, type CloseForm, type CloseMode,
} from "./closeState";
import { clear, el, on } from "./dom";
import { closeTradeErrorCopy, type ErrorCopy } from "./errors";
import { JOURNAL_URL } from "./format";
import { ICON_CHECK, ICON_EXTERNAL } from "./icons";

export interface CloseContext {
  /** Rauw chart-symbool ("OANDA:AUDJPY"); null = onleesbaar. */
  symbolRaw: string | null;
  /** Laatste bar van de chart (exit-prefill + replay-veilige sluitdatum). */
  bar: LastBarInfo | null;
  /** methodologies.track_exit — alleen dán vraagt het formulier MAE/MFE. */
  trackExit: boolean;
}

export interface CloseSection {
  element: HTMLElement;
  /** Nieuwe chart-lezing; een ander symbool herlaadt de lijst. */
  setContext(context: CloseContext): void;
  dispose(): void;
}

interface CloseSuccess {
  outcome: string;
  pct: number;
  date: string;
}

export function renderCloseSection(): CloseSection {
  let context: CloseContext = { symbolRaw: null, bar: null, trackExit: false };
  let trades: OpenTradeMatch[] = [];
  let loading = false;
  let busy = false;
  /** De trade waarvan het formulier openstaat (id), of null. */
  let openId: string | null = null;
  let form: CloseForm | null = null;
  /** Zolang de user niet zelf in het exit-veld typte, volgt het de chart. */
  let exitTouched = false;
  let error: ErrorCopy | null = null;
  let success: CloseSuccess | null = null;

  const title = el("h3", { class: "by-sec-title" });
  const list = el("div");
  const element = el("section", { class: "by-sec" }, [
    el("div", { class: "by-sec-head" }, [title]),
    list,
  ]);
  element.hidden = true;

  /** Alleen de preview/fout/knop bijwerken — typen mag nooit een rebuild kosten. */
  let refreshLive: () => void = () => {};

  // ── Data ────────────────────────────────────────────────────────────────
  async function reload(): Promise<void> {
    const symbol = context.symbolRaw;
    if (!symbol) {
      trades = [];
      paint();
      return;
    }
    loading = true;
    paint();
    try {
      const result = await sendToSw({ type: "open-trades", symbolRaw: symbol });
      trades = tradesToShow(result);
    } catch {
      trades = []; // extensie herladen: de sectie verdwijnt gewoon
    }
    loading = false;
    // Een trade die intussen weg is (gesloten in de web-app) neemt z'n formulier mee.
    if (openId && !trades.some((trade) => trade.id === openId)) {
      openId = null;
      form = null;
    }
    paint();
  }

  function setContext(next: CloseContext): void {
    const symbolChanged = next.symbolRaw !== context.symbolRaw;
    const previousBar = context.bar;
    context = next;
    if (symbolChanged) {
      success = null;
      error = null;
      openId = null;
      form = null;
      void reload();
      return;
    }
    // Verse chart-lezing: het exit-veld volgt de nieuwe candle zolang de user er
    // niet zelf in typte — anders zou "Ververs chart" z'n invoer overschrijven.
    if (form && !exitTouched && next.bar && next.bar.close !== previousBar?.close) {
      form.exit = String(next.bar.close);
    }
    paint();
  }

  function toggle(trade: OpenTradeMatch): void {
    if (openId === trade.id) {
      openId = null;
      form = null;
    } else {
      openId = trade.id;
      form = initialForm(trade, context.bar);
      exitTouched = false;
      error = null;
      success = null;
    }
    paint();
  }

  async function submit(trade: OpenTradeMatch): Promise<void> {
    if (!form || busy) return;
    const built = buildCloseRequest(trade, form, context.bar);
    if (!built.ok) {
      error = { message: built.message };
      refreshLive();
      return;
    }
    busy = true;
    error = null;
    paint();
    try {
      const result = await sendToSw({ type: "close-trade", request: built.request });
      if (result.ok) {
        success = { outcome: result.outcome, pct: result.resultaatPct, date: result.datumSluiting };
        openId = null;
        form = null;
        busy = false;
        await reload(); // de gesloten trade hoort niet meer in de lijst
        return;
      }
      error = closeTradeErrorCopy(result);
    } catch {
      error = { message: t("panel.reload.retry") };
    }
    busy = false;
    paint();
  }

  // ── Rijen ───────────────────────────────────────────────────────────────
  function tradeRow(trade: OpenTradeMatch): HTMLElement {
    const summary = tradeSummary(trade);
    const isOpen = openId === trade.id;

    const button = el("button", {
      class: "by-btn by-btn-ghost by-btn-sm",
      text: isOpen ? t("close.cancel") : t("close.open"),
      attrs: { type: "button", "aria-expanded": String(isOpen), "aria-label": isOpen ? t("close.cancel") : t("close.openAria", { when: summary.when }) },
    });
    button.disabled = busy;
    on(button, "click", () => toggle(trade));

    const direction = el("span", {
      class: `by-close-dir ${summary.direction === "Long" ? "by-win" : summary.direction === "Short" ? "by-loss" : "by-faint"}`,
      text: summary.direction,
    });

    return el("div", { class: "by-close-row" }, [
      el("div", { class: "by-close-main" }, [
        el("div", { class: "by-close-head" }, [
          el("span", { class: "by-close-when by-mono", text: summary.when }),
          direction,
        ]),
        el("div", { class: "by-close-meta" }, [
          el("span", { class: "by-mono", text: summary.range }),
          el("span", { class: "by-close-rr by-mono", text: summary.rr }),
        ]),
      ]),
      button,
    ]);
  }

  // ── Formulier ───────────────────────────────────────────────────────────
  function numberInput(placeholder: string, value: string, onInput: (raw: string) => void): HTMLInputElement {
    const input = el("input", {
      class: "by-input",
      attrs: { type: "number", step: "any", inputmode: "decimal", placeholder },
    });
    input.value = value;
    on(input, "input", () => {
      onInput(input.value);
      refreshLive();
    });
    return input;
  }

  function labelled(label: string, control: HTMLElement, required = false): HTMLElement {
    const labelNode = el("span", { class: "by-label", text: label });
    if (required) labelNode.appendChild(el("span", { class: "by-req", text: " *" }));
    // flex-basis 0: naast elkaar (MAE/MFE) blijven de twee velden even breed.
    return el("div", { class: "by-field", style: "flex:1;min-width:0;" }, [labelNode, control]);
  }

  function closeForm(trade: OpenTradeMatch, values: CloseForm): HTMLElement {
    const wrap = el("div", { class: "by-close-form" });

    // Modus: exit-prijs kan alleen mét prijzen én een laatste candle; de knop
    // blijft zichtbaar (uitgegrijsd) zodat de reden uitgelegd kan worden.
    const exitPossible = exitPriceAvailable(trade, context.bar);
    const seg = el("div", { class: "by-seg", attrs: { role: "group", "aria-label": t("close.modeLabel") } });
    for (const [mode, label] of [["exit-price", t("close.mode.exit")], ["manual", t("close.mode.manual")]] as [CloseMode, string][]) {
      const btn = el("button", { class: "by-seg-btn", text: label, attrs: { type: "button" } });
      btn.classList.toggle("is-active", values.mode === mode);
      btn.disabled = mode === "exit-price" && !exitPossible;
      on(btn, "click", () => {
        values.mode = mode;
        error = null;
        paint(); // andere velden: hier mág een rebuild
      });
      seg.appendChild(btn);
    }
    wrap.appendChild(seg);

    if (!exitPossible) {
      wrap.appendChild(
        el("p", {
          class: "by-hint",
          style: "margin:6px 0 0;",
          text: exitInputs(trade) ? t("close.noBar") : t("close.noExitPath"),
        })
      );
    }

    if (values.mode === "exit-price") {
      const exit = numberInput(t("close.exitPlaceholder"), values.exit, (raw) => {
        values.exit = raw;
        exitTouched = true;
      });
      wrap.appendChild(el("div", { style: "margin-top:8px;" }, [labelled(t("close.exitLabel"), exit, true)]));
      if (context.bar && !exitTouched) {
        wrap.appendChild(el("p", { class: "by-hint", style: "margin:5px 0 0;", text: t("close.exitFromChart") }));
      }
      wrap.appendChild(
        el("p", {
          class: "by-hint",
          style: "margin:5px 0 0;",
          text: context.bar?.inReplay ? t("close.dateFollowsReplay") : t("close.dateFollowsChart"),
        })
      );
    } else {
      const pct = numberInput(t("close.manualPlaceholder"), values.manualPct, (raw) => {
        values.manualPct = raw;
      });
      const date = el("input", { class: "by-input", attrs: { type: "date" } });
      date.value = values.manualDate;
      on(date, "input", () => {
        values.manualDate = date.value;
        refreshLive();
      });
      wrap.appendChild(el("div", { style: "margin-top:8px;" }, [labelled(t("close.manualLabel"), pct, true)]));
      wrap.appendChild(el("div", { style: "margin-top:8px;" }, [labelled(t("close.dateLabel"), date, true)]));
    }

    // Live preview: R + resultaat% + de afgeleide outcome. Niet kiesbaar — de
    // uitkomst volgt het resultaat (zelfde afleiding als de app).
    const previewLine = el("span", { class: "by-close-preview-value by-mono" });
    const previewBadge = el("span", { class: "by-outcome" });
    const preview = el("div", { class: "by-close-preview" }, [previewLine, previewBadge]);
    wrap.appendChild(preview);

    const evaluation = el("select", { class: "by-select" });
    evaluation.appendChild(el("option", { text: t("form.choose"), attrs: { value: "" } }));
    for (const graded of GRADED_EVALUATIONS) {
      // "Missed trade" staat bewust niet in deze lijst: een trade die je sluit
      // heb je genomen (missed-trade-contract).
      evaluation.appendChild(el("option", { text: t(evaluationLabelKey(graded)), attrs: { value: graded } }));
    }
    evaluation.value = values.evaluation;
    on(evaluation, "change", () => {
      values.evaluation = evaluation.value;
    });
    wrap.appendChild(el("div", { style: "margin-top:8px;" }, [labelled(t("close.evalLabel"), evaluation)]));

    if (context.trackExit) {
      const mae = numberInput("", values.mae, (raw) => {
        values.mae = raw;
      });
      const mfe = numberInput("", values.mfe, (raw) => {
        values.mfe = raw;
      });
      wrap.appendChild(
        el("div", { style: "margin-top:8px;" }, [
          el("div", { class: "by-row" }, [labelled(t("close.maeLabel"), mae), labelled(t("close.mfeLabel"), mfe)]),
          el("p", { class: "by-hint", style: "margin:5px 0 0;", text: t("close.excursionHint") }),
        ])
      );
    }

    const errorBox = el("div", { class: "by-note is-warn", style: "margin-top:10px;" });
    const pendingLine = el("p", { class: "by-hint", style: "margin:6px 0 0;" });
    const submitBtn = el("button", { class: "by-btn by-btn-block", attrs: { type: "button" }, style: "margin-top:10px;" });
    on(submitBtn, "click", () => void submit(trade));

    wrap.appendChild(errorBox);
    wrap.appendChild(submitBtn);
    wrap.appendChild(pendingLine);

    refreshLive = () => {
      // Alleen het exit-prijs-pad heeft een afgeleide R; bij een handmatig
      // resultaat is er niets om te tonen dat de user niet zelf typte.
      const live = closePreview(trade, values, context.bar);
      preview.hidden = values.mode !== "exit-price";
      previewLine.textContent = live
        ? t("close.previewLine", { r: live.r, pct: live.resultaatPct })
        : t("close.previewEmpty");
      previewLine.classList.toggle("is-empty", !live);
      previewBadge.hidden = !live;
      previewBadge.textContent = live ? live.outcome : "";
      if (live) previewBadge.setAttribute("data-outcome", live.outcome);

      const built = buildCloseRequest(trade, values, context.bar);
      pendingLine.textContent = built.ok ? "" : built.message;
      pendingLine.hidden = built.ok;

      clear(errorBox);
      errorBox.hidden = !error;
      if (error) {
        errorBox.appendChild(el("span", { text: error.message }));
        if (error.detail) {
          errorBox.appendChild(
            el("span", { class: "by-mono by-hint", style: "display:block;margin-top:4px;", text: error.detail })
          );
        }
      }

      submitBtn.disabled = busy;
      submitBtn.textContent = busy ? t("close.submitBusy") : t("close.submit");
    };
    refreshLive();

    return wrap;
  }

  function successNode(done: CloseSuccess): HTMLElement {
    const link = el("a", {
      class: "by-link",
      attrs: { href: JOURNAL_URL, target: "_blank", rel: "noopener noreferrer" },
    });
    link.appendChild(el("span", { text: t("close.success.open") }));
    link.appendChild(el("span", { unsafeHtml: ICON_EXTERNAL }));

    return el("div", { class: "by-note is-stack by-close-done" }, [
      el("span", { class: "by-row" }, [
        el("span", { class: "by-close-done-icon", unsafeHtml: ICON_CHECK }),
        el("span", {
          text: t("close.success.title", { outcome: done.outcome, pct: done.pct, date: done.date }),
        }),
      ]),
      link,
    ]);
  }

  // ── Tekenen ─────────────────────────────────────────────────────────────
  function paint(): void {
    title.textContent = t("close.sec.title");
    refreshLive = () => {};
    clear(list);

    // Niets te sluiten (of een mislukte lezing) = geen sectie. De eerste lezing
    // van een symbool loopt dus ook niet even als lege sectie voorbij.
    element.hidden = trades.length === 0 && !success;
    if (element.hidden) return;

    if (success) list.appendChild(successNode(success));
    if (loading) list.appendChild(el("p", { class: "by-muted", text: t("close.loading") }));

    for (const trade of trades) {
      list.appendChild(tradeRow(trade));
      if (openId === trade.id && form) list.appendChild(closeForm(trade, form));
    }
  }

  paint();
  const stopLangWatch = onLangChange(() => paint());

  return {
    element,
    setContext,
    dispose() {
      stopLangWatch();
    },
  };
}
