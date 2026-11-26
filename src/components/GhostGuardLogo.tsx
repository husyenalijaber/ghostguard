import { useId } from "react";

interface GhostGuardLogoProps {
  className?: string;
  title?: string;
}

/** Logo GhostGuard (sama dengan public/favicon.svg). */
export function GhostGuardLogo({ className = "w-9 h-9", title = "Logo GhostGuard" }: GhostGuardLogoProps) {
  const gradId = `gg-bg-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 ${className}`} role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="1" stopColor="#115e59" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${gradId})`} />
      <path d="M32 9 L51 16 V30 C51 42.5 43 51.5 32 56 C21 51.5 13 42.5 13 30 V16 Z" fill="#ffffff" />
      <path
        d="M32 19 C25.4 19 21.5 23.8 21.5 30 V44.5 L25 41.5 L28.5 44.5 L32 41.5 L35.5 44.5 L39 41.5 L42.5 44.5 V30 C42.5 23.8 38.6 19 32 19 Z"
        fill="#0f766e"
      />
      <circle cx="28" cy="29.5" r="2.6" fill="#ffffff" />
      <circle cx="36" cy="29.5" r="2.6" fill="#ffffff" />
    </svg>
  );
}

export default GhostGuardLogo;
