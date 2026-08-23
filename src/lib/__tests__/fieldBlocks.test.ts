import { describe, it, expect } from "vitest";
import { FIELD_BLOCKS, STARTSETS, getBlock, ASSET_ORDER, STYLE_ORDER } from "../fieldBlocks";
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
