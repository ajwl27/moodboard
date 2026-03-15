import { useMemo } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';

const SNAP_THRESHOLD = 5;

interface GuideLine {
  axis: 'x' | 'y';
  pos: number;
  start: number;
  end: number;
}

export function SmartGuides() {
  const objects = useCanvasStore((s) => s.objects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const smartGuidesEnabled = useCanvasStore((s) => s.smartGuidesEnabled);

  const guides = useMemo(() => {
    if (!smartGuidesEnabled || selectedIds.size === 0) return [];

    const selected = objects.filter((o) => selectedIds.has(o.id));
    const others = objects.filter((o) => !selectedIds.has(o.id) && o.type !== 'arrow');
    if (selected.length === 0 || others.length === 0) return [];

    const lines: GuideLine[] = [];

    for (const sel of selected) {
      const selCx = sel.x + sel.width / 2;
      const selCy = sel.y + sel.height / 2;
      const selR = sel.x + sel.width;
      const selB = sel.y + sel.height;

      for (const other of others) {
        const oCx = other.x + other.width / 2;
        const oCy = other.y + other.height / 2;
        const oR = other.x + other.width;
        const oB = other.y + other.height;

        // Vertical guides (x-axis alignment)
        const xChecks = [
          { a: sel.x, b: other.x },
          { a: sel.x, b: oCx },
          { a: sel.x, b: oR },
          { a: selCx, b: other.x },
          { a: selCx, b: oCx },
          { a: selCx, b: oR },
          { a: selR, b: other.x },
          { a: selR, b: oCx },
          { a: selR, b: oR },
        ];
        for (const { a, b } of xChecks) {
          if (Math.abs(a - b) < SNAP_THRESHOLD) {
            lines.push({
              axis: 'x',
              pos: b,
              start: Math.min(sel.y, other.y),
              end: Math.max(selB, oB),
            });
          }
        }

        // Horizontal guides (y-axis alignment)
        const yChecks = [
          { a: sel.y, b: other.y },
          { a: sel.y, b: oCy },
          { a: sel.y, b: oB },
          { a: selCy, b: other.y },
          { a: selCy, b: oCy },
          { a: selCy, b: oB },
          { a: selB, b: other.y },
          { a: selB, b: oCy },
          { a: selB, b: oB },
        ];
        for (const { a, b } of yChecks) {
          if (Math.abs(a - b) < SNAP_THRESHOLD) {
            lines.push({
              axis: 'y',
              pos: b,
              start: Math.min(sel.x, other.x),
              end: Math.max(selR, oR),
            });
          }
        }
      }
    }

    // Deduplicate
    const unique = new Map<string, GuideLine>();
    for (const line of lines) {
      const key = `${line.axis}-${Math.round(line.pos)}`;
      const existing = unique.get(key);
      if (existing) {
        existing.start = Math.min(existing.start, line.start);
        existing.end = Math.max(existing.end, line.end);
      } else {
        unique.set(key, { ...line });
      }
    }

    return [...unique.values()];
  }, [objects, selectedIds, smartGuidesEnabled]);

  if (guides.length === 0) return null;

  return (
    <>
      {guides.map((guide, i) =>
        guide.axis === 'x' ? (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: guide.pos,
              top: guide.start,
              width: 1,
              height: guide.end - guide.start,
              background: '#ff6b6b',
              pointerEvents: 'none',
              zIndex: 99998,
            }}
          />
        ) : (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: guide.start,
              top: guide.pos,
              width: guide.end - guide.start,
              height: 1,
              background: '#ff6b6b',
              pointerEvents: 'none',
              zIndex: 99998,
            }}
          />
        ),
      )}
    </>
  );
}
