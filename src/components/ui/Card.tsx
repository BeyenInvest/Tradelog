import type { HTMLAttributes } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** "sm" for secondary/supplementary content that shouldn't compete visually with primary stats. */
  padding?: "default" | "sm";
}

export function Card({ className, padding = "default", ...props }: CardProps) {
  return (
    <div
      className={clsx("rounded-xl bg-surface border border-border", padding === "sm" ? "p-3" : "p-5", className)}
      {...props}
    />
  );
}
