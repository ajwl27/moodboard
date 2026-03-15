import React from 'react';

const stroke = 'currentColor';
const sw = '1.5';
const lc = 'round';
const lj = 'round';

/** Base document outline used by several icons */
function DocOutline({ children }: { children?: React.ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      {children}
    </svg>
  );
}

const pdfIcon = (
  <DocOutline>
    <text x="12" y="17.5" textAnchor="middle" fill={stroke} stroke="none" fontSize="7" fontWeight="700" fontFamily="system-ui">PDF</text>
  </DocOutline>
);

const wordIcon = (
  <DocOutline>
    <path d="M8 13h8" /><path d="M8 17h5" /><path d="M8 9h2" />
  </DocOutline>
);

const spreadsheetIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" />
  </svg>
);

const presentationIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}>
    <path d="M2 3h20" /><rect x="4" y="3" width="16" height="12" rx="1" />
    <path d="M12 15v4" /><path d="m8 21 4-2 4 2" />
  </svg>
);

const archiveIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}>
    <rect x="2" y="3" width="20" height="5" rx="1" />
    <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </svg>
);

const imageIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
  </svg>
);

const audioIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>
);

const videoIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}>
    <rect x="2" y="4" width="15" height="16" rx="2" />
    <path d="m17 8 5-3v14l-5-3Z" />
  </svg>
);

const codeIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}>
    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
  </svg>
);

const textIcon = (
  <DocOutline>
    <path d="M8 13h8" /><path d="M8 17h5" />
  </DocOutline>
);

const webIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap={lc} strokeLinejoin={lj}>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z" />
  </svg>
);

const defaultIcon = (
  <DocOutline />
);

type IconEntry = { match: (mime: string) => boolean; icon: React.ReactNode };

const ICON_RULES: IconEntry[] = [
  { match: m => m === 'application/pdf', icon: pdfIcon },
  { match: m => m === 'application/msword' || m.includes('wordprocessingml'), icon: wordIcon },
  { match: m => m === 'application/vnd.ms-excel' || m.includes('spreadsheetml') || m === 'text/csv', icon: spreadsheetIcon },
  { match: m => m === 'application/vnd.ms-powerpoint' || m.includes('presentationml'), icon: presentationIcon },
  { match: m => m.includes('zip') || m.includes('rar') || m.includes('7z') || m.includes('tar') || m.includes('gzip'), icon: archiveIcon },
  { match: m => m.startsWith('image/'), icon: imageIcon },
  { match: m => m.startsWith('audio/'), icon: audioIcon },
  { match: m => m.startsWith('video/'), icon: videoIcon },
  { match: m => m === 'text/html' || m === 'text/css', icon: webIcon },
  { match: m => m === 'text/javascript' || m === 'application/json' || m === 'application/javascript' || m.includes('xml'), icon: codeIcon },
  { match: m => m.startsWith('text/'), icon: textIcon },
];

export function getFileIconSvg(mimeType: string): React.ReactNode {
  for (const rule of ICON_RULES) {
    if (rule.match(mimeType)) return rule.icon;
  }
  return defaultIcon;
}

/** Legacy emoji icon function — kept for backwards compat but prefer getFileIconSvg */
const ICON_MAP: Record<string, string> = {
  'application/pdf': '\u{1F4C4}',
  'application/msword': '\u{1F4DD}',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '\u{1F4DD}',
  'application/vnd.ms-excel': '\u{1F4CA}',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '\u{1F4CA}',
  'application/vnd.ms-powerpoint': '\u{1F4D1}',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '\u{1F4D1}',
  'application/zip': '\u{1F4E6}',
  'application/x-rar-compressed': '\u{1F4E6}',
  'application/x-7z-compressed': '\u{1F4E6}',
  'text/plain': '\u{1F4C3}',
  'text/csv': '\u{1F4CA}',
  'text/html': '\u{1F310}',
  'text/css': '\u{1F3A8}',
  'text/javascript': '\u{2699}\u{FE0F}',
  'application/json': '\u{2699}\u{FE0F}',
  'audio/mpeg': '\u{1F3B5}',
  'audio/wav': '\u{1F3B5}',
  'video/mp4': '\u{1F3AC}',
  'video/webm': '\u{1F3AC}',
};

export function getFileIcon(mimeType: string): string {
  if (ICON_MAP[mimeType]) return ICON_MAP[mimeType];
  if (mimeType.startsWith('image/')) return '\u{1F5BC}\u{FE0F}';
  if (mimeType.startsWith('audio/')) return '\u{1F3B5}';
  if (mimeType.startsWith('video/')) return '\u{1F3AC}';
  if (mimeType.startsWith('text/')) return '\u{1F4C3}';
  return '\u{1F4CE}';
}
