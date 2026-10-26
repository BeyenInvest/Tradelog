// In-page paneel (F2d) — isolated-world content script, gebundeld als IIFE.
// Dit bestand is alleen de HOST: shadow root, thema, en de wissel tussen de
// launcher-knop en het paneel. De inhoud leeft in ui/panelApp.ts.
//
// Shadow DOM zodat beyen-thema en TV-CSS elkaar nooit raken; daarbovenop
// stoppen we toetsaanslagen en scroll aan de rand van de host, want TradingView
// luistert globaal mee (typen in ons formulier zou anders TV-sneltoetsen
// afvuren en scrollen zou de chart zoomen).
import themeCss from "../theme.css";
import panelCss from "./ui/panel.css";
import { ensureLang, onLangChange, t } from "../i18nExt";
import { markSvg } from "./ui/icons";
import {
  clampLauncherPos, isDrag, LAUNCHER_POS_KEY, parseStoredPos, type LauncherPos,
} from "./ui/launcherDrag";
import { mountPanelApp, type PanelApp } from "./ui/panelApp";
import { clampPanelSize, PANEL_SIZE_KEY, parseStoredSize, type PanelSize } from "./ui/panelSize";

const HOST_ID = "beyen-tv-panel-host";

function mount(): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;top:72px;right:16px;z-index:2147483000;";
  // "closed": de TV-pagina (vijandige wereld) kan de root dan niet via
  // host.shadowRoot bereiken — geen uitlezen van journal-labels/notities en
  // geen synthetische clicks op "Log trade" (security-review F4a). De referentie
  // leeft alleen in deze closure. Alleen de dev-harnas-build (build:ext:dev,
  // compile-time define — dood pad in prod) opent 'm voor DOM-inspectie.
  const root = host.attachShadow({ mode: __BEYEN_HARNESS__ ? "open" : "closed" });

  const style = document.createElement("style");
  style.textContent = `${themeCss}\n${panelCss}`;
  root.appendChild(style);

  const slot = document.createElement("div");
  root.appendChild(slot);

  const launcher = document.createElement("button");
  launcher.className = "by-launcher";
  launcher.type = "button";
  launcher.innerHTML = markSvg(20);
  root.appendChild(launcher);

  // De taal staat in chrome.storage; ze is er ruim voor de eerste klik op de
  // launcher, dus het paneel opent nooit in de verkeerde taal.
  function paintLauncher(): void {
    launcher.title = t("panel.launcher");
    launcher.setAttribute("aria-label", t("panel.launcher"));
  }
  paintLauncher();
  void ensureLang().then(paintLauncher);
  onLangChange(paintLauncher);

  let app: PanelApp | null = null;

  // ── Versleepbaar bolletje ────────────────────────────────────────────────
  // De positie geldt voor de hele host (bolletje én paneel) en wordt in
  // chrome.storage.local bewaard, zodat hij op elke chart-tab hetzelfde staat.
  let customPos: LauncherPos | null = null;

  function applyPos(pos: LauncherPos): void {
    customPos = pos;
    host.style.left = `${pos.x}px`;
    host.style.top = `${pos.y}px`;
    host.style.right = "auto";
  }

  // ── Paneelmaat (resize-greepjes) ─────────────────────────────────────────
  // Gezet als custom properties op de host; die erven door de shadow root heen
  // naar .by-panel (panel.css). null = standaardmaat. Ook in storage.local.
  let panelSize: PanelSize | null = null;

  function applySize(size: PanelSize | null): void {
    panelSize = size;
    if (size) {
      host.style.setProperty("--by-panel-w", `${size.w}px`);
      host.style.setProperty("--by-panel-h", `${size.h}px`);
    } else {
      host.style.removeProperty("--by-panel-w");
      host.style.removeProperty("--by-panel-h");
    }
  }

  function reclamp(): void {
    // Een kleiner venster dan toen de maat gekozen werd → paneel krimpt mee
    // (niet opgeslagen: wordt het venster weer groter, dan blijft de keuze).
    if (panelSize) {
      const fitted = clampPanelSize(panelSize, { w: window.innerWidth - 16, h: window.innerHeight - 16 });
      if (fitted.w !== panelSize.w || fitted.h !== panelSize.h) applySize(fitted);
    }
    if (!customPos) return;
    const rect = host.getBoundingClientRect();
    applyPos(
      clampLauncherPos(customPos, { w: rect.width, h: rect.height }, { w: window.innerWidth, h: window.innerHeight })
    );
  }

  void chrome.storage.local.get([LAUNCHER_POS_KEY, PANEL_SIZE_KEY]).then((stored) => {
    const size = parseStoredSize(stored[PANEL_SIZE_KEY]);
    if (size) applySize(size);
    const pos = parseStoredPos(stored[LAUNCHER_POS_KEY]);
    if (pos) applyPos(pos);
    reclamp(); // een kleiner venster dan bij het opslaan → terug in beeld
  });
  window.addEventListener("resize", reclamp);

  /** Alleen de klik die een LAUNCHER-sleep afsluit mag het paneel niet openen;
   * een titelbalk-sleep zet deze vlag dus nooit. Reset in de click-handler én
   * bij elke nieuwe pointerdown, zodat een toetsenbord-klik (Enter/Spatie, géén
   * pointerdown vooraf) nooit door een oude sleep opgeslokt wordt. */
  let suppressLauncherClick = false;

  /** Sleep de host aan `handle`. Geldt voor het bolletje én (via de titelbalk)
   * het geopende paneel — één mechaniek, één opgeslagen positie. */
  function startDrag(event: PointerEvent, handle: HTMLElement): void {
    if (event.button !== 0) return;
    const rect = host.getBoundingClientRect();
    const offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const start = { x: event.clientX, y: event.clientY };
    let dragged = false;
    suppressLauncherClick = false;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // geen actieve pointer (bv. synthetische events) — slepen kan dan niet,
      // maar de klik mag nooit sneuvelen
    }

    const onMove = (ev: PointerEvent): void => {
      if (!dragged && !isDrag(ev.clientX - start.x, ev.clientY - start.y)) return;
      dragged = true;
      handle.classList.add("is-dragging");
      applyPos(
        clampLauncherPos(
          { x: ev.clientX - offset.x, y: ev.clientY - offset.y },
          { w: rect.width, h: rect.height },
          { w: window.innerWidth, h: window.innerHeight }
        )
      );
    };
    const onUp = (): void => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      handle.classList.remove("is-dragging");
      if (dragged && customPos) {
        void chrome.storage.local.set({ [LAUNCHER_POS_KEY]: customPos });
      }
      suppressLauncherClick = dragged && handle === launcher;
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  launcher.addEventListener("pointerdown", (event) => startDrag(event, launcher));

  /** Vergroot/verklein het open paneel aan een hoek-greepje. De rechter-greep
   * houdt de linkerrand vast, de linker-greep de rechterrand (het paneel staat
   * standaard rechts op de chart, dus daar groeit het naar links). */
  function startResize(event: PointerEvent, grip: HTMLElement): void {
    if (event.button !== 0) return;
    const panel = grip.closest(".by-panel");
    if (!panel) return;
    event.preventDefault(); // geen tekstselectie tijdens het slepen
    const rect = panel.getBoundingClientRect();
    const fromLeft = grip.classList.contains("is-left");
    const start = { x: event.clientX, y: event.clientY };
    const margin = 8;
    // Vanaf nu op left/top verankerd (standaard staat de host op right:16px).
    applyPos({ x: rect.left, y: rect.top });
    try {
      grip.setPointerCapture(event.pointerId);
    } catch {
      // geen actieve pointer (synthetisch event) — dan geen resize
    }
    grip.classList.add("is-dragging");

    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - start.x;
      const size = clampPanelSize(
        { w: rect.width + (fromLeft ? -dx : dx), h: rect.height + (ev.clientY - start.y) },
        {
          w: fromLeft ? rect.right - margin : window.innerWidth - rect.left - margin,
          h: window.innerHeight - rect.top - margin,
        }
      );
      applySize(size);
      if (fromLeft) applyPos({ x: rect.right - size.w, y: rect.top });
    };
    const onUp = (): void => {
      grip.removeEventListener("pointermove", onMove);
      grip.removeEventListener("pointerup", onUp);
      grip.removeEventListener("pointercancel", onUp);
      grip.classList.remove("is-dragging");
      reclamp();
      if (panelSize) void chrome.storage.local.set({ [PANEL_SIZE_KEY]: panelSize, [LAUNCHER_POS_KEY]: customPos });
    };
    grip.addEventListener("pointermove", onMove);
    grip.addEventListener("pointerup", onUp);
    grip.addEventListener("pointercancel", onUp);
  }

  // Dubbelklik op een greepje = terug naar de standaardmaat.
  slot.addEventListener("dblclick", (event) => {
    if (!(event.target as Element | null)?.closest?.(".by-resize")) return;
    applySize(null);
    void chrome.storage.local.remove(PANEL_SIZE_KEY);
    requestAnimationFrame(reclamp);
  });

  // Het open paneel sleept aan zijn titelbalk (.by-head), maar niet aan de
  // knoppen erin — die houden hun klik. Gedelegeerd op de slot zodat het blijft
  // werken als panelApp de kop opnieuw tekent.
  slot.addEventListener("pointerdown", (event) => {
    const target = event.target as Element | null;
    const grip = target?.closest?.(".by-resize");
    if (grip) {
      startResize(event, grip as HTMLElement);
      return;
    }
    const head = target?.closest?.(".by-head");
    if (!head || target?.closest?.("button, a, input, select, textarea")) return;
    startDrag(event, head as HTMLElement);
  });

  function open(): void {
    if (app) return;
    launcher.hidden = true;
    app = mountPanelApp(slot, { onClose: close });
    // Het paneel is groter dan het bolletje: een versleepte host bij de rand
    // zou het deels buiten beeld zetten — even opnieuw klemmen op paneelmaat.
    requestAnimationFrame(reclamp);
  }

  function close(): void {
    app?.destroy();
    app = null;
    launcher.hidden = false;
    launcher.focus();
    requestAnimationFrame(reclamp);
  }

  launcher.addEventListener("click", (event) => {
    // De klik die een sleep afsluit mag het paneel niet openen.
    if (suppressLauncherClick) {
      event.preventDefault();
      suppressLauncherClick = false;
      return;
    }
    open();
  });

  // TV luistert op document-niveau mee: onze toetsen en ons scrollen blijven
  // binnen het paneel.
  for (const type of ["keydown", "keyup", "keypress"] as const) {
    host.addEventListener(type, (event) => {
      if (type === "keydown" && (event).key === "Escape" && app) close();
      event.stopPropagation();
    });
  }
  for (const type of ["wheel", "mousedown", "pointerdown", "touchstart"] as const) {
    host.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
  }

  document.documentElement.appendChild(host);
}

mount();
