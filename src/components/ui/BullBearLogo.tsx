interface BullBearLogoProps {
  size?: number;
  className?: string;
}

/** Brand mark: bull horns crossing a bear's claw marks. */
export function BullBearLogo({ size = 20, className }: BullBearLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M24 26 C 24 17 18 9 8 8" />
      <path d="M24 26 C 24 17 30 9 40 8" />
      <path d="M6 40 L 20 28" />
      <path d="M10 43 L 24 31" />
      <path d="M14 46 L 28 34" />
    </svg>
  );
}
