// Eerste-run-hint bovenin het paneel (F4b). Drie stappen, één keer weg te
// klikken; de keuze staat in chrome.storage.local onder `onboardingDismissed`,
// zodat ze over alle TV-tabs en over een herstart heen geldt (sessionStorage —
// waar het paneel z'n doel-keuze bewaart — zou 'm elke tab opnieuw tonen).
//
// Bewust géén modal: het paneel is zelf al een overlay op TradingView, en een
// modal daarbovenop zou de chart tweemaal blokkeren. Dit is een kaartje in de
// gewone lees-volgorde, dat na "Begrepen" nooit meer terugkomt.
import { t } from "../../i18nExt";
import { el, on } from "./dom";
import { ICON_CLOSE } from "./icons";

const DISMISSED_KEY = "onboardingDismissed";

/** Heeft de user de hint al weggeklikt? Faalt de opslag, dan tonen we 'm niet
 * (liever één keer te weinig uitleg dan een kaartje dat elke keer terugkomt). */
export async function isOnboardingDismissed(): Promise<boolean> {
  try {
    const record = await chrome.storage.local.get(DISMISSED_KEY);
    return record[DISMISSED_KEY] === true;
  } catch {
    return true;
  }
}

export function dismissOnboarding(): void {
  try {
    void chrome.storage.local.set({ [DISMISSED_KEY]: true });
  } catch {
    /* best-effort: binnen deze paneel-sessie is de kaart sowieso al weg */
  }
}

/**
 * Het kaartje zelf. `onDismiss` laat het paneel beslissen wat er met de ruimte
 * gebeurt (opnieuw tekenen), zodat dit bestand niets van de paneel-opbouw weet.
 */
export function renderOnboardingCard(onDismiss: () => void): HTMLElement {
  const close = el("button", {
    class: "by-icon",
    unsafeHtml: ICON_CLOSE,
    attrs: { type: "button", title: t("onb.dismiss"), "aria-label": t("onb.dismiss") },
  });
  on(close, "click", () => {
    dismissOnboarding();
    onDismiss();
  });

  const steps = el("ol", { class: "by-onb-steps" });
  for (const key of ["onb.step1", "onb.step2", "onb.step3"] as const) {
    steps.appendChild(el("li", { text: t(key) }));
  }

  const dismissBtn = el("button", {
    class: "by-btn by-btn-ghost by-btn-sm",
    text: t("onb.dismiss"),
    attrs: { type: "button" },
  });
  on(dismissBtn, "click", () => {
    dismissOnboarding();
    onDismiss();
  });

  return el("div", { class: "by-onb" }, [
    el("div", { class: "by-onb-head" }, [
      el("span", { class: "by-onb-title", text: t("onb.title") }),
      el("span", { class: "by-spacer" }),
      close,
    ]),
    steps,
    el("div", { class: "by-onb-foot" }, [dismissBtn]),
  ]);
}
