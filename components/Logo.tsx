// CreatorOS AI brand mark — an "AI core" broadcasting to platform nodes.
// Per brand direction: AI as the command center distributing content to every
// channel. Hexagonal core (OS/crystal), a 4-point AI spark, and 8 platform
// nodes (one green = live). No real platform logos, no basket. Official palette
// (Electric Blue #2563EB → AI Purple #7C3AED, Success Green #10B981).

export function LogoMark({
  className = "",
  title = "CreatorOS AI",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="cos-core" x1="16.6" y1="15.5" x2="31.4" y2="32.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <radialGradient id="cos-glow" cx="24" cy="24" r="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" stopOpacity="0.5" />
          <stop offset="1" stopColor="#2563EB" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ambient glow */}
      <circle cx="24" cy="24" r="20" fill="url(#cos-glow)" />

      {/* orbital ring */}
      <circle cx="24" cy="24" r="18.5" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />

      {/* spokes: core → each platform node */}
      <g stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round">
        <line x1="24" y1="24" x2="24" y2="9" />
        <line x1="24" y1="24" x2="34.61" y2="13.39" />
        <line x1="24" y1="24" x2="39" y2="24" />
        <line x1="24" y1="24" x2="34.61" y2="34.61" />
        <line x1="24" y1="24" x2="24" y2="39" />
        <line x1="24" y1="24" x2="13.39" y2="34.61" />
        <line x1="24" y1="24" x2="9" y2="24" />
        <line x1="24" y1="24" x2="13.39" y2="13.39" />
      </g>

      {/* 8 platform nodes (top one green = "live/success") */}
      <g>
        <circle cx="24" cy="9" r="2.5" fill="#10B981" />
        <circle cx="34.61" cy="13.39" r="2.5" fill="#2563EB" />
        <circle cx="39" cy="24" r="2.5" fill="#7C3AED" />
        <circle cx="34.61" cy="34.61" r="2.5" fill="#2563EB" />
        <circle cx="24" cy="39" r="2.5" fill="#7C3AED" />
        <circle cx="13.39" cy="34.61" r="2.5" fill="#2563EB" />
        <circle cx="9" cy="24" r="2.5" fill="#7C3AED" />
        <circle cx="13.39" cy="13.39" r="2.5" fill="#2563EB" />
      </g>

      {/* AI core — hexagon (pointy-top crystal) */}
      <path
        d="M24 15.5 L31.36 19.75 L31.36 28.25 L24 32.5 L16.64 28.25 L16.64 19.75 Z"
        fill="url(#cos-core)"
        stroke="#fff"
        strokeOpacity="0.18"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* core spark (AI) — 4-point star */}
      <path
        d="M24 18 L25.5 22.5 L30 24 L25.5 25.5 L24 30 L22.5 25.5 L18 24 L22.5 22.5 Z"
        fill="#fff"
        fillOpacity="0.95"
      />
    </svg>
  );
}
