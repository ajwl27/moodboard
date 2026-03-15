export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const LAYER_COLOURS = [
  '#ef4444',  // red
  '#f97316',  // orange
  '#eab308',  // yellow
  '#22c55e',  // green
  '#14b8a6',  // teal
  '#3b82f6',  // blue
  '#6366f1',  // indigo
  '#a855f7',  // purple
  '#ec4899',  // pink
  '#64748b',  // slate
];
