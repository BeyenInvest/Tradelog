// In-page paneel (F2d) — isolated-world content script, gebundeld als IIFE.
// Shadow DOM zodat beyen-thema en TV-CSS elkaar nooit raken. Praat met de SW
// via het getypeerde berichtenschema (sendToSw) en met de page-world alleen
// indirect (SW → bridge). De UI-invulling is Opus-werk; de host/tooling hier
// is bewust minimaal en van Fable.
import themeCss from "../theme.css";
import { sendToSw } from "../messages";

const HOST_ID = "beyen-tv-panel-host";

function mount(): void {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "position:fixed;top:72px;right:16px;z-index:2147483000;";
  const root = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = themeCss;
  root.appendChild(style);

  const card = document.createElement("div");
  card.className = "by-card";
  card.style.cssText = "padding:12px;width:300px;";
  card.innerHTML = `
    <div class="by-title" style="font-size:16px;">Beyen <span class="by-badge">beta</span></div>
    <p class="by-muted" style="margin:6px 0 10px;">Log deze chart in je journal.</p>
    <button class="by-btn" id="read">Lees chart</button>
    <pre class="by-mono by-hint" id="out" style="white-space:pre-wrap;max-height:220px;overflow:auto;"></pre>
  `;
  root.appendChild(card);

  root.getElementById("read")?.addEventListener("click", () => {
    void (async () => {
      const res = await sendToSw({ type: "chart-state" });
      const out = root.getElementById("out");
      if (out) out.textContent = JSON.stringify(res, null, 2);
    })();
  });

  document.documentElement.appendChild(host);
}

mount();
