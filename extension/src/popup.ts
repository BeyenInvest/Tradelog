// Popup: status, koppelen, taalkeuze, diagnose. Presentatie draait op hetzelfde
// beyen-thema als het in-page paneel (F2d) — vandaar de css-imports hier: in de
// Vite-bundel zijn dat echte stylesheets (in de esbuild-content-bundel is een
// css-import tekst, zie css.d.ts).
//
// Copy komt sinds F4b uit i18nExt: applyStatic() vult elk [data-i18n]-element
// in popup.html, de dynamische zinnen lopen via t(). De NL/EN-schakelaar hier is
// de enige plek waar de taal gezet wordt — het paneel op TradingView volgt via
// chrome.storage.onChanged.
import "./theme.css";
import "./popup.css";
import { markSvg } from "./content/ui/icons";
import { ensureLang, getLang, LANGS, onLangChange, saveLang, t, type Lang, type MessageKey } from "./i18nExt";
import { sendToSw } from "./messages";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`popup: element #${id} ontbreekt`);
  return node as T;
}

const statusEl = el<HTMLDivElement>("status");
const linkSection = el<HTMLElement>("linkSection");
const linkedSection = el<HTMLElement>("linkedSection");
const tokenInput = el<HTMLInputElement>("token");
const langGroup = el<HTMLDivElement>("lang");
const out = el<HTMLPreElement>("out");

el<HTMLSpanElement>("mark").innerHTML = markSvg(18);

/** Laatst bekende status; nodig om de statusregel te hertalen zonder de service
 * worker opnieuw wakker te maken bij een taalwissel. */
let linkedEmail: string | null | undefined;

// ── Taal ────────────────────────────────────────────────────────────────────

function applyStatic(): void {
  document.documentElement.lang = getLang();
  document.title = t("popup.docTitle");
  langGroup.setAttribute("aria-label", t("popup.langLabel"));
  for (const node of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n as MessageKey);
  }
  for (const node of document.querySelectorAll<HTMLElement>("[data-i18n-placeholder]")) {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder as MessageKey));
  }
  paintStatus();
  paintLangButtons();
}

const langButtons = new Map<Lang, HTMLButtonElement>();
for (const lang of LANGS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "popup-lang-btn";
  button.textContent = lang.toUpperCase();
  button.addEventListener("click", () => void saveLang(lang));
  langGroup.appendChild(button);
  langButtons.set(lang, button);
}

function paintLangButtons(): void {
  for (const [lang, button] of langButtons) {
    const active = lang === getLang();
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

// ── Status ──────────────────────────────────────────────────────────────────

function paintStatus(): void {
  if (linkedEmail === undefined) {
    statusEl.textContent = t("popup.statusLoading");
    statusEl.classList.remove("is-linked");
    return;
  }
  const linked = linkedEmail !== null;
  statusEl.textContent = linked
    ? t("popup.statusLinked", { email: linkedEmail ?? "" })
    : t("popup.statusNotLinked");
  statusEl.classList.toggle("is-linked", linked);
  linkSection.hidden = linked;
  linkedSection.hidden = !linked;
}

function showOutput(value: unknown): void {
  out.hidden = false;
  out.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function refreshStatus(): Promise<void> {
  const status = await sendToSw({ type: "status" });
  linkedEmail = status.linked ? status.email ?? "" : null;
  paintStatus();
}

// ── Acties ──────────────────────────────────────────────────────────────────

el<HTMLButtonElement>("linkBtn").addEventListener("click", () => {
  void (async () => {
    statusEl.textContent = t("popup.statusLinking");
    const result = await sendToSw({ type: "link", tokenHash: tokenInput.value });
    if (result.ok) {
      tokenInput.value = "";
      out.hidden = true;
    } else {
      showOutput(t("popup.error", { detail: result.error }));
    }
    await refreshStatus();
  })();
});

el<HTMLButtonElement>("chartBtn").addEventListener("click", () => {
  void (async () => {
    const result = await sendToSw({ type: "chart-state" });
    showOutput(result);
  })();
});

el<HTMLButtonElement>("dumpBtn").addEventListener("click", () => {
  void (async () => {
    const dump = await sendToSw({ type: "journal-dump" });
    showOutput(dump);
  })();
});

el<HTMLButtonElement>("logBtn").addEventListener("click", () => {
  void (async () => {
    const { entries } = await sendToSw({ type: "diag-log" });
    showOutput(entries);
  })();
});

el<HTMLButtonElement>("unlinkBtn").addEventListener("click", () => {
  void (async () => {
    await sendToSw({ type: "unlink" });
    out.hidden = true;
    await refreshStatus();
  })();
});

onLangChange(applyStatic);
applyStatic();
void ensureLang().then(applyStatic);
void refreshStatus();
