import { MIN_SAMPLE_SIZE } from "@/lib/constants";

/** Dims/tags a breakdown row with n < 15 (rekenregel 6) — too little data for conclusions. */
export function SampleSizeBadge({ n }: { n: number }) {
  if (n >= MIN_SAMPLE_SIZE) return null;
  return (
    <span
      className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border text-faint"
      title={`Minder dan ${MIN_SAMPLE_SIZE} trades — te weinig data voor conclusies`}
    >
      n={n}
    </span>
  );
}
