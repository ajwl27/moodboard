import { create } from 'zustand';
import type { Camera, CanvasObject, ToolMode, Layer } from '../types';
import type { GuideLine } from '../utils/alignmentGuides';

// --- History types ---

interface HistoryEntry {
  undo: CanvasObject[];
  redo: CanvasObject[];
  deletedIds?: string[];
  createdIds?: string[];
}

interface CanvasState {
  boardId: string | null;
  objects: CanvasObject[];
  camera: Camera;
  selectedIds: Set<string>;
  toolMode: ToolMode;
  editingObjectId: string | null;
  clipboardObjects: CanvasObject[];
  gridEnabled: boolean;
  gridSize: number;

  // History
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];

  // Lightbox
  lightboxFileId: string | null;

  // Crop modal
  cropModalObjectId: string | null;

  // Layers
  layers: Layer[];
  layersPanelOpen: boolean;
  activeLayerId: string | null;

  // Draw tool
  drawBrushSize: number;
  drawBrushColour: string;
  drawIsEraser: boolean;

  // Alignment guides
  activeGuides: GuideLine[];

  // Dirty tracking for auto-save
  dirtyObjectIds: Set<string>;
  boardDirty: boolean;
}

interface CanvasActions {
  // Board lifecycle
  loadBoard: (boardId: string, objects: CanvasObject[], camera: Camera, layers?: Layer[]) => void;
  unloadBoard: () => void;

  // Camera
  setCamera: (camera: Camera) => void;

  // Object CRUD
  addObject: (obj: CanvasObject) => void;
  addObjects: (objs: CanvasObject[]) => void;
  updateObject: (id: string, changes: Partial<CanvasObject>) => void;
  updateObjects: (updates: Array<{ id: string; changes: Partial<CanvasObject> }>) => void;
  deleteSelectedObjects: () => void;
  removeObjects: (ids: string[]) => void;

  // Selection
  select: (id: string) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setSelectedIds: (ids: Set<string>) => void;

  // Tool mode
  setToolMode: (mode: ToolMode) => void;
  setEditingObjectId: (id: string | null) => void;

  // Clipboard
  copySelected: () => void;
  pasteClipboard: (offsetX?: number, offsetY?: number) => void;
  duplicateSelected: () => void;

  // Grid
  toggleGrid: () => void;

  // Layers
  addLayer: (name: string, colour: string) => void;
  removeLayer: (layerId: string) => void;
  updateLayer: (layerId: string, changes: Partial<Layer>) => void;
  reorderLayers: (layerIds: string[]) => void;
  toggleLayerVisibility: (layerId: string) => void;
  toggleLayerLock: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setActiveLayerId: (layerId: string | null) => void;
  toggleLayersPanel: () => void;
  moveSelectedToLayer: (layerId: string | null) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: (entry: HistoryEntry) => void;

  // Dirty tracking
  clearDirty: () => void;

  // Lightbox
  setLightboxFileId: (id: string | null) => void;

  // Crop modal
  setCropModalObjectId: (id: string | null) => void;

  // Alignment guides
  setActiveGuides: (guides: GuideLine[]) => void;

  // Draw tool
  setDrawBrushSize: (size: number) => void;
  setDrawBrushColour: (colour: string) => void;
  setDrawIsEraser: (isEraser: boolean) => void;

  // Helpers
  getObject: (id: string) => CanvasObject | undefined;
  getMaxZIndex: () => number;
  getMinZIndex: () => number;
}

export type CanvasStore = CanvasState & CanvasActions;

const MAX_HISTORY = 100;

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  boardId: null,
  objects: [],
  camera: { x: 0, y: 0, zoom: 1 },
  selectedIds: new Set<string>(),
  toolMode: 'select',
  editingObjectId: null,
  clipboardObjects: [],
  gridEnabled: false,
  gridSize: 20,
  lightboxFileId: null,
  cropModalObjectId: null,
  layers: [],
  layersPanelOpen: false,
  activeLayerId: null,
  undoStack: [],
  redoStack: [],
  drawBrushSize: 3,
  drawBrushColour: '#2C2825',
  drawIsEraser: false,
  activeGuides: [],
  dirtyObjectIds: new Set<string>(),
  boardDirty: false,

  // --- Board lifecycle ---
  loadBoard: (boardId, objects, camera, layers) =>
    set({
      boardId,
      objects,
      camera,
      layers: layers ?? [],
      activeLayerId: null,
      selectedIds: new Set(),
      toolMode: 'select',
      editingObjectId: null,
      lightboxFileId: null,
      cropModalObjectId: null,
      activeGuides: [],
      undoStack: [],
      redoStack: [],
      dirtyObjectIds: new Set(),
      boardDirty: false,
    }),

  unloadBoard: () =>
    set({
      boardId: null,
      objects: [],
      camera: { x: 0, y: 0, zoom: 1 },
      layers: [],
      activeLayerId: null,
      layersPanelOpen: false,
      selectedIds: new Set(),
      editingObjectId: null,
      lightboxFileId: null,
      cropModalObjectId: null,
      activeGuides: [],
      undoStack: [],
      redoStack: [],
      dirtyObjectIds: new Set(),
      boardDirty: false,
    }),

  // --- Camera ---
  setCamera: (camera) =>
    set({ camera, boardDirty: true }),

  // --- Object CRUD ---
  addObject: (obj) => {
    const prev: CanvasObject[] = [];
    const entry: HistoryEntry = { undo: prev, redo: [obj], createdIds: [obj.id] };
    set((s) => ({
      objects: [...s.objects, obj],
      dirtyObjectIds: new Set(s.dirtyObjectIds).add(obj.id),
      undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
      redoStack: [],
    }));
  },

  addObjects: (objs) => {
    if (objs.length === 0) return;
    const entry: HistoryEntry = {
      undo: [],
      redo: objs,
      createdIds: objs.map((o) => o.id),
    };
    set((s) => {
      const dirty = new Set(s.dirtyObjectIds);
      objs.forEach((o) => dirty.add(o.id));
      return {
        objects: [...s.objects, ...objs],
        dirtyObjectIds: dirty,
        undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
        redoStack: [],
      };
    });
  },

  updateObject: (id, changes) => {
    const prev = get().objects.find((o) => o.id === id);
    if (!prev) return;
    const next = { ...prev, ...changes } as CanvasObject;
    const entry: HistoryEntry = { undo: [prev], redo: [next] };
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? next : o)),
      dirtyObjectIds: new Set(s.dirtyObjectIds).add(id),
      undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
      redoStack: [],
    }));
  },

  updateObjects: (updates) => {
    if (updates.length === 0) return;
    const state = get();
    const prevObjs: CanvasObject[] = [];
    const nextObjs: CanvasObject[] = [];
    const idChanges = new Map<string, Partial<CanvasObject>>();

    for (const { id, changes } of updates) {
      const prev = state.objects.find((o) => o.id === id);
      if (!prev) continue;
      const next = { ...prev, ...changes } as CanvasObject;
      prevObjs.push(prev);
      nextObjs.push(next);
      idChanges.set(id, changes);
    }

    if (prevObjs.length === 0) return;

    const entry: HistoryEntry = { undo: prevObjs, redo: nextObjs };
    set((s) => {
      const dirty = new Set(s.dirtyObjectIds);
      for (const id of idChanges.keys()) dirty.add(id);
      return {
        objects: s.objects.map((o) => {
          const c = idChanges.get(o.id);
          return c ? ({ ...o, ...c } as CanvasObject) : o;
        }),
        dirtyObjectIds: dirty,
        undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
        redoStack: [],
      };
    });
  },

  deleteSelectedObjects: () => {
    const { selectedIds, objects } = get();
    if (selectedIds.size === 0) return;
    const deleted = objects.filter((o) => selectedIds.has(o.id));
    const entry: HistoryEntry = {
      undo: deleted,
      redo: [],
      deletedIds: deleted.map((o) => o.id),
    };
    set((s) => {
      const dirty = new Set(s.dirtyObjectIds);
      deleted.forEach((o) => dirty.add(o.id));
      return {
        objects: s.objects.filter((o) => !selectedIds.has(o.id)),
        selectedIds: new Set(),
        editingObjectId: null,
        dirtyObjectIds: dirty,
        undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
        redoStack: [],
      };
    });
  },

  removeObjects: (ids) => {
    const idSet = new Set(ids);
    const deleted = get().objects.filter((o) => idSet.has(o.id));
    if (deleted.length === 0) return;
    const entry: HistoryEntry = { undo: deleted, redo: [], deletedIds: ids };
    set((s) => {
      const dirty = new Set(s.dirtyObjectIds);
      ids.forEach((id) => dirty.add(id));
      return {
        objects: s.objects.filter((o) => !idSet.has(o.id)),
        selectedIds: new Set([...s.selectedIds].filter((id) => !idSet.has(id))),
        dirtyObjectIds: dirty,
        undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
        redoStack: [],
      };
    });
  },

  // --- Selection ---
  select: (id) => set({ selectedIds: new Set([id]) }),
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  selectAll: () =>
    set((s) => ({
      selectedIds: new Set(s.objects.map((o) => o.id)),
    })),
  deselectAll: () => set({ selectedIds: new Set(), editingObjectId: null }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),

  // --- Tool mode ---
  setToolMode: (mode) => set({ toolMode: mode }),
  setEditingObjectId: (id) => set({ editingObjectId: id }),

  // --- Clipboard ---
  copySelected: () => {
    const { selectedIds, objects } = get();
    const copied = objects.filter((o) => selectedIds.has(o.id));
    set({ clipboardObjects: copied });
  },

  pasteClipboard: (offsetX = 20, offsetY = 20) => {
    const { clipboardObjects, objects } = get();
    if (clipboardObjects.length === 0) return;
    const maxZ = objects.length > 0 ? Math.max(...objects.map((o) => o.zIndex)) : 0;
    const idMap = new Map<string, string>();
    clipboardObjects.forEach((o) => idMap.set(o.id, crypto.randomUUID()));

    const pasted = clipboardObjects.map((o, i) => {
      const newObj = {
        ...o,
        id: idMap.get(o.id)!,
        x: o.x + offsetX,
        y: o.y + offsetY,
        zIndex: maxZ + 1 + i,
      } as CanvasObject;
      if (o.type === 'arrow') {
        return {
          ...newObj,
          startObjectId: o.startObjectId ? (idMap.get(o.startObjectId) ?? o.startObjectId) : null,
          endObjectId: o.endObjectId ? (idMap.get(o.endObjectId) ?? o.endObjectId) : null,
        } as CanvasObject;
      }
      return newObj;
    });

    const entry: HistoryEntry = {
      undo: [],
      redo: pasted,
      createdIds: pasted.map((o) => o.id),
    };

    set((s) => {
      const dirty = new Set(s.dirtyObjectIds);
      pasted.forEach((o) => dirty.add(o.id));
      return {
        objects: [...s.objects, ...pasted],
        selectedIds: new Set(pasted.map((o) => o.id)),
        dirtyObjectIds: dirty,
        undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
        redoStack: [],
      };
    });
  },

  duplicateSelected: () => {
    get().copySelected();
    get().pasteClipboard();
  },

  // --- Grid ---
  toggleGrid: () => set((s) => ({ gridEnabled: !s.gridEnabled })),

  // --- Layers ---
  addLayer: (name, colour) => {
    const layer: Layer = {
      id: crypto.randomUUID(),
      boardId: get().boardId!,
      name,
      colour,
      visible: true,
      locked: false,
      opacity: 1,
      order: get().layers.length,
    };
    set((s) => ({
      layers: [...s.layers, layer],
      activeLayerId: layer.id,
      boardDirty: true,
    }));
  },

  removeLayer: (layerId) => {
    set((s) => {
      const dirty = new Set(s.dirtyObjectIds);
      const objects = s.objects.map((o) => {
        if (o.layerId === layerId) {
          dirty.add(o.id);
          return { ...o, layerId: null } as CanvasObject;
        }
        return o;
      });
      return {
        objects,
        layers: s.layers.filter((l) => l.id !== layerId),
        activeLayerId: s.activeLayerId === layerId ? null : s.activeLayerId,
        dirtyObjectIds: dirty,
        boardDirty: true,
      };
    });
  },

  updateLayer: (layerId, changes) => {
    set((s) => ({
      layers: s.layers.map((l) => (l.id === layerId ? { ...l, ...changes } : l)),
      boardDirty: true,
    }));
  },

  reorderLayers: (layerIds) => {
    set((s) => {
      const layerMap = new Map(s.layers.map((l) => [l.id, l]));
      const reordered = layerIds
        .map((id, i) => {
          const l = layerMap.get(id);
          return l ? { ...l, order: i } : null;
        })
        .filter(Boolean) as Layer[];
      return { layers: reordered, boardDirty: true };
    });
  },

  toggleLayerVisibility: (layerId) => {
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
      boardDirty: true,
    }));
  },

  toggleLayerLock: (layerId) => {
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId ? { ...l, locked: !l.locked } : l
      ),
      boardDirty: true,
    }));
  },

  setLayerOpacity: (layerId, opacity) => {
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l
      ),
      boardDirty: true,
    }));
  },

  setActiveLayerId: (layerId) => set({ activeLayerId: layerId }),

  toggleLayersPanel: () => set((s) => ({ layersPanelOpen: !s.layersPanelOpen })),

  moveSelectedToLayer: (layerId) => {
    const { selectedIds } = get();
    if (selectedIds.size === 0) return;
    const updates = [...selectedIds].map((id) => ({
      id,
      changes: { layerId } as Partial<CanvasObject>,
    }));
    get().updateObjects(updates);
  },

  // --- History ---
  pushHistory: (entry) =>
    set((s) => ({
      undoStack: [...s.undoStack.slice(-MAX_HISTORY + 1), entry],
      redoStack: [],
    })),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    const reverseEntry: HistoryEntry = {
      undo: entry.redo,
      redo: entry.undo,
      deletedIds: entry.createdIds,
      createdIds: entry.deletedIds,
    };

    set((s) => {
      let newObjects = [...s.objects];
      const dirty = new Set(s.dirtyObjectIds);

      // Remove created objects
      if (entry.createdIds) {
        const createdSet = new Set(entry.createdIds);
        newObjects = newObjects.filter((o) => !createdSet.has(o.id));
        entry.createdIds.forEach((id) => dirty.add(id));
      }

      // Restore deleted objects
      if (entry.deletedIds && entry.undo.length > 0) {
        newObjects.push(...entry.undo);
        entry.deletedIds.forEach((id) => dirty.add(id));
      }

      // Apply property changes (undo = previous state)
      if (!entry.deletedIds && !entry.createdIds) {
        const undoMap = new Map(entry.undo.map((o) => [o.id, o]));
        newObjects = newObjects.map((o) => undoMap.get(o.id) ?? o);
        entry.undo.forEach((o) => dirty.add(o.id));
      }

      return {
        objects: newObjects,
        dirtyObjectIds: dirty,
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, reverseEntry],
      };
    });
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    const reverseEntry: HistoryEntry = {
      undo: entry.redo,
      redo: entry.undo,
      deletedIds: entry.createdIds,
      createdIds: entry.deletedIds,
    };

    set((s) => {
      let newObjects = [...s.objects];
      const dirty = new Set(s.dirtyObjectIds);

      if (entry.createdIds) {
        const createdSet = new Set(entry.createdIds);
        newObjects = newObjects.filter((o) => !createdSet.has(o.id));
        entry.createdIds.forEach((id) => dirty.add(id));
      }

      if (entry.deletedIds && entry.undo.length > 0) {
        newObjects.push(...entry.undo);
        entry.deletedIds.forEach((id) => dirty.add(id));
      }

      if (!entry.deletedIds && !entry.createdIds) {
        const undoMap = new Map(entry.undo.map((o) => [o.id, o]));
        newObjects = newObjects.map((o) => undoMap.get(o.id) ?? o);
        entry.undo.forEach((o) => dirty.add(o.id));
      }

      return {
        objects: newObjects,
        dirtyObjectIds: dirty,
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, reverseEntry],
      };
    });
  },

  // --- Lightbox ---
  setLightboxFileId: (id) => set({ lightboxFileId: id }),

  // --- Crop modal ---
  setCropModalObjectId: (id) => set({ cropModalObjectId: id }),

  // --- Alignment guides ---
  setActiveGuides: (guides) => set({ activeGuides: guides }),

  // --- Draw tool ---
  setDrawBrushSize: (size) => set({ drawBrushSize: size }),
  setDrawBrushColour: (colour) => set({ drawBrushColour: colour }),
  setDrawIsEraser: (isEraser) => set({ drawIsEraser: isEraser }),

  // --- Dirty tracking ---
  clearDirty: () => set({ dirtyObjectIds: new Set(), boardDirty: false }),

  // --- Helpers ---
  getObject: (id) => get().objects.find((o) => o.id === id),
  getMaxZIndex: () => {
    const { objects } = get();
    return objects.length > 0 ? Math.max(...objects.map((o) => o.zIndex)) : 0;
  },
  getMinZIndex: () => {
    const { objects } = get();
    return objects.length > 0 ? Math.min(...objects.map((o) => o.zIndex)) : 0;
  },
}));
