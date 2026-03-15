import type { DrawingCard as DrawingCardType } from '../../types';

interface Props {
  obj: DrawingCardType;
}

export function DrawingCard({ obj }: Props) {
  const { points, strokeColour, strokeWidth } = obj;

  if (points.length < 2) return null;

  // Build SVG path from relative points
  const w = obj.width;
  const h = obj.height;
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x * w},${p.y * h}`)
    .join(' ');

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: 'block' }}
    >
      <path
        d={d}
        fill="none"
        stroke={strokeColour || '#2C2825'}
        strokeWidth={strokeWidth || 3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
