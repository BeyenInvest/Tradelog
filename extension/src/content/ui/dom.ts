// Minimale DOM-helpers voor het paneel. Geen framework (plan: vanilla TS in de
// content-script-bundel) — alleen genoeg suiker om de opbouw leesbaar te houden.

export interface ElOptions {
  class?: string;
  text?: string;
  attrs?: Record<string, string>;
  style?: string;
  /** Alleen voor eigen, constante SVG-iconen (icons.ts) — nooit voor data. */
  unsafeHtml?: string;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElOptions = {},
  children: (Node | null | undefined)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text != null) node.textContent = options.text;
  if (options.unsafeHtml != null) node.innerHTML = options.unsafeHtml;
  if (options.style) node.setAttribute("style", options.style);
  for (const [k, v] of Object.entries(options.attrs ?? {})) node.setAttribute(k, v);
  for (const child of children) if (child) node.appendChild(child);
  return node;
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Zet `hidden` zonder de rest van de node aan te raken (behoudt focus/scroll). */
export function setHidden(node: HTMLElement, hidden: boolean): void {
  node.hidden = hidden;
}

export function on<K extends keyof HTMLElementEventMap>(
  node: HTMLElement,
  type: K,
  handler: (ev: HTMLElementEventMap[K]) => void
): void {
  node.addEventListener(type, handler);
}
