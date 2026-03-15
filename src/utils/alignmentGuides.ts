import type { Rect } from '../types';

export interface GuideLine {
  axis: 'x' | 'y';
  /** Canvas coordinate of the guide line */
  position: number;
  /** Start of the visible segment (perpendicular axis) */
  start: number;
  /** End of the visible segment (perpendicular axis) */
  end: number;
  /** 0–1 opacity based on distance from the match source object */
  strength: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: GuideLine[];
}

/** Max distance (in canvas px) to look for alignment candidates */
const SEARCH_RADIUS = 600;

/** Max distance (in canvas px) at which a guide snaps and shows at full opacity */
const SNAP_THRESHOLD = 6;

/** Distance at which guide starts appearing (faded) before snapping */
const FADE_RANGE = 40;

/**
 * Given the bounding rect of the objects being dragged (in canvas coords)
 * and all other objects on the canvas, compute snap adjustments and guide lines.
 */
export function computeAlignmentGuides(
  draggedRect: Rect,
  otherObjects: Rect[],
): SnapResult {
  // Edges and center of the dragged rect
  const dragEdges = rectEdges(draggedRect);
  const guides: GuideLine[] = [];
  let bestDx = 0;
  let bestDy = 0;
  let bestDistX = Infinity;
  let bestDistY = Infinity;

  for (const other of otherObjects) {
    // Skip objects too far away
    const dist = rectDistance(draggedRect, other);
    if (dist > SEARCH_RADIUS) continue;

    const otherEdges = rectEdges(other);

    // Check X-axis alignments (vertical guide lines)
    for (const de of dragEdges.xPositions) {
      for (const oe of otherEdges.xPositions) {
        const gap = Math.abs(de.value - oe.value);
        if (gap > FADE_RANGE) continue;

        const snapDelta = oe.value - de.value;
        const strength = gap <= SNAP_THRESHOLD ? 1 : 1 - (gap - SNAP_THRESHOLD) / (FADE_RANGE - SNAP_THRESHOLD);

        // Compute the visual extent of the guide line (y-axis range)
        const minY = Math.min(draggedRect.y, other.y) - 20;
        const maxY = Math.max(draggedRect.y + draggedRect.height, other.y + other.height) + 20;

        guides.push({
          axis: 'x',
          position: oe.value,
          start: minY,
          end: maxY,
          strength: Math.max(0, Math.min(1, strength)),
        });

        if (gap < bestDistX) {
          bestDistX = gap;
          bestDx = snapDelta;
        }
      }
    }

    // Check Y-axis alignments (horizontal guide lines)
    for (const de of dragEdges.yPositions) {
      for (const oe of otherEdges.yPositions) {
        const gap = Math.abs(de.value - oe.value);
        if (gap > FADE_RANGE) continue;

        const snapDelta = oe.value - de.value;
        const strength = gap <= SNAP_THRESHOLD ? 1 : 1 - (gap - SNAP_THRESHOLD) / (FADE_RANGE - SNAP_THRESHOLD);

        const minX = Math.min(draggedRect.x, other.x) - 20;
        const maxX = Math.max(draggedRect.x + draggedRect.width, other.x + other.width) + 20;

        guides.push({
          axis: 'y',
          position: oe.value,
          start: minX,
          end: maxX,
          strength: Math.max(0, Math.min(1, strength)),
        });

        if (gap < bestDistY) {
          bestDistY = gap;
          bestDy = snapDelta;
        }
      }
    }
  }

  // Only snap if within threshold
  if (bestDistX > SNAP_THRESHOLD) bestDx = 0;
  if (bestDistY > SNAP_THRESHOLD) bestDy = 0;

  // Deduplicate guides that are very close on the same axis
  const deduped = deduplicateGuides(guides);

  return { dx: bestDx, dy: bestDy, guides: deduped };
}

interface EdgeInfo {
  value: number;
  label: 'start' | 'center' | 'end';
}

function rectEdges(r: Rect): { xPositions: EdgeInfo[]; yPositions: EdgeInfo[] } {
  return {
    xPositions: [
      { value: r.x, label: 'start' },
      { value: r.x + r.width / 2, label: 'center' },
      { value: r.x + r.width, label: 'end' },
    ],
    yPositions: [
      { value: r.y, label: 'start' },
      { value: r.y + r.height / 2, label: 'center' },
      { value: r.y + r.height, label: 'end' },
    ],
  };
}

/** Approximate distance between two rects (0 if overlapping) */
function rectDistance(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height));
  return Math.sqrt(dx * dx + dy * dy);
}

/** Merge guides on the same axis that are within 2px of each other */
function deduplicateGuides(guides: GuideLine[]): GuideLine[] {
  const result: GuideLine[] = [];
  for (const g of guides) {
    const existing = result.find(
      (r) => r.axis === g.axis && Math.abs(r.position - g.position) < 2,
    );
    if (existing) {
      existing.start = Math.min(existing.start, g.start);
      existing.end = Math.max(existing.end, g.end);
      existing.strength = Math.max(existing.strength, g.strength);
    } else {
      result.push({ ...g });
    }
  }
  return result;
}
