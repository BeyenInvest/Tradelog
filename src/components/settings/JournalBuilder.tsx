import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, ChevronUp, LayoutTemplate, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  ASSET_ORDER, STYLE_ORDER, STARTSETS,
  blocksInGroup, blockGroupLabel, blockLabel, blockToFieldInput,
  getBlock, findStartset, assetLabel, styleLabel, styleHint, assetInstrumentConfig,
  BLOCK_GROUP_ORDER, type AssetClass, type TradingStyle,
} from "@/lib/fieldBlocks";
import { slugifyFieldKey, parseFieldOptions } from "@/lib/methodologyFields";
import { useJournalBuilder } from "@/hooks/useJournalBuilder";
import type { FieldInput } from "@/hooks/useMethodologyEditor";
import type { MethodologyField } from "@/lib/types";

/**
 * The unified "new journal" screen (Fase G — preset redesign). A starter set
 * (asset × style) pre-ticks building blocks, which the user then adjusts in the
 * same screen — presets and hand-building merged into one flow. Replaces the old
 * PresetChooser grid + the "blank then fill the field editor" two-step.
 *
 * `reuseActiveIfEmpty`: onboarding / empty-state fill the account's existing empty
 * journal; Settings ("+ new journal") creates a fresh one. See useJournalBuilder.
 */
export function JournalBuilder({
  reuseActiveIfEmpty,
  onDone,
}: {
  reuseActiveIfEmpty: boolean;
  onDone?: (methodologyId: string) => void;
}) {
  const { t } = useTranslation();
  const { commit, busy, error } = useJournalBuilder();

  const [asset, setAsset] = useState<AssetClass | null>(null);
  const [style, setStyle] = useState<TradingStyle | null>(null);
  const [blank, setBlank] = useState(false);
  const [fields, setFields] = useState<FieldInput[]>([]);
  const [name, setName] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const addedKeys = useMemo(() => new Set(fields.map((f) => f.field_key)), [fields]);

  /** Apply a starter set: replace staged fields with its blocks, set name + asset. */
  function applyStartset(a: AssetClass, s: TradingStyle) {
    const set = findStartset(a, s);
    if (!set) return;
    setBlank(false);
    setAsset(a);
    setStyle(s);
    setFields(set.blockKeys.map((k) => getBlock(k)!).filter(Boolean).map((b) => blockToFieldInput(t, b)));
    setName(`${assetLabel(t, a)} — ${styleLabel(t, s)}`);
  }

  function chooseAsset(a: AssetClass) {
    if (style) applyStartset(a, style);
    else { setAsset(a); setBlank(false); }
  }
  function chooseStyle(s: TradingStyle) {
    if (asset) applyStartset(asset, s);
    else { setStyle(s); setBlank(false); }
  }
  function chooseBlank() {
    setBlank(true); setAsset(null); setStyle(null); setFields([]);
    setName(t("presets.blankJournalName"));
  }

  function toggleBlock(key: string) {
    const block = getBlock(key);
    if (!block) return;
    setFields((prev) =>
      prev.some((f) => f.field_key === key)
        ? prev.filter((f) => f.field_key !== key)
        : [...prev, blockToFieldInput(t, block)]
    );
  }
  function removeField(key: string) {
    setFields((prev) => prev.filter((f) => f.field_key !== key));
  }
  function moveField(idx: number, dir: "up" | "down") {
    const j = dir === "up" ? idx - 1 : idx + 1;
    if (j < 0 || j >= fields.length) return;
    setFields((prev) => {
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }
  function addCustomField(input: FieldInput) {
    setFields((prev) => [...prev, input]);
  }

  const started = blank || asset !== null || style !== null || fields.length > 0;
  const startsetName = asset && style ? `${assetLabel(t, asset)} — ${styleLabel(t, style)}` : null;
  const canStart = name.trim().length > 0 && !busy;

  async function start() {
    if (!canStart) return;
    try {
      const id = await commit({
        name: name.trim(),
        fields,
        assetClass: asset,
        instrumentConfig: asset ? assetInstrumentConfig(asset) : null,
        reuseActiveIfEmpty,
      });
      onDone?.(id);
    } catch {
      /* error surfaced via hook state */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---- step 1: starter set ---- */}
      <section className="flex flex-col gap-3">
        <StepLabel n="01" title={t("builder.startsetStep")} hint={t("builder.startsetOptional")} />
        <div className="flex flex-wrap items-center gap-2">
          {ASSET_ORDER.map((a) => (
            <Chip key={a} selected={asset === a} onClick={() => chooseAsset(a)}>
              <AssetIcon asset={a} /> {assetLabel(t, a)}
            </Chip>
          ))}
          <span className="font-mono text-xs text-faint px-1">{t("builder.or")}</span>
          <Chip selected={blank} onClick={chooseBlank}>{t("builder.blanco")}</Chip>
        </div>
        {(asset || style) && !blank && (
          <div className="flex flex-wrap gap-2">
            {STYLE_ORDER.map((s) => (
              <Chip key={s} selected={style === s} onClick={() => chooseStyle(s)}>
                {styleLabel(t, s)} <span className="text-muted text-xs">{styleHint(t, s)}</span>
              </Chip>
            ))}
          </div>
        )}
        {startsetName && (
          <p className="font-mono text-xs rounded-lg px-3 py-2 bg-gold/10 border border-gold/25 text-ink">
            {t("builder.applied", { name: startsetName, count: fields.length })}
          </p>
        )}
        {blank && (
          <p className="font-mono text-xs rounded-lg px-3 py-2 bg-surface-2 border border-border text-muted">
            {t("builder.appliedBlank")}
          </p>
        )}
      </section>

      {started && (
        <>
          {/* ---- step 2: palette ---- */}
          <section className="flex flex-col gap-3 border-t border-border-soft pt-5">
            <StepLabel n="02" title={t("builder.paletteStep")} hint={t("builder.paletteHint")} />
            {BLOCK_GROUP_ORDER.map((g) => (
              <div key={g} className="flex flex-col gap-2">
                <p className="font-mono text-[11px] uppercase tracking-wide text-faint">{blockGroupLabel(t, g)}</p>
                <div className="flex flex-wrap gap-2">
                  {blocksInGroup(g).map((b) => {
                    const on = addedKeys.has(b.key);
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => toggleBlock(b.key)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-body text-sm transition-colors ${
                          on
                            ? "border border-win/50 bg-win/10 text-ink"
                            : "border border-dashed border-border bg-surface-2 text-ink hover:border-gold"
                        }`}
                      >
                        <span className={on ? "text-win" : "text-gold"}>{on ? <Check size={13} /> : <Plus size={13} />}</span>
                        {blockLabel(t, b.key)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          {/* ---- step 3: your fields ---- */}
          <section className="flex flex-col gap-3 border-t border-border-soft pt-5">
            <StepLabel n="03" title={t("builder.yourFields")} />
            {fields.length === 0 ? (
              <p className="font-mono text-xs text-muted">{t("builder.yourFieldsEmpty")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {fields.map((f, i) => (
                  <div key={f.field_key} className="flex items-center gap-3 rounded-lg bg-bg border border-border px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm text-ink truncate">{f.label}</p>
                      {f.options && f.options.length > 0 && (
                        <p className="font-mono text-[11px] text-muted truncate">{f.options.join(" · ")}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted bg-surface-2 border border-border rounded-md px-2 py-0.5">
                      {t(`methodology.type_${f.field_type}`)}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0 text-muted">
                      <IconBtn label={t("methodology.moveUp")} disabled={i === 0} onClick={() => moveField(i, "up")}>
                        <ChevronUp size={14} />
                      </IconBtn>
                      <IconBtn label={t("methodology.moveDown")} disabled={i === fields.length - 1} onClick={() => moveField(i, "down")}>
                        <ChevronDown size={14} />
                      </IconBtn>
                      <IconBtn label={t("builder.removeField")} danger onClick={() => removeField(f.field_key)}>
                        <X size={14} />
                      </IconBtn>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* advanced: minimal custom field */}
            {!showAdvanced ? (
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="self-start font-body text-sm text-muted hover:text-ink inline-flex items-center gap-1.5"
              >
                <ChevronDown size={14} /> {t("builder.advanced")}
              </button>
            ) : (
              <CustomFieldAdd existingKeys={addedKeys} onAdd={addCustomField} onClose={() => setShowAdvanced(false)} />
            )}
          </section>

          {/* ---- commit ---- */}
          <section className="flex flex-col gap-3 border-t border-border-soft pt-5">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[11px] text-muted">{t("builder.nameLabel")}</span>
              <input
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("builder.namePlaceholder")}
                className="input"
              />
            </label>
            {error && <p className="font-mono text-[11px] text-loss">{error}</p>}
            <button
              type="button"
              onClick={() => void start()}
              disabled={!canStart}
              className="self-start px-5 py-2.5 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40"
            >
              {busy ? t("builder.creating") : t("builder.start")}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

function StepLabel({ n, title, hint }: { n: string; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="font-mono text-xs text-gold">{n}</span>
      <span className="font-body text-sm font-semibold text-ink">{title}</span>
      {hint && <span className="font-body text-xs text-muted">— {hint}</span>}
    </div>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-body text-sm transition-colors ${
        selected ? "border border-gold bg-gold/12 text-ink" : "border border-border bg-surface-2 text-ink hover:border-gold"
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, label, onClick, disabled, danger }: {
  children: ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`p-1.5 rounded-md hover:bg-ink/5 disabled:opacity-30 disabled:cursor-not-allowed ${danger ? "hover:text-loss" : "hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

/** Minimal add-your-own-field form for the builder — label + friendly type + options.
 *  The full-power editor (conditions, groups, required) stays in Settings' MethodologyEditor. */
function CustomFieldAdd({ existingKeys, onAdd, onClose }: {
  existingKeys: Set<string>; onAdd: (f: FieldInput) => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<MethodologyField["field_type"]>("enum");
  const [optionsRaw, setOptionsRaw] = useState("");

  const key = slugifyFieldKey(label);
  const duplicate = label.trim().length > 0 && existingKeys.has(key);
  const canAdd = label.trim().length > 0 && !duplicate && (type !== "enum" || parseFieldOptions(optionsRaw).length > 0);

  function add() {
    if (!canAdd) return;
    onAdd({
      field_key: key,
      label: label.trim(),
      label_key: null, // custom field — the free-text label is the only source (no render-time translation)
      field_type: type,
      options: type === "enum" ? parseFieldOptions(optionsRaw) : null,
      required: false,
      group_label: null,
      group_key: null,
      show_when_field_id: null,
      show_when_values: null,
    });
    setLabel(""); setOptionsRaw(""); setType("enum");
  }

  const TYPES: MethodologyField["field_type"][] = ["enum", "boolean", "number", "text", "date"];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-surface-2/40 p-3">
      <div className="flex flex-col gap-1">
        <label className="font-mono text-[11px] text-muted">{t("methodology.fieldLabel")}</label>
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("methodology.labelPlaceholder")} className="input" autoFocus />
        {duplicate && <p className="font-mono text-[10px] text-loss">{t("methodology.duplicateKey")}</p>}
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[11px] text-muted">{t("methodology.fieldType")}</label>
          <select value={type} onChange={(e) => setType(e.target.value as MethodologyField["field_type"])}
            className="rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold">
            {TYPES.map((ft) => <option key={ft} value={ft}>{t(`methodology.type_${ft}`)}</option>)}
          </select>
        </div>
        {type === "enum" && (
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="font-mono text-[11px] text-muted">{t("methodology.fieldOptions")}</label>
            <input type="text" value={optionsRaw} onChange={(e) => setOptionsRaw(e.target.value)} placeholder={t("methodology.optionsPlaceholder")} className="input" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={add} disabled={!canAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-body text-sm font-medium bg-gold text-on-gold disabled:opacity-40">
          <Plus size={14} /> {t("methodology.add")}
        </button>
        <button type="button" onClick={onClose}
          className="px-4 py-2 rounded-lg font-body text-sm font-medium border border-border text-muted hover:text-ink">
          {t("methodology.cancel")}
        </button>
      </div>
    </div>
  );
}

function AssetIcon({ asset }: { asset: AssetClass }) {
  const p = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2 } as const;
  switch (asset) {
    case "forex":
      return <svg {...p}><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" strokeLinecap="round" /></svg>;
    case "futures":
      return <svg {...p}><path d="M4 18V9M9 18V5M14 18v-6M19 18v-9" strokeLinecap="round" /></svg>;
    case "stock":
      return <svg {...p}><path d="M4 20h16M6 20V9M12 20V4M18 20v-7" strokeLinecap="round" /></svg>;
    case "crypto":
      return <svg {...p}><circle cx="12" cy="12" r="8" /><path d="M9 9h4.5a1.5 1.5 0 010 3H9m5-3a1.5 1.5 0 010 3M9 12h5a1.5 1.5 0 010 3H9m2-8v2m0 6v2" strokeLinecap="round" /></svg>;
  }
}

/**
 * Collapsible "New journal" card for Settings — the builder wrapped in the same
 * chrome the old PresetPicker had, so the journal-switcher's "+ New journal"
 * (route state → defaultOpen) still lands somewhere that completes its intent.
 * Creates a fresh journal (reuseActiveIfEmpty=false), unlike onboarding.
 */
export function NewJournalCard({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen) anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [defaultOpen]);

  return (
    <div ref={anchorRef} className="scroll-mt-4">
      <Card>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
          aria-expanded={open}
        >
          <div className="flex items-start gap-3 min-w-0">
            <LayoutTemplate size={18} className="mt-0.5 shrink-0 text-gold" />
            <div className="min-w-0">
              <p className="font-body text-sm text-ink">{t("builder.newJournal")}</p>
              <p className="font-mono text-xs mt-1 text-muted">{t("builder.overviewSubtitle")}</p>
            </div>
          </div>
          {open ? <ChevronUp size={16} className="shrink-0 text-muted" /> : <ChevronDown size={16} className="shrink-0 text-muted" />}
        </button>
        {open && (
          <div className="mt-4 border-t border-border-soft pt-4">
            <JournalBuilder reuseActiveIfEmpty={false} onDone={() => setOpen(false)} />
          </div>
        )}
      </Card>
    </div>
  );
}

// Keep STARTSETS referenced for potential grouped-overview consumers — re-exported for convenience.
export { STARTSETS };
