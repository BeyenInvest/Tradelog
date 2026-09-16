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
import { markSvg } from "./ui/icons";
import { mountPanelApp, type PanelApp } from "./ui/panelApp";

const HOST_ID = "beyen-tv-panel-host";

function mount(): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;top:72px;right:16px;z-index:2147483000;";
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `${themeCss}\n${panelCss}`;
  root.appendChild(style);

  const slot = document.createElement("div");
  root.appendChild(slot);

  const launcher = document.createElement("button");
  launcher.className = "by-launcher";
  launcher.type = "button";
  launcher.title = "Beyen — trade loggen";
  launcher.setAttribute("aria-label", "Beyen — trade loggen");
  launcher.innerHTML = markSvg(20);
  root.appendChild(launcher);

  let app: PanelApp | null = null;

  function open(): void {
    if (app) return;
    launcher.hidden = true;
    app = mountPanelApp(slot, { onClose: close });
  }

  function close(): void {
    app?.destroy();
    app = null;
    launcher.hidden = false;
    launcher.focus();
  }

  launcher.addEventListener("click", open);

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
