import { Controller, useFormContext } from "react-hook-form";
import type { TradeFormValues } from "@/lib/validation";
import { FASE_KENMERKEN } from "@/lib/constants";
import { EnumSelect } from "@/components/ui/EnumSelect";
import { BooleanToggle } from "@/components/ui/BooleanToggle";
import { Field } from "./Field";

export function FaseKenmerkenSection() {
  const {
    control,
    register,
    watch,
    formState: { errors },
  } = useFormContext<TradeFormValues>();
  const fase = watch("fase");
  const fase3Touches = watch("fase3_zone_min_2_touches");
  const fase3Engulfing = watch("fase3_engulfing_candle");

  // Fase-kenmerken are optional (not every account holder tracks them) — no required
  // marker, no superRefine gate in validation.ts.
  const fields = FASE_KENMERKEN.filter((k) => k.fase === fase && !k.computed);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-display text-lg italic text-ink">Fase-specifieke kenmerken — {fase}</h3>
      <div className="grid grid-cols-2 gap-4">
        {fields.map((k) => (
          <Field
            key={k.field}
            label={k.label}
            error={errors[k.field as keyof TradeFormValues]?.message as string | undefined}
          >
            {k.values === "boolean" ? (
              <Controller
                name={k.field as keyof TradeFormValues}
                control={control}
                render={({ field }) => (
                  <BooleanToggle value={field.value as boolean | null} onChange={field.onChange} />
                )}
              />
            ) : (
              <EnumSelect options={k.values as readonly string[]} {...register(k.field as keyof TradeFormValues)} />
            )}
          </Field>
        ))}

        {fase === "Fase 3" && (
          <Field label="Beide? (afgeleid)">
            <input
              type="text"
              disabled
              value={fase3Touches && fase3Engulfing ? "Ja" : "Nee"}
              className="input opacity-60"
            />
          </Field>
        )}
      </div>
    </div>
  );
}
