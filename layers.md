# Layers System — Implementation Plan

## Overview

Add a full layers system allowing users to organise canvas objects into named layers with per-layer visibility, opacity, locking, and colour-coded hover borders. A collapsible panel on the right side provides layer management.

---

## 1. Data Model Changes

### New `Layer` interface (`src/types/index.ts`)

```typescript
export interface Layer {
  id: string;           // crypto.randomUUID()
  boardId: string;      // which board this layer belongs to
  name: string;         // user-editable display name
  colour: string;       // hex colour — used for hover border + panel tint
  visible: boolean;     // toggle layer visibility on/off
  locked: boolean;      // lock all objects on this layer
  opacity: number;      // 0–1, applied to all objects on this layer
  order: number;        // sort position (lower = rendered first / further back)
}
```

### Changes to `CanvasObjectBase`

Add one field:

```typescript
export interface CanvasObjectBase {
  // ... existing fields ...
  layerId: string | null;  // null = "Default" layer (unassigned)
}
```

Every object belongs to at most one layer. `null` means it sits on the implicit default layer which always exists and cannot be deleted.

### Changes to `Board`

Add layer metadata to the board record so layers persist:

```typescript
export interface Board {
  // ... existing fields ...
  layers: Layer[];  // ordered list of layers for this board
}
```

Storing layers on the board (not as separate DB rows) keeps the model simple — a board typically has 2–10 layers, so this is a small JSON array. It also means creating/duplicating/deleting a board handles layers automatically with no extra DB queries.

---

## 2. Database Changes

### Schema migration (`src/db/schema.ts`)

Bump Dexie version to add the `layerId` index on objects:

```typescript
this.version(2).stores({
  boards: 'id, modifiedAt',
  objects: 'id, boardId, type, layerId',  // add layerId index
  files: 'id',
}).upgrade(tx => {
  // Existing objects get layerId: null (default layer)
  return tx.table('objects').toCollection().modify(obj => {
    if (obj.layerId === undefined) obj.layerId = null;
  });
});
```

The `boards` table needs no schema change — Dexie stores the full object, so adding `layers: []` to board records just works. The upgrade sets `layers: []` on existing boards if missing.

### Board CRUD (`src/db/boards.ts`)

- `createBoard`: initialise with `layers: []` (no custom layers; the default layer is implicit)
- `duplicateBoard`: deep-copy `layers` array, generate new layer IDs, remap `layerId` on copied objects

### Object CRUD (`src/db/objects.ts`)

No changes needed — `layerId` is just another field in the object record, handled by existing `bulkPutObjects` / `updateObject`.

---

## 3. Store Changes (`src/stores/canvasStore.ts`)

### New state fields

```typescript
interface CanvasState {
  // ... existing ...
  layers: Layer[];               // current board's layers (loaded from board record)
  layersPanelOpen: boolean;      // UI toggle for the layers panel
  activeLayerId: string | null;  // which layer new objects are created on
}
```

### New actions

```typescript
interface CanvasActions {
  // ... existing ...

  // Layer CRUD
  addLayer: (name: string, colour: string) => void;
  removeLayer: (layerId: string) => void;         // moves objects to default layer
  updateLayer: (layerId: string, changes: Partial<Layer>) => void;
  reorderLayers: (layerIds: string[]) => void;     // set new order

  // Layer visibility & locking
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;

  // Active layer
  setActiveLayerId: (layerId: string | null) => void;

  // Panel toggle
  toggleLayersPanel: () => void;

  // Assign objects to a layer
  moveSelectedToLayer: (layerId: string | null) => void;
}
```

### Key implementation details

**`addLayer`**: Generates a new `Layer` with a unique ID, appends to `layers` array, sets `boardDirty: true`.

**`removeLayer(layerId)`**: Finds all objects with this `layerId`, sets their `layerId` to `null` (moves to default), marks them dirty, removes the layer from `layers`. If `activeLayerId` was the deleted layer, reset to `null`.

**`toggleLayerVisibility(layerId)`**: Flips `visible` on the layer. Hidden objects are still in the data — they're just filtered out during rendering.

**`toggleLayerLock(layerId)`**: Flips `locked` on the layer. Objects on locked layers cannot be selected, moved, or resized. This is separate from per-object `locked`.

**`moveSelectedToLayer(layerId)`**: Updates `layerId` on all selected objects. Creates a single undo entry covering all moved objects.

**`loadBoard`**: Now also receives and sets `layers` from the board record. Sets `activeLayerId` to `null`.

**Object creation**: All `addObject` calls throughout the codebase (Toolbar, clipboard paste, drop, double-click) should set `layerId: activeLayerId` so new objects go on the currently active layer.

### Dirty tracking for layers

Layer changes need to persist via the board record (not the objects table). Add a mechanism:
- Layer mutations set `boardDirty: true`
- `useAutoSave` already saves board metadata when `boardDirty` is true — extend the save to include `layers`

In `useAutoSave.ts`, change the board save:
```typescript
if (current.boardDirty) {
  await updateBoard(current.boardId, {
    camera: current.camera,
    layers: current.layers,  // <-- add this
  });
}
```

---

## 4. Rendering Changes

### Visibility filtering (`BoardView.tsx`)

Before rendering, filter out objects on hidden layers:

```typescript
const hiddenLayerIds = new Set(
  layers.filter((l) => !l.visible).map((l) => l.id)
);

const visibleObjects = allObjects.filter((o) => {
  if (o.layerId && hiddenLayerIds.has(o.layerId)) return false;
  return true;
});
```

This replaces the current simple visibility filter and happens before viewport culling.

### Opacity (`CanvasObject.tsx`)

Look up the object's layer and apply its opacity:

```typescript
// In CanvasObject component:
const layer = layers.find((l) => l.id === obj.layerId);
const layerOpacity = layer?.opacity ?? 1;

const style: React.CSSProperties = {
  // ... existing ...
  opacity: layerOpacity,
};
```

Pass `layers` as a prop to `CanvasObject`, or read from the store directly.

### Hover border colour (`CanvasObject.tsx`)

Currently hover adds a purple/indigo ring:
```typescript
el.style.boxShadow = `0 0 0 2px rgba(99, 102, 241, 0.45), ${SHADOW_HOVER}`;
```

With layers, use the layer's colour instead:

```typescript
const hoverColour = layer?.colour ?? '#6366f1';  // default to indigo
el.style.boxShadow = `0 0 0 2px ${hexToRgba(hoverColour, 0.5)}, ${SHADOW_HOVER}`;
```

Add a `hexToRgba(hex, alpha)` utility to `src/utils/geometry.ts` (or a new `colours.ts`):

```typescript
export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
```

### Selection ring

Selected objects keep the solid indigo ring (unchanged) so selection is always clearly distinguishable from the layer hover colour.

### Locked layers

Objects on locked layers should:
- Not respond to pointer events for selection/drag (check layer lock in `handleObjectPointerDown`)
- Show a subtle lock cursor on hover
- Not show resize handles even when selected

In `BoardView.tsx`, update `handleObjectPointerDown`:

```typescript
const layer = layers.find(l => l.id === obj.layerId);
if (obj.locked || layer?.locked) {
  // Don't start drag, optionally allow selection for inspection
  return;
}
```

---

## 5. Layers Panel UI (`src/components/LayersPanel.tsx`)

### Layout

A collapsible panel on the right side of the board view. Positioned below the TopBar, above the PropertyPanel (or replaces it when open). Slides in/out with a CSS transition.

```
┌──────────────────────────────────┐
│  TopBar                          │
├────────────────────────────┬─────┤
│                            │  L  │  ← Layers Panel (collapsible)
│       Canvas               │  a  │
│                            │  y  │
│                            │  e  │
│                            │  r  │
│                            │  s  │
├────────────────────────────┴─────┤
```

### Panel structure

```
┌─ Layers ──────────────── [+] [×] ┐
│                                   │
│  ☑  🔒  ■ Background     ···  ▲  │  ← layer row (drag handle on right)
│  ☑  🔓  ■ UI Elements    ···  │  │
│  ☐  🔓  ■ Annotations    ···  │  │  ← hidden (unchecked eye)
│  ☑  🔓  ■ Default        ···  ▼  │  ← always last, cannot delete
│                                   │
└───────────────────────────────────┘
```

Each layer row contains (left to right):
1. **Visibility toggle** — eye icon, click to show/hide
2. **Lock toggle** — lock/unlock icon
3. **Colour swatch** — small circle showing the layer's colour
4. **Name** — click to rename (inline edit), double-click or press Enter
5. **More menu** (···) — rename, change colour, delete, "Select all on layer"

### Visual styling

- Glassmorphic panel matching TopBar/Toolbar style
- Each row has a desaturated tint of the layer's colour as background:
  ```typescript
  background: hexToRgba(layer.colour, 0.08)  // very subtle colour wash
  ```
- Active layer row has a slightly stronger tint:
  ```typescript
  background: hexToRgba(layer.colour, 0.15)
  ```
- Hover on rows: `hexToRgba(layer.colour, 0.12)`
- Hidden layers: row text is dimmed (opacity 0.5), eye icon crossed out
- Locked layers: lock icon filled

### Interactions

- **Click a layer row**: sets it as the active layer (new objects go here)
- **Drag rows**: reorder layers (drag handle on right side). Use pointer events, swap `order` values on drop.
- **[+] button**: opens a small form — name input + colour picker (or preset colour palette). Creates layer and sets it active.
- **[×] button**: closes the panel
- **Delete layer**: confirmation if layer has objects. Objects move to default layer.
- **Colour picker**: a grid of 8–10 preset colours (red, orange, yellow, green, teal, blue, indigo, purple, pink, grey). Clicking one sets the layer colour. No custom hex input needed for MVP.

### Default layer

The implicit default layer (`layerId: null`) is always shown at the bottom of the panel as "Default". It cannot be deleted or reordered. It can be hidden, locked, and its colour can be changed (defaults to indigo `#6366f1`).

### Preset colour palette

```typescript
const LAYER_COLOURS = [
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
```

---

## 6. TopBar Changes

Add a "Layers" toggle button next to the existing "Grid" button:

```typescript
<button onClick={toggleLayersPanel} ...>
  <svg>...</svg>  {/* stacked-layers icon */}
  Layers
</button>
```

Active state: filled background when panel is open, matching the Grid button pattern.

---

## 7. Property Panel Changes

When objects are selected, show their current layer assignment:

```
┌─ Layer ──────────────────────────┐
│  [dropdown: layer name      ▼]   │  ← select to move object(s) to layer
└──────────────────────────────────┘
```

A `<select>` dropdown listing all layers + "Default". Changing it calls `moveSelectedToLayer(layerId)`.

---

## 8. Context Menu Changes

Add a "Move to layer ►" submenu to the right-click context menu on objects:

```
  Move to layer  ►  ┌──────────────┐
                     │ Default      │
                     │ Background   │
                     │ UI Elements  │
                     │ Annotations  │
                     └──────────────┘
```

---

## 9. Keyboard Shortcuts

No mandatory shortcuts, but consider:
- `L` — toggle layers panel open/close
- No per-layer shortcuts (too many potential layers)

Add to `useKeyboardShortcuts.ts`:
```typescript
case 'KeyL':
  if (!e.ctrlKey && !e.metaKey) store.toggleLayersPanel();
  break;
```

---

## 10. Object Creation Integration

Every place that creates objects needs to set `layerId: activeLayerId`:

| Location | Object type | Change needed |
|---|---|---|
| `Toolbar.tsx` — addTextCard | TextCard | Add `layerId: state.activeLayerId` |
| `Toolbar.tsx` — handleFileInput | ImageCard | Add `layerId: state.activeLayerId` |
| `Toolbar.tsx` — addLink | LinkCard | Add `layerId: state.activeLayerId` |
| `Toolbar.tsx` — addGroup | GroupRegion | Add `layerId: state.activeLayerId` |
| `BoardView.tsx` — handleDoubleClick | TextCard | Add `layerId: state.activeLayerId` |
| `useClipboard.ts` — paste URL | LinkCard | Add `layerId: state.activeLayerId` |
| `useClipboard.ts` — paste image | ImageCard | Add `layerId: state.activeLayerId` |
| `useClipboard.ts` — paste text | TextCard | Add `layerId: state.activeLayerId` |
| `useDropzone.ts` — drop image | ImageCard | Add `layerId: state.activeLayerId` |
| `useDropzone.ts` — drop file | FileCard | Add `layerId: state.activeLayerId` |
| `useArrowDrawing.ts` — create arrow | Arrow | Add `layerId: state.activeLayerId` |
| `pasteClipboard` (store) | any | Preserve original `layerId` from copied objects |

---

## 11. Undo/Redo Considerations

Layer mutations that affect objects (moving objects between layers, deleting a layer) already go through `updateObject` / `updateObjects` which create history entries. These work automatically.

Layer metadata changes (rename, reorder, colour, visibility, lock, opacity) are **not** undoable for MVP. Rationale:
- They're lightweight organisational actions, not content changes
- Adding layer-level undo would require a separate history mechanism
- Users rarely need to undo a rename or visibility toggle

---

## 12. Auto-Save Integration

`useAutoSave.ts` already saves dirty objects and board metadata. Changes:

1. Layer metadata changes set `boardDirty: true` (already done by store actions)
2. Board save now includes `layers`:
   ```typescript
   await updateBoard(current.boardId, {
     camera: current.camera,
     layers: current.layers,
   });
   ```
3. Object `layerId` changes flow through normal dirty tracking (already works)

---

## 13. Board Duplication

`duplicateBoard` in `src/db/boards.ts` needs to:
1. Deep-copy `layers` array with new layer IDs
2. Build a `layerIdMap` (old → new)
3. Remap `layerId` on each copied object using the map

```typescript
const layerIdMap = new Map<string, string>();
for (const layer of original.layers ?? []) {
  layerIdMap.set(layer.id, crypto.randomUUID());
}

const newBoard: Board = {
  ...original,
  id: newBoardId,
  layers: (original.layers ?? []).map(l => ({
    ...l,
    id: layerIdMap.get(l.id)!,
    boardId: newBoardId,
  })),
  // ...
};

const newObjects = objects.map((obj) => ({
  ...obj,
  id: idMap.get(obj.id)!,
  boardId: newBoardId,
  layerId: obj.layerId ? (layerIdMap.get(obj.layerId) ?? null) : null,
  // ... existing arrow remapping ...
}));
```

---

## 14. Files to Create/Modify

### New files
| File | Purpose |
|---|---|
| `src/components/LayersPanel.tsx` | Layers panel UI component |
| `src/utils/colours.ts` | `hexToRgba()`, `desaturate()`, `LAYER_COLOURS` |

### Modified files
| File | Changes |
|---|---|
| `src/types/index.ts` | Add `Layer` interface, add `layerId` to `CanvasObjectBase`, add `layers` to `Board` |
| `src/db/schema.ts` | Version 2 migration, add `layerId` index |
| `src/db/boards.ts` | `createBoard` init layers, `duplicateBoard` remap layers |
| `src/stores/canvasStore.ts` | Add layer state + all layer actions |
| `src/hooks/useAutoSave.ts` | Include `layers` in board save |
| `src/hooks/useKeyboardShortcuts.ts` | Add `L` shortcut |
| `src/views/BoardView/BoardView.tsx` | Visibility filtering, render LayersPanel, pass layers |
| `src/views/BoardView/TopBar.tsx` | Add Layers toggle button |
| `src/views/BoardView/PropertyPanel.tsx` | Add layer assignment dropdown |
| `src/views/BoardView/Toolbar.tsx` | Set `layerId` on new objects |
| `src/components/canvas/CanvasObject.tsx` | Layer opacity, layer-coloured hover border |
| `src/components/ContextMenu.tsx` | Add "Move to layer" submenu |
| `src/hooks/useClipboard.ts` | Set `layerId` on pasted objects |
| `src/hooks/useDropzone.ts` | Set `layerId` on dropped objects |
| `src/hooks/useArrowDrawing.ts` | Set `layerId` on new arrows |

---

## 15. Implementation Order

1. **Data model & DB** — types, schema migration, board CRUD changes
2. **Store** — layer state, all layer actions, dirty tracking
3. **Auto-save** — persist layers via board record
4. **Rendering** — visibility filtering, opacity, layer-coloured hover borders
5. **LayersPanel UI** — panel component with full CRUD
6. **TopBar** — Layers toggle button
7. **Object creation** — set `layerId` on all creation paths
8. **PropertyPanel** — layer assignment dropdown
9. **Context menu** — "Move to layer" submenu
10. **Keyboard shortcut** — `L` to toggle panel
11. **Board duplication** — remap layer IDs
12. **Polish** — animations, transitions, edge cases

---

## 16. Edge Cases

- **Empty board**: No layers panel content except "Default"
- **Delete layer with selected objects**: Deselect first, then move objects to default, then delete layer
- **All layers hidden**: Canvas appears empty; show a subtle banner "All layers hidden"
- **Active layer is hidden**: Still allow creating objects (they just won't be visible until layer is shown). Show a warning indicator in the toolbar.
- **Active layer is locked**: Prevent object creation on locked layers; auto-switch to default or show a warning.
- **Pasting objects**: Preserve original layer assignment if the layer exists on the target board; otherwise fall back to active layer.
- **Very many layers** (10+): Layers panel should scroll. Keep it reasonable.
