"use client";

type IconProps = {
  className?: string;
};

/** Custom bot/AI icon — replaces lucide Bot */
export function BotIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* antenna */}
      <path
        d="M10 6V3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="3" fill="currentColor" r="1" />
      {/* head */}
      <rect
        height="10"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
        width="14"
        x="3"
        y="6"
      />
      {/* ear bolts */}
      <path
        d="M3 9.5H1.5M16.5 9.5H18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      {/* eyes */}
      <circle cx="7.5" cy="11" fill="currentColor" r="1.25" />
      <circle cx="12.5" cy="11" fill="currentColor" r="1.25" />
      {/* mouth */}
      <path
        d="M8 13.5h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/** Triangle warning — use for alerts / warnings */
export function AlertIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7.139 2.568a1 1 0 0 1 1.722 0l5.5 9.5A1 1 0 0 1 13.5 13.5h-11a1 1 0 0 1-.861-1.432l5.5-9.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M8 6.5v3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="11" fill="currentColor" r="0.75" />
    </svg>
  );
}

/** Lightbulb — suggestions / insights */
export function LightbulbIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* bulb */}
      <path
        d="M8 2a4 4 0 0 1 2.83 6.83L10 9.66V12H6V9.66L5.17 8.83A4 4 0 0 1 8 2Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      {/* base stripes */}
      <path
        d="M6.5 12h3M7 13.5h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/** Bar chart — data / metrics */
export function ChartIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect height="5" opacity="0.6" rx="0.75" width="3" x="1.5" y="9" />
      <rect height="9" rx="0.75" width="3" x="6.5" y="5" />
      <rect height="13" opacity="0.85" rx="0.75" width="3" x="11.5" y="1" />
    </svg>
  );
}

/** Diamond — critical / danger */
export function CriticalIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 1.5L14.5 8 8 14.5 1.5 8 8 1.5Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
      <path
        d="M8 5.5v3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      <circle cx="8" cy="10.5" fill="currentColor" r="0.75" />
    </svg>
  );
}

/** 4-point sparkle — AI / pro badge */
export function SparkleIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 0.5L7.2 4.8 11.5 6 7.2 7.2 6 11.5 4.8 7.2 0.5 6 4.8 4.8 6 0.5Z" />
    </svg>
  );
}

/** Minimal person silhouette */
export function UserIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 14 14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M1.5 12.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/** Open book — answer / response label */
export function BookOpenIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 14 14"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 11.5V3.5C7 3.5 5.5 2.5 3 2.5H1.75a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75H3c2.5 0 4 1 4 1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
      <path
        d="M7 11.5V3.5C7 3.5 8.5 2.5 11 2.5h1.25a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-.75.75H11c-2.5 0-4 1-4 1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}
