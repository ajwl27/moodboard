const ICON_MAP: Record<string, string> = {
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/vnd.ms-powerpoint': '📑',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '📑',
  'application/zip': '📦',
  'application/x-rar-compressed': '📦',
  'application/x-7z-compressed': '📦',
  'text/plain': '📃',
  'text/csv': '📊',
  'text/html': '🌐',
  'text/css': '🎨',
  'text/javascript': '⚙️',
  'application/json': '⚙️',
  'audio/mpeg': '🎵',
  'audio/wav': '🎵',
  'video/mp4': '🎬',
  'video/webm': '🎬',
};

export function getFileIcon(mimeType: string): string {
  if (ICON_MAP[mimeType]) return ICON_MAP[mimeType];
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('text/')) return '📃';
  return '📎';
}
