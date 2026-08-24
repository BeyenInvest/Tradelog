import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import {
  FIELD_BLOCKS, STARTSETS, getBlock, ASSET_ORDER, STYLE_ORDER,
  blockToFieldInput, fieldLabel, fieldGroupLabel,
} from "../fieldBlocks";
import nl from "@/i18n/locales/nl.json";
import en from "@/i18n/locales/en.json";

/**
 * Integrity of the building-block catalogue + starter sets (Fase G preset
 * redesign). These are pure data; the risks are a starter set pointing at a block
 * that doesn't exist, a duplicate key colliding in trades.custom, or a missing
 * translation leaking a raw i18n key into the palette. Lock all three.
 */

type Locale = typeof nl;
const LOCALES: Record<string, Locale> = { nl, en: en as unknown as Locale };

/** Minimal t-stub over the real locale JSON — returns defaultValue on a missing key, like i18next. */
function tFor(lang: string): TFunction {
  return ((key: string, opts?: { defaultValue?: string }) => {
    let node: unknown = LOCALES[lang];
    for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
    return typeof node === "string" ? node : opts?.defaultValue ?? key;
  }) as unknown as TFunction;
}

describe("fieldBlocks catalogue", () => {
  it("has unique block keys", () => {
    const keys = FIELD_BLOCKS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every enum block declares it has options, others don't", () => {
    for (const b of FIELD_BLOCKS) {
      expect(b.hasOptions).toBe(b.field_type === "enum");
    }
  });

  it.each(Object.keys(LOCALES))("every block has a label (+ options for enums) in %s", (lang) => {
    const items = LOCALES[lang].blocks.items as Record<string, { label?: string; options?: string[] }>;
    for (const b of FIELD_BLOCKS) {
      expect(items[b.key]?.label, `${b.key}.label missing in ${lang}`).toBeTruthy();
      if (b.hasOptions) {
        expect(Array.isArray(items[b.key]?.options), `${b.key}.options missing in ${lang}`).toBe(true);
        expect((items[b.key]?.options ?? []).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("render-time field labels (A3, 0047)", () => {
  it("blockToFieldInput stamps label_key + group_key next to the written label", () => {
    const input = blockToFieldInput(tFor("nl"), getBlock("market_condition")!);
    expect(input.label).toBe("Marktconditie");
    expect(input.label_key).toBe("market_condition");
    expect(input.group_label).toBe("Setup & uitvoering");
    expect(input.group_key).toBe("setup");
  });

  it("fieldLabel re-translates a catalogue-backed field per UI language", () => {
    const f = { label: "Marktconditie", label_key: "market_condition" };
    expect(fieldLabel(tFor("nl"), f)).toBe("Marktconditie");
    expect(fieldLabel(tFor("en"), f)).toBe("Market condition");
  });

  it("fieldLabel falls back to the free label for custom fields and unknown keys", () => {
    expect(fieldLabel(tFor("en"), { label: "Mijn eigen veld", label_key: null })).toBe("Mijn eigen veld");
    expect(fieldLabel(tFor("en"), { label: "Ooit-catalogus", label_key: "no_longer_exists" })).toBe("Ooit-catalogus");
  });

  it("fieldGroupLabel re-translates the group header with the same fallback", () => {
    const f = { group_label: "Setup & uitvoering", group_key: "setup" };
    expect(fieldGroupLabel(tFor("en"), f)).toBe("Setup & execution");
    expect(fieldGroupLabel(tFor("en"), { group_label: "Eigen groep", group_key: null })).toBe("Eigen groep");
    expect(fieldGroupLabel(tFor("en"), { group_label: null, group_key: null })).toBeNull();
    expect(fieldGroupLabel(tFor("en"), { group_label: null, group_key: "weg_uit_catalogus" })).toBeNull();
  });
});

describe("startsets", () => {
  it("every starter set references only real blocks", () => {
    for (const s of STARTSETS) {
      expect(s.blockKeys.length).toBeGreaterThan(0);
      for (const k of s.blockKeys) {
        expect(getBlock(k), `startset ${s.key} references unknown block ${k}`).toBeDefined();
      }
    }
  });

  it("has one starter set per asset order entry at minimum and no duplicate keys", () => {
    const keys = STARTSETS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of ASSET_ORDER) {
      expect(STARTSETS.some((s) => s.asset === a), `no starter set for asset ${a}`).toBe(true);
    }
  });

  it.each(Object.keys(LOCALES))("every starter set + asset + style is translated in %s", (lang) => {
    const st = LOCALES[lang].startsets as {
      desc: Record<string, string>; assets: Record<string, string>; styles: Record<string, string>;
    };
    for (const s of STARTSETS) {
      expect(st.desc[s.key], `startsets.desc.${s.key} missing in ${lang}`).toBeTruthy();
    }
    for (const a of ASSET_ORDER) expect(st.assets[a], `asset ${a} missing in ${lang}`).toBeTruthy();
    for (const sty of STYLE_ORDER) expect(st.styles[sty], `style ${sty} missing in ${lang}`).toBeTruthy();
  });
});
