interface LogoMarkProps {
  size?: number;
  className?: string;
}

/** Brand mark: a rangefinder-style focus frame around an aperture — precision, not a literal eye (that idea lives in the wordmark instead). */
export function LogoMark({ size = 20, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={11}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14,34 L14,14 L34,14" />
      <path d="M86,14 L106,14 L106,34" />
      <path d="M106,86 L106,106 L86,106" />
      <path d="M34,106 L14,106 L14,86" />
      <circle cx="60" cy="60" r="17" strokeWidth={8} />
      <circle cx="60" cy="60" r="6" fill="currentColor" stroke="none" />
    </svg>
  );
}

interface WordmarkProps {
  className?: string;
}

/** "Beyen" with the hidden "eye" (b-EYE-n) picked out in gold. */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span className={className}>
      b<span className="text-gold">eye</span>n
    </span>
  );
}
