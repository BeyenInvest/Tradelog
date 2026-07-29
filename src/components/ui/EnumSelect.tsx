import { forwardRef, type SelectHTMLAttributes } from "react";

interface EnumSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly string[];
  placeholder?: string;
}

/** Generic <select> bound to a fixed enum list — used with react-hook-form's register() via ref forwarding. */
export const EnumSelect = forwardRef<HTMLSelectElement, EnumSelectProps>(function EnumSelect(
  { options, placeholder = "Selecteer...", className, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={
        "rounded-lg px-3 py-2 bg-surface-2 border border-border text-ink text-sm outline-none focus:border-gold " +
        (className ?? "")
      }
      {...props}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
});
