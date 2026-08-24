import type { TFunction } from "i18next";
import type { FieldInput } from "@/hooks/useMethodologyEditor";
import type { MethodologyField } from "./types";

/**
 * The building-block catalogue for the unified journal builder (Fase G — preset
 * redesign, 2026-08). A "startset" is no longer a separate DB preset card the user
 * forks; it is simply a named list of these blocks pre-ticked in the builder. The
 * user assembles a journal by toggling blocks, then tweaks in the same screen.
 *
 * Each block is a ready-made custom field: a stable `key` (→ trades.custom + the
 * methodology_fields.field_key), a display group, a field type, and — for enums —
 * an option list. Labels and options are i18n keys resolved through `blockField()`
 * at apply time, so the palette itself is translatable. (The written label is
 * frozen in the creation-language for now; true per-render re-translation via a
 * label_key column is a separate data-layer step — see the redesign memo.)
 *
 * Keys deliberately reuse the ones the old seed migrations (0027/0028) used
 * (`setup`, `timeframe`, `emotion`, …) so nothing about the trades.custom bag or
 * the analysis breakdowns changes shape.
 */

export type BlockGroup = "setup" | "markt" | "mindset";

export interface FieldBlock {
  /** Stable field_key written into methodology_fields + trades.custom. */
  key: string;
  group: BlockGroup;
  field_type: MethodologyField["field_type"];
  /** enum blocks carry an option list under blocks.<key>.options; others don't. */
  hasOptions: boolean;
}

/** The catalogue — every block a startset can pre-tick or a user can add by hand. */
export const FIELD_BLOCKS: FieldBlock[] = [
  // — Setup & execution —
  { key: "setup", group: "setup", field_type: "enum", hasOptions: true },
  { key: "timeframe", group: "setup", field_type: "enum", hasOptions: true },
  { key: "market_condition", group: "setup", field_type: "enum", hasOptions: true },
  { key: "quality", group: "setup", field_type: "enum", hasOptions: true },
  { key: "direction_note", group: "setup", field_type: "enum", hasOptions: true },
  // — ICT / SMC (smart-money concepts) — a distinct vocabulary the generic setup
  //   blocks don't capture; pre-ticked by the ict_smc strategy startset, but each
  //   block is also free to add to any journal by hand.
  { key: "ict_setup", group: "setup", field_type: "enum", hasOptions: true },
  { key: "market_structure", group: "setup", field_type: "enum", hasOptions: true },
  { key: "pd_array", group: "setup", field_type: "enum", hasOptions: true },
  { key: "entry_model", group: "setup", field_type: "enum", hasOptions: true },
  // — Market —
  { key: "session", group: "markt", field_type: "enum", hasOptions: true },
  { key: "htf_bias", group: "markt", field_type: "enum", hasOptions: true },
  { key: "news", group: "markt", field_type: "boolean", hasOptions: false },
  { key: "sector", group: "markt", field_type: "enum", hasOptions: true },
  { key: "market_cap", group: "markt", field_type: "enum", hasOptions: true },
  { key: "catalyst", group: "markt", field_type: "enum", hasOptions: true },
  { key: "contracts", group: "markt", field_type: "number", hasOptions: false },
  { key: "contract_type", group: "markt", field_type: "enum", hasOptions: true },
  { key: "hours", group: "markt", field_type: "enum", hasOptions: true },
  { key: "market_type", group: "markt", field_type: "enum", hasOptions: true },
  { key: "leverage", group: "markt", field_type: "number", hasOptions: false },
  { key: "market_regime", group: "markt", field_type: "enum", hasOptions: true },
  { key: "targets", group: "markt", field_type: "text", hasOptions: false },
  // — Mindset & discipline —
  { key: "emotion", group: "mindset", field_type: "enum", hasOptions: true },
  { key: "mistake", group: "mindset", field_type: "enum", hasOptions: true },
  { key: "followed_plan", group: "mindset", field_type: "boolean", hasOptions: false },
];

const BLOCK_BY_KEY = new Map(FIELD_BLOCKS.map((b) => [b.key, b]));

export function getBlock(key: string): FieldBlock | undefined {
  return BLOCK_BY_KEY.get(key);
}

export const BLOCK_GROUP_ORDER: BlockGroup[] = ["setup", "markt", "mindset"];

/** Blocks of one group, in catalogue order — for rendering the palette per section. */
export function blocksInGroup(group: BlockGroup): FieldBlock[] {
  return FIELD_BLOCKS.filter((b) => b.group === group);
}

/** Human group heading for the palette + the written group_label. */
export function blockGroupLabel(t: TFunction, group: BlockGroup): string {
  return t(`blocks.groups.${group}`);
}

/** Translated display label of a block (also what gets written to methodology_fields.label). */
export function blockLabel(t: TFunction, key: string): string {
  return t(`blocks.items.${key}.label`);
}

/** Translated option list of an enum block (empty for non-enum). */
export function blockOptions(t: TFunction, block: FieldBlock): string[] {
  if (!block.hasOptions) return [];
  const opts = t(`blocks.items.${block.key}.options`, { returnObjects: true }) as unknown;
  return Array.isArray(opts) ? (opts as string[]) : [];
}

/** Turn a block into a ready-to-insert field payload (no condition — startset fields are unconditional). */
export function blockToFieldInput(t: TFunction, block: FieldBlock): FieldInput {
  return {
    field_key: block.key,
    label: blockLabel(t, block.key),
    label_key: block.key,
    field_type: block.field_type,
    options: block.hasOptions ? blockOptions(t, block) : null,
    required: false,
    group_label: blockGroupLabel(t, block.group),
    group_key: block.group,
    show_when_field_id: null,
    show_when_values: null,
  };
}

// ---------------------------------------------------------------------------
// Render-time labels for STORED fields (Fase G-rest A3, migration 0047).
// ---------------------------------------------------------------------------

/**
 * Display label of a stored field. A field created from a catalogue block carries
 * `label_key` and re-translates on every render, so its label follows the UI
 * language instead of staying frozen in whatever language it was created in. A
 * custom field (label_key null) — or a key that later left the catalogue/i18n —
 * falls back to the free-text `label`. Renaming a field clears label_key in the
 * DB (trigger, 0047), so a user's own wording always wins over the translation.
 */
export function fieldLabel(t: TFunction, f: Pick<MethodologyField, "label" | "label_key">): string {
  if (!f.label_key) return f.label;
  return t(`blocks.items.${f.label_key}.label`, { defaultValue: f.label });
}

/** Display group header of a stored field — the group_label counterpart of fieldLabel(). */
export function fieldGroupLabel(
  t: TFunction,
  f: Pick<MethodologyField, "group_label" | "group_key">
): string | null {
  if (!f.group_key) return f.group_label;
  return t(`blocks.groups.${f.group_key}`, { defaultValue: f.group_label ?? "" }) || null;
}

// ---------------------------------------------------------------------------
// Startsets — asset × style → the blocks pre-ticked in the builder.
// ---------------------------------------------------------------------------

export type AssetClass = "forex" | "futures" | "stock" | "crypto";
export type TradingStyle = "scalp" | "day" | "swing";

export interface Startset {
  /** Stable key, also the i18n key stem. */
  key: string;
  asset: AssetClass;
  style: TradingStyle;
  blockKeys: string[];
}

/** Ordered for the grouped overview: grouped by asset, then scalp→day→swing. */
export const STARTSETS: Startset[] = [
  { key: "forex_scalp", asset: "forex", style: "scalp", blockKeys: ["setup", "timeframe", "session", "news", "emotion"] },
  { key: "forex_day", asset: "forex", style: "day", blockKeys: ["setup", "timeframe", "market_condition", "quality", "session", "news", "mistake", "emotion"] },
  { key: "forex_swing", asset: "forex", style: "swing", blockKeys: ["setup", "timeframe", "session", "market_regime", "targets", "emotion"] },
  { key: "futures_scalp", asset: "futures", style: "scalp", blockKeys: ["setup", "timeframe", "contracts", "contract_type", "hours", "emotion"] },
  { key: "futures_day", asset: "futures", style: "day", blockKeys: ["setup", "timeframe", "market_condition", "quality", "contracts", "contract_type", "hours", "session", "mistake", "emotion"] },
  { key: "stock_day", asset: "stock", style: "day", blockKeys: ["setup", "timeframe", "market_condition", "quality", "sector", "market_cap", "catalyst", "mistake", "emotion"] },
  { key: "stock_swing", asset: "stock", style: "swing", blockKeys: ["setup", "timeframe", "sector", "market_cap", "catalyst", "market_regime", "targets", "emotion"] },
  { key: "crypto_scalp", asset: "crypto", style: "scalp", blockKeys: ["setup", "timeframe", "market_type", "leverage", "emotion"] },
  { key: "crypto_day", asset: "crypto", style: "day", blockKeys: ["setup", "timeframe", "market_condition", "quality", "market_type", "leverage", "mistake", "emotion"] },
  { key: "crypto_swing", asset: "crypto", style: "swing", blockKeys: ["setup", "timeframe", "market_type", "leverage", "market_regime", "targets", "emotion"] },
];

/**
 * Strategy startsets — a methodology axis that cuts across asset × style (an ICT/SMC
 * trader runs the same concepts on forex, futures or crypto). Picked as a single
 * chip in the builder, independent of the asset grid; a strategy journal is created
 * without an asset_class (the user curates its own instruments). Kept as its own
 * list + type so the asset×style grid stays a clean 2-D thing.
 */
export interface StrategyStartset {
  /** Stable key, also the i18n key stem under startsets.strategies / .strategyHints. */
  key: string;
  blockKeys: string[];
}

export const STRATEGY_STARTSETS: StrategyStartset[] = [
  {
    key: "ict_smc",
    blockKeys: ["htf_bias", "market_structure", "ict_setup", "entry_model", "pd_array", "timeframe", "session", "emotion"],
  },
];

export const STRATEGY_ORDER: string[] = STRATEGY_STARTSETS.map((s) => s.key);

export function findStrategyStartset(key: string): StrategyStartset | undefined {
  return STRATEGY_STARTSETS.find((s) => s.key === key);
}

export function strategyLabel(t: TFunction, key: string): string {
  return t(`startsets.strategies.${key}`);
}
export function strategyHint(t: TFunction, key: string): string {
  return t(`startsets.strategyHints.${key}`);
}

export const ASSET_ORDER: AssetClass[] = ["forex", "futures", "stock", "crypto"];
export const STYLE_ORDER: TradingStyle[] = ["scalp", "day", "swing"];

export function findStartset(asset: AssetClass, style: TradingStyle): Startset | undefined {
  return STARTSETS.find((s) => s.asset === asset && s.style === style);
}

export function styleLabel(t: TFunction, style: TradingStyle): string {
  return t(`startsets.styles.${style}`);
}
export function styleHint(t: TFunction, style: TradingStyle): string {
  return t(`startsets.styleHints.${style}`);
}
export function assetLabel(t: TFunction, asset: AssetClass): string {
  return t(`startsets.assets.${asset}`);
}

/**
 * Instrument/sizing config written onto a journal created from a startset, so the
 * asset-appropriate sizing tools (lot calculator, tick value) still light up —
 * mirrors what the old seed presets (0027/0028) put in `instrument_config`.
 */
export function assetInstrumentConfig(asset: AssetClass): Record<string, unknown> {
  switch (asset) {
    case "forex":
      return { unit: "lots", sizing_tools: ["lot_calculator", "currency_split"] };
    case "futures":
      return {
        unit: "contracts",
        sizing_tools: ["tick_value"],
        tick_values: { ES: 12.5, NQ: 5, YM: 5, RTY: 5, CL: 10, GC: 10, MES: 1.25, MNQ: 0.5 },
      };
    case "stock":
      return { unit: "shares" };
    case "crypto":
      return { unit: "coins", note: "24/7" };
  }
}
