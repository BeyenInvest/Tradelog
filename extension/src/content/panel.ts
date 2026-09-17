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

  function reclamp(): void {
    if (!customPos) return;
    const rect = host.getBoundingClientRect();
    applyPos(
      clampLauncherPos(customPos, { w: rect.width, h: rect.height }, { w: window.innerWidth, h: window.innerHeight })
    );
  }

  void chrome.storage.local.get(LAUNCHER_POS_KEY).then((stored) => {
    const pos = parseStoredPos(stored[LAUNCHER_POS_KEY]);
    if (pos) {
      applyPos(pos);
      reclamp(); // een kleiner venster dan bij het opslaan → terug in beeld
    }
  });
  window.addEventListener("resize", reclamp);

  let dragged = false;

  /** Sleep de host aan `handle`. Geldt voor het bolletje én (via de titelbalk)
   * het geopende paneel — één mechaniek, één opgeslagen positie. */
  function startDrag(event: PointerEvent, handle: HTMLElement): void {
    if (event.button !== 0) return;
    const rect = host.getBoundingClientRect();
    const offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const start = { x: event.clientX, y: event.clientY };
    dragged = false;
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
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }

  launcher.addEventListener("pointerdown", (event) => startDrag(event, launcher));

  // Het open paneel sleept aan zijn titelbalk (.by-head), maar niet aan de
  // knoppen erin — die houden hun klik. Gedelegeerd op de slot zodat het blijft
  // werken als panelApp de kop opnieuw tekent.
  slot.addEventListener("pointerdown", (event) => {
    const target = event.target as Element | null;
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
    if (dragged) {
      event.preventDefault();
      dragged = false;
      return;
    }
    open();
  });

  // TV luistert op document-niveau mee: onze toetsen en ons scrollen blijven
  // binnen het paneel.
  for (const type of ["keydown", "keyup", "keypress"] as const) {
    host.addEventListener(type, (event) => {
      if (type === "keydown" && (event as KeyboardEvent).key === "Escape" && app) close();
      event.stopPropagation();
    });
  }
  for (const type of ["wheel", "mousedown", "pointerdown", "touchstart"] as const) {
    host.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
  }

  document.documentElement.appendChild(host);
}

mount();
