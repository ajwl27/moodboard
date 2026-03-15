import { useEffect } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { boundingRect } from '../utils/geometry';
import { clamp } from '../utils/geometry';
import type { NavigateFunction } from 'react-router-dom';

export function useKeyboardShortcuts(navigate: NavigateFunction) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useCanvasStore.getState();
      const isEditing = state.editingObjectId !== null;
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Shortcuts that work even during editing
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        state.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        state.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Z') {
        e.preventDefault();
        state.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        state.redo();
        return;
      }

      // Don't handle other shortcuts while editing
      if (isEditing || isInput) return;

      // Ctrl+A — select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        state.selectAll();
        return;
      }

      // Ctrl+C — copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        state.copySelected();
        return;
      }

      // Ctrl+V — paste (handled by useClipboard for external, internal paste here)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (state.clipboardObjects.length > 0) {
          e.preventDefault();
          state.pasteClipboard();
        }
        return;
      }

      // Ctrl+D — duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        state.duplicateSelected();
        return;
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        state.deleteSelectedObjects();
        return;
      }

      // Arrow keys — nudge
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const amount = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0;
        const dy = e.key === 'ArrowUp' ? -amount : e.key === 'ArrowDown' ? amount : 0;
        const updates = [...state.selectedIds].map((id) => ({
          id,
          changes: { x: (state.objects.find((o) => o.id === id)?.x ?? 0) + dx, y: (state.objects.find((o) => o.id === id)?.y ?? 0) + dy },
        }));
        if (updates.length > 0) state.updateObjects(updates);
        return;
      }

      // Escape — deselect / exit mode
      if (e.key === 'Escape') {
        if (state.toolMode !== 'select') {
          state.setToolMode('select');
        } else {
          state.deselectAll();
        }
        return;
      }

      // T — new text card
      if (e.key === 't' || e.key === 'T') {
        const cam = state.camera;
        const cx = (window.innerWidth / 2) / cam.zoom - cam.x;
        const cy = (window.innerHeight / 2) / cam.zoom - cam.y;
        const card = {
          id: crypto.randomUUID(),
          boardId: state.boardId!,
          type: 'text' as const,
          x: cx - 100,
          y: cy - 50,
          width: 200,
          height: 100,
          zIndex: state.getMaxZIndex() + 1,
          locked: false,
          colour: '#ffffff',
          content: '',
          fontSize: 14,
          layerId: state.activeLayerId,
        };
        state.addObject(card);
        state.select(card.id);
        state.setEditingObjectId(card.id);
        return;
      }

      // A — arrow mode
      if (e.key === 'a' || e.key === 'A') {
        state.setToolMode(state.toolMode === 'arrow' ? 'select' : 'arrow');
        return;
      }

      // L — toggle layers panel
      if (e.key === 'l' || e.key === 'L') {
        state.toggleLayersPanel();
        return;
      }

      // G — new group region
      if (e.key === 'g' || e.key === 'G') {
        const cam = state.camera;
        const cx = (window.innerWidth / 2) / cam.zoom - cam.x;
        const cy = (window.innerHeight / 2) / cam.zoom - cam.y;
        const card = {
          id: crypto.randomUUID(),
          boardId: state.boardId!,
          type: 'group' as const,
          x: cx - 150,
          y: cy - 100,
          width: 300,
          height: 200,
          zIndex: state.getMinZIndex() - 1,
          locked: false,
          colour: '#e8e8e8',
          label: 'Group',
          backgroundColour: 'rgba(200, 200, 200, 0.2)',
          borderStyle: 'dashed' as const,
          layerId: state.activeLayerId,
        };
        state.addObject(card);
        state.select(card.id);
        return;
      }

      // Ctrl+0 — reset zoom
      if ((e.ctrlKey || e.metaKey) && e.key === '0' && !e.shiftKey) {
        e.preventDefault();
        const cam = state.camera;
        useCanvasStore.setState({
          camera: { ...cam, zoom: 1 },
          boardDirty: true,
        });
        return;
      }

      // Ctrl+Shift+0 — zoom to fit
      if ((e.ctrlKey || e.metaKey) && e.key === ')') {
        e.preventDefault();
        const rects = state.objects.map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
        const bounds = boundingRect(rects);
        if (!bounds) return;
        const padding = 60;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scaleX = (vw - padding * 2) / bounds.width;
        const scaleY = (vh - padding * 2) / bounds.height;
        const zoom = clamp(Math.min(scaleX, scaleY), 0.1, 5);
        const cx = bounds.x + bounds.width / 2;
        const cy = bounds.y + bounds.height / 2;
        useCanvasStore.setState({
          camera: {
            x: (vw / 2) / zoom - cx,
            y: (vh / 2) / zoom - cy,
            zoom,
          },
          boardDirty: true,
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
