// De snapshot-sectie van het paneel (F3b): vier slots (W/D/4H/2H) met per slot
// een aan/uit-toggle, een auto-capture óf een geplakte TradingView-link, en het
// resultaat van de laatste cyclus.
//
// Zelfde twee regels als de rest van het paneel: alle beslissingen komen uit
// snapshotState.ts (puur, getest), en de rijen worden één keer gebouwd en daarna
// alleen bijgewerkt — een rebuild zou de caret uit het link-veld gooien.
//
// Opruimen is hier de belangrijkste onzichtbare taak: elk pad dat we uploadden
// en dat niet in een gelogde trade terechtkomt, gaat via `delete-screenshots`
// weer weg. Geplakte links raken we nooit aan — die zijn niet van ons.
import { onLangChange, t } from "../../i18nExt";
import { sendToSw } from "../../messages";
import { SNAPSHOT_SLOTS, type SnapshotSlot } from "../../snapshots";
import { clear, el, on } from "./dom";
import { ICON_LINK, ICON_REFRESH } from "./icons";
import {
  applyCycle, autoSlots, initialState, linkValue, needsGesture, parseEnabled, pathOf,
  screenshotsForRequest, serializeEnabled, slotStatus, SLOT_LABELS, thumbOf, uploadedPaths,
  type SnapshotState,
} from "./snapshotState";

/** Per tab onthouden, net als de doel-keuze (plan F2d). */
const ENABLED_KEY = "beyen-tv-ext:snapshot-slots";

export interface SnapshotsSection {
  element: HTMLElement;
  /** Paden/links per slot voor `LogTradeRequest.screenshots`. */
  screenshots(): Record<SnapshotSlot, string | null>;
  /** Na een geslaagde log: de paden zitten nu in een trade — vergeten, niet wissen. */
  consume(): void;
  /** Verse staat voor de volgende trade; ruimt de achtergebleven paden eerst op. */
  reset(): void;
  /** Paneel sluit: achtergebleven paden opruimen. */
  dispose(): void;
}

interface SlotRow {
  element: HTMLElement;
  update(): void;
  /** Link-veld leegmaken en dichtklappen (bij reset/consume). */
  clearLink(): void;
}

function readEnabled(): Record<SnapshotSlot, boolean> {
  try {
    return parseEnabled(sessionStorage.getItem(ENABLED_KEY));
  } catch {
    return parseEnabled(null); // sessionStorage kan geblokkeerd zijn
  }
}

function writeEnabled(state: SnapshotState): void {
  try {
    sessionStorage.setItem(ENABLED_KEY, serializeEnabled(state));
  } catch {
    /* stil: de keuze geldt dan alleen in dit paneel */
  }
}

function deletePaths(paths: string[]): void {
  if (paths.length === 0) return;
  void sendToSw({ type: "delete-screenshots", paths }).catch(() => {
    /* opruimen is best-effort: de extensie kan intussen herladen zijn */
  });
}

export function renderSnapshotsSection(): SnapshotsSection {
  let state: SnapshotState = initialState(readEnabled());
  let busy = false;
  let restored = true;
  /** Eigen copy bewaren we als sleutel (die hertaalt bij een taalwissel), een
   * reden uit de service worker als rauwe tekst. */
  let cycleError: { key: "panel.reload.retry" } | { raw: string } | null = null;

  const rows = new Map<SnapshotSlot, SlotRow>();
  const list = el("div", { class: "by-snap-list" });
  const notes = el("div", { class: "by-stack", style: "margin-top:10px;" });

  const runBtn = el("button", { class: "by-btn by-btn-ghost by-btn-block", attrs: { type: "button" } });
  on(runBtn, "click", () => void runCycle(autoSlots(state)));

  const busyLine = el("p", { class: "by-hint", style: "margin:6px 0 0;" });
  busyLine.hidden = true;

  // Elke zin die van taal kan veranderen wordt in paint() gezet, niet hier —
  // zo is een taalwissel gewoon één extra paint (zie onLangChange onderaan).
  const title = el("h3", { class: "by-sec-title" });
  const intro = el("p", { class: "by-hint", style: "margin:0 0 8px;" });

  const element = el("section", { class: "by-sec" }, [
    el("div", { class: "by-sec-head" }, [title]),
    intro,
    list,
    runBtn,
    busyLine,
    notes,
  ]);

  // ── Staat-wijzigingen ───────────────────────────────────────────────────
  function setEnabled(slot: SnapshotSlot, enabled: boolean): void {
    // Uitzetten laat een geüpload pad ongebruikt achter — meteen opruimen.
    const orphan = enabled ? null : pathOf(state, slot);
    const next: SnapshotState = { ...state };
    next[slot] = { ...state[slot], enabled, result: orphan ? null : state[slot].result };
    state = next;
    if (orphan) deletePaths([orphan]);
    writeEnabled(state);
    paint();
  }

  function setLink(slot: SnapshotSlot, raw: string): void {
    const next: SnapshotState = { ...state };
    next[slot] = { ...state[slot], link: raw };
    // Zodra er een geldige link staat doet het auto-pad niets meer: weg ermee.
    const orphan = linkValue(next[slot]) !== null ? pathOf(state, slot) : null;
    if (orphan) next[slot] = { ...next[slot], result: null };
    state = next;
    if (orphan) deletePaths([orphan]);
    paint();
  }

  async function runCycle(slots: SnapshotSlot[]): Promise<void> {
    if (busy || slots.length === 0) return;
    busy = true;
    cycleError = null;
    paint();
    try {
      const result = await sendToSw({ type: "snapshot-cycle", slots });
      if (result.ok) {
        const applied = applyCycle(state, slots, result);
        state = applied.state;
        restored = result.restored;
        deletePaths(applied.stale); // het vervangen pad hoort niet te blijven zweven
      } else {
        cycleError = { raw: result.error };
      }
    } catch {
      cycleError = { key: "panel.reload.retry" };
    } finally {
      busy = false;
      paint();
    }
  }

  // ── Rijen ───────────────────────────────────────────────────────────────
  function buildRow(slot: SnapshotSlot): SlotRow {
    let linkOpen = false;

    const toggle = el("button", {
      class: "by-toggle-btn by-snap-toggle",
      text: SLOT_LABELS[slot],
      attrs: { type: "button", "aria-pressed": "false" },
    });
    on(toggle, "click", () => setEnabled(slot, !state[slot].enabled));

    const linkInput = el("input", {
      class: "by-input by-snap-link",
      attrs: { type: "url", inputmode: "url" },
    });
    on(linkInput, "input", () => setLink(slot, linkInput.value));

    const linkBtn = el("button", { class: "by-icon", unsafeHtml: ICON_LINK, attrs: { type: "button" } });
    on(linkBtn, "click", () => {
      linkOpen = !linkOpen;
      // Dichtklappen = de link intrekken; dit slot gaat weer mee in de cyclus.
      if (!linkOpen && linkInput.value) {
        linkInput.value = "";
        setLink(slot, "");
        return;
      }
      paint();
      if (linkOpen) linkInput.focus();
    });

    const retryBtn = el("button", { class: "by-icon", unsafeHtml: ICON_REFRESH, attrs: { type: "button" } });
    on(retryBtn, "click", () => void runCycle([slot]));

    const status = el("p", { class: "by-snap-status" });

    // Preview van de laatste geslaagde capture (F3b-spec); puur decoratief,
    // het pad in de statusregel blijft de bron van waarheid.
    const thumbImg = el("img", { class: "by-snap-thumb", attrs: { alt: "" } }) as HTMLImageElement;
    thumbImg.hidden = true;

    const rowEl = el("div", { class: "by-snap", attrs: { "data-slot": slot } }, [
      el("div", { class: "by-snap-row" }, [toggle, linkBtn, retryBtn]),
      linkInput,
      status,
      thumbImg,
    ]);

    return {
      element: rowEl,
      update() {
        const current = state[slot];
        const hasLink = linkValue(current) !== null;

        linkInput.setAttribute("placeholder", t("snap.linkPlaceholder"));
        linkBtn.setAttribute("title", t("snap.linkTitle"));
        linkBtn.setAttribute("aria-label", t("snap.linkAria", { slot: SLOT_LABELS[slot] }));
        retryBtn.setAttribute("title", t("snap.retryTitle"));
        retryBtn.setAttribute("aria-label", t("snap.retryAria", { slot: SLOT_LABELS[slot] }));

        toggle.classList.toggle("is-active", current.enabled);
        toggle.setAttribute("aria-pressed", String(current.enabled));

        linkBtn.disabled = !current.enabled || busy;
        linkBtn.classList.toggle("is-on", linkOpen && current.enabled);
        linkInput.hidden = !current.enabled || !linkOpen;

        retryBtn.hidden = !current.enabled || hasLink;
        retryBtn.disabled = busy;

        const info = slotStatus(current);
        status.hidden = !current.enabled;
        status.className = `by-snap-status is-${info.kind}${info.kind === "ok" ? " by-mono" : ""}`;
        status.textContent = info.text;

        const thumb = current.enabled ? thumbOf(current) : null;
        thumbImg.hidden = !thumb;
        if (thumb && thumbImg.src !== thumb) thumbImg.src = thumb;
        else if (!thumb && thumbImg.src) thumbImg.removeAttribute("src");
      },
      clearLink() {
        linkOpen = false;
        linkInput.value = "";
      },
    };
  }

  for (const slot of SNAPSHOT_SLOTS) {
    const row = buildRow(slot);
    rows.set(slot, row);
    list.appendChild(row.element);
  }

  // ── Tekenen ─────────────────────────────────────────────────────────────
  function paint(): void {
    title.textContent = t("snap.title");
    intro.textContent = t("snap.intro");
    busyLine.textContent = t("snap.busyLine");

    for (const row of rows.values()) row.update();

    const auto = autoSlots(state);
    runBtn.disabled = busy || auto.length === 0;
    runBtn.textContent = busy ? t("snap.runBusy") : t("snap.run");
    busyLine.hidden = !busy;

    clear(notes);
    if (cycleError) {
      notes.appendChild(
        el("div", { class: "by-note is-warn", text: "key" in cycleError ? t(cycleError.key) : cycleError.raw })
      );
    }
    if (needsGesture(state)) {
      const retry = el("button", {
        class: "by-btn by-btn-ghost by-btn-sm",
        text: t("snap.retry"),
        attrs: { type: "button" },
      });
      retry.disabled = busy || auto.length === 0;
      on(retry, "click", () => void runCycle(autoSlots(state)));
      notes.appendChild(
        el("div", { class: "by-note is-gold is-stack" }, [
          el("span", { text: `${t("snap.gesture")}.` }),
          retry,
        ])
      );
    }
    if (!restored) {
      notes.appendChild(el("div", { class: "by-note is-warn", text: t("snap.notRestored") }));
    }
    if (!busy && auto.length === 0 && !cycleError) {
      notes.appendChild(el("p", { class: "by-hint", style: "margin:0;", text: t("snap.noneAuto") }));
    }
  }

  paint();
  // Taalwissel in de popup → deze sectie hertekent zichzelf; het abonnement
  // eindigt bij dispose(), samen met de rest van het paneel.
  const stopLangWatch = onLangChange(() => paint());

  // ── Haakjes voor panelApp ───────────────────────────────────────────────
  function fresh(): void {
    state = initialState(readEnabled());
    restored = true;
    cycleError = null;
    for (const row of rows.values()) row.clearLink();
    paint();
  }

  return {
    element,
    screenshots: () => screenshotsForRequest(state),
    consume: fresh,
    reset() {
      deletePaths(uploadedPaths(state)); // niets gelogd → wezen opruimen
      fresh();
    },
    dispose() {
      stopLangWatch();
      deletePaths(uploadedPaths(state));
    },
  };
}
