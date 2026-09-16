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
const out = el<HTMLPreElement>("out");

function showOutput(value: unknown): void {
  out.hidden = false;
  out.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function refreshStatus(): Promise<void> {
  const status = await sendToSw({ type: "status" });
  if (status.linked) {
    statusEl.textContent = `Gekoppeld als ${status.email}`;
    statusEl.classList.add("linked");
  } else {
    statusEl.textContent = "Niet gekoppeld";
    statusEl.classList.remove("linked");
  }
  linkSection.hidden = status.linked;
  linkedSection.hidden = !status.linked;
}

el<HTMLButtonElement>("linkBtn").addEventListener("click", () => {
  void (async () => {
    statusEl.textContent = "Koppelen…";
    const result = await sendToSw({ type: "link", tokenHash: tokenInput.value });
    if (result.ok) {
      tokenInput.value = "";
      out.hidden = true;
    } else {
      showOutput(`FOUT: ${result.error}`);
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

void refreshStatus();
