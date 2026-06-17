// cosmos-icons.jsx — line-art icon set (lucide-style) + watermark paths.
// <Icon name="activity" size={18} strokeWidth={2} />

const ICON_PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" /></>,
  users: <><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="8" r="3.2" /><path d="M20 19v-1.4a3.4 3.4 0 0 0-2.6-3.3M15.5 5.2a3.2 3.2 0 0 1 0 5.9" /></>,
  barChart: <><path d="M4 20V4M4 20h16" /><rect x="7.5" y="12" width="3" height="5" rx=".6" /><rect x="13" y="8" width="3" height="9" rx=".6" /><rect x="18" y="14" width="0" height="0" /></>,
  flow: <><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M6 8.4v4A3.6 3.6 0 0 0 9.6 16H15.6" /></>,
  anchor: <><circle cx="12" cy="5" r="2.4" /><path d="M12 7.4V21M5 13a7 7 0 0 0 14 0M5 13H3m16 0h2" /></>,
  plug: <><path d="M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v5" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.4 1.5Z" /></>,
  webhook: <><path d="M15 11.5a3.5 3.5 0 1 0-5.6 2.8l-2.2 4M8.5 8.5 6.3 12.5a3.5 3.5 0 1 0 2.4 4.5h4.6M15.5 12.5a3.5 3.5 0 1 0-1.8 4.5" /></>,
  bot: <><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4M9 13h.01M15 13h.01M2 13v2M22 13v2" /></>,
  bell: <><path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 14 18 8ZM10.5 20a1.8 1.8 0 0 0 3 0" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5 19 19M2 12h2M20 12h2M5 19l1.5-1.5M17.5 6.5 19 5" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronsUpDown: <path d="m7 9 5-5 5 5M7 15l5 5 5-5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  shuffle: <path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7M21 16v5h-5M15 15l6 6M3 3l6 6" />,
  flask: <><path d="M9 3h6M10 3v6.5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V3" /><path d="M7.5 14h9" /></>,
  sliders: <><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0" /><circle cx="15" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  sparkles: <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3ZM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.5 2.5 2.5 4.5-5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5V12l3.2 2" /></>,
  dollar: <><line x1="12" y1="2.4" x2="12" y2="21.6" /><path d="M16.5 6H9.75a3.25 3.25 0 0 0 0 6.5h4.5a3.25 3.25 0 0 1 0 6.5H7" /></>,
  trendingUp: <path d="M3 17l6-6 4 4 7-7M14 8h6v6" />,
  trendingDown: <path d="M3 7l6 6 4-4 7 7M14 16h6v-6" />,
  gauge: <><path d="M12 14l4-4M3.5 16a9 9 0 1 1 17 0" /><circle cx="12" cy="14" r="1.4" /></>,
  layers: <path d="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5" />,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  alert: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
  tag: <><path d="M3 11.5V4a1 1 0 0 1 1-1h7.5a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  filter: <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />,
  wand: <path d="M15 4V2M15 10V8M11 6H9M21 6h-2M18.5 3.5 17 5M18.5 8.5 17 7M3 21l11-11" />,
  panelLeft: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></>,
  more: <><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></>,
  externalLink: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  arrowUpRight: <path d="M7 17 17 7M8 7h9v9" />,
  paperclip: <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 17.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />,
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  building: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3" /></>,
  shield: <><path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  gitBranch: <><circle cx="6" cy="6" r="2.4" /><circle cx="6" cy="18" r="2.4" /><circle cx="18" cy="8" r="2.4" /><path d="M6 8.4v7.2M18 10.4a6 6 0 0 1-6 6h-2.5" /></>,
  star: <path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6L12 17.8 6.7 19.5l1.1-6L3.4 9.3l6-.8L12 3Z" />,
  route: <><circle cx="6" cy="19" r="2.4" /><circle cx="18" cy="5" r="2.4" /><path d="M8.4 19H14a3.5 3.5 0 0 0 0-7H10a3.5 3.5 0 0 1 0-7h5.6" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2.5" /><path d="M3 10h18M16.5 15h.01" /><path d="M16 6V4.5a1.5 1.5 0 0 0-2-1.4L4.5 6" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5.5-5 2 2-5.5 5-2Z" /></>,
  pulse: <path d="M2 12h4l2.5-7 5 16 2.5-9h6" />,
  scale: <><path d="M12 3v18M7 21h10M5 7h14M5 7l-2.5 6a3 3 0 0 0 5 0L5 7ZM19 7l-2.5 6a3 3 0 0 0 5 0L19 7Z" /></>,
  refresh: <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />,
  award: <><circle cx="12" cy="9" r="6" /><path d="m9 14-1.5 7L12 19l4.5 2L15 14" /></>,
  book: <><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v16H7.5A2.5 2.5 0 0 0 5 20.5V4.5Z" /><path d="M5 20.5A2.5 2.5 0 0 1 7.5 18H19v4H7.5A2.5 2.5 0 0 1 5 20.5Z" /></>,
  play: <path d="M7 4.5 19 12 7 19.5v-15Z" />,
  pause: <><rect x="7" y="5" width="3.5" height="14" rx="1" /><rect x="13.5" y="5" width="3.5" height="14" rx="1" /></>,
  puzzle: <path d="M10 3.5a1.5 1.5 0 0 1 3 0c0 .8.6 1.5 1.5 1.5H17a1 1 0 0 1 1 1v2.5c0 .9.7 1.5 1.5 1.5a1.5 1.5 0 0 1 0 3c-.8 0-1.5.6-1.5 1.5V18a1 1 0 0 1-1 1h-2.5c-.9 0-1.5.7-1.5 1.5a1.5 1.5 0 0 1-3 0c0-.8-.6-1.5-1.5-1.5H6a1 1 0 0 1-1-1v-2.5C5 14.6 4.3 14 3.5 14a1.5 1.5 0 0 1 0-3c.8 0 1.5-.6 1.5-1.5V7a1 1 0 0 1 1-1h2.5C9.4 6 10 5.3 10 4.5Z" />,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /><circle cx="12" cy="15.5" r="1.2" /></>,
  key: <><circle cx="8" cy="8" r="4.5" /><path d="m11 11 8 8M16 16l2-2M14 18l1.5 1.5" /></>,
  code: <path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" />,
  message: <path d="M21 12a8 8 0 0 1-11.4 7.2L4 21l1.8-5.6A8 8 0 1 1 21 12Z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
};

function Icon({ name, size = 18, strokeWidth = 1.9, style, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round"
      strokeLinejoin="round" style={{ display: "block", flexShrink: 0, ...style }} className={className}
      aria-hidden="true">
      {ICON_PATHS[name] || null}
    </svg>
  );
}

Object.assign(window, { Icon, ICON_PATHS });
