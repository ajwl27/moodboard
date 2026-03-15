import { useCanvasStore } from '../../stores/canvasStore';
import type { GuideLine } from '../../utils/alignmentGuides';

const GUIDE_COLOUR = '#6b7280';
const FADE_LEN = 40;

/**
 * Renders alignment guide lines as an absolutely-positioned HTML overlay.
 * Each line is a thin div with a CSS gradient for faded ends.
 * Must be placed inside the zoomed+translated canvas layer so coordinates match.
 */
export function AlignmentGuides() {
  const guides = useCanvasStore((s) => s.activeGuides);
  if (!guides || guides.length === 0) return null;

  return (
    <>
      {guides.map((g, i) => (
        <GuideLineDiv key={i} guide={g} />
      ))}
    </>
  );
}

function GuideLineDiv({ guide }: { guide: GuideLine }) {
  const { axis, position, start, end, strength } = guide;
  const len = end - start + FADE_LEN * 2;
  const opacity = Math.max(0.3, strength);

  if (axis === 'x') {
    // Vertical guide line
    return (
      <div
        style={{
          position: 'absolute',
          left: position - 0.75,
          top: start - FADE_LEN,
          width: 1.5,
          height: len,
          pointerEvents: 'none',
          zIndex: 999999,
          background: `linear-gradient(to bottom, transparent 0%, ${GUIDE_COLOUR} ${pct(FADE_LEN, len)}%, ${GUIDE_COLOUR} ${pct(len - FADE_LEN, len)}%, transparent 100%)`,
          opacity,
        }}
      />
    );
  }

  // Horizontal guide line
  return (
    <div
      style={{
        position: 'absolute',
        left: start - FADE_LEN,
        top: position - 0.75,
        width: len,
        height: 1.5,
        pointerEvents: 'none',
        zIndex: 999999,
        background: `linear-gradient(to right, transparent 0%, ${GUIDE_COLOUR} ${pct(FADE_LEN, len)}%, ${GUIDE_COLOUR} ${pct(len - FADE_LEN, len)}%, transparent 100%)`,
        opacity,
      }}
    />
  );
}

function pct(value: number, total: number): number {
  return Math.round((value / total) * 100);
}
