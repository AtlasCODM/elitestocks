export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="elitestock-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.88 0.18 92)" />
          <stop offset="100%" stopColor="oklch(0.7 0.16 80)" />
        </linearGradient>
      </defs>
      <path
        d="M16 2 L29 9 L29 23 L16 30 L3 23 L3 9 Z"
        fill="none"
        stroke="url(#elitestock-g)"
        strokeWidth="1.6"
      />
      <path
        d="M11 22 L16 9 L21 22 M13.2 18 L18.8 18"
        fill="none"
        stroke="url(#elitestock-g)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
