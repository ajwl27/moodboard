import { useCallback, useRef } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import { addFileWithFolderSync } from '../../db/filesystem';
import { generateThumbnail, getImageDimensions } from '../../utils/thumbnails';
import { normalizeUrl, fetchOGMetadata } from '../../utils/opengraph';
import type { FileRecord, LinkCard as LinkCardType } from '../../types';

export function Toolbar() {
  const toolMode = useCanvasStore((s) => s.toolMode);
  const canUndo = useCanvasStore((s) => s.undoStack.length > 0);
  const canRedo = useCanvasStore((s) => s.redoStack.length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addTextCard = useCallback(() => {
    const state = useCanvasStore.getState();
    if (!state.boardId) return;
    const cam = state.camera;
    const cx = (window.innerWidth / 2) / cam.zoom - cam.x;
    const cy = (window.innerHeight / 2) / cam.zoom - cam.y;
    state.addObject({
      id: crypto.randomUUID(), boardId: state.boardId, type: 'text',
      x: cx - 100, y: cy - 50, width: 200, height: 100,
      zIndex: state.getMaxZIndex() + 1, locked: false, colour: '#ffffff',
      content: '', fontSize: 14, layerId: state.activeLayerId,
    });
    state.select(state.objects[state.objects.length - 1]?.id ?? '');
  }, []);

  const addImage = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const state = useCanvasStore.getState();
    if (!state.boardId) return;
    const cam = state.camera;
    const cx = (window.innerWidth / 2) / cam.zoom - cam.x;
    const cy = (window.innerHeight / 2) / cam.zoom - cam.y;
    const file = files[0];
    const fileId = crypto.randomUUID();
    let thumbnailBlob: Blob | undefined;
    try { thumbnailBlob = await generateThumbnail(file, 800, 800); } catch { /* */ }
    const fileRecord: FileRecord = { id: fileId, blob: file, thumbnailBlob, originalFilename: file.name, mimeType: file.type, size: file.size };
    await addFileWithFolderSync(fileRecord, state.boardId);
    let imgW = 200, imgH = 200;
    try {
      const dims = await getImageDimensions(file);
      imgW = dims.width;
      imgH = dims.height;
    } catch { /* fallback */ }
    state.addObject({
      id: crypto.randomUUID(), boardId: state.boardId, type: 'image',
      x: cx - imgW / 2, y: cy - imgH / 2, width: imgW, height: imgH,
      zIndex: state.getMaxZIndex() + 1, locked: false, colour: '#ffffff',
      fileId, originalFilename: file.name, caption: '', objectFit: 'cover',
      layerId: state.activeLayerId,
    });
    e.target.value = '';
  }, []);

  const addLink = useCallback(() => {
    const raw = prompt('Enter URL:');
    if (!raw) return;
    const url = normalizeUrl(raw);
    const state = useCanvasStore.getState();
    if (!state.boardId) return;
    const cam = state.camera;
    const cx = (window.innerWidth / 2) / cam.zoom - cam.x;
    const cy = (window.innerHeight / 2) / cam.zoom - cam.y;
    const cardId = crypto.randomUUID();
    const card: LinkCardType = {
      id: cardId, boardId: state.boardId, type: 'link',
      x: cx - 120, y: cy - 80, width: 240, height: 160,
      zIndex: state.getMaxZIndex() + 1, locked: false, colour: '#ffffff',
      url, title: '', description: '', thumbnailUrl: '', targetBoardId: null,
      layerId: state.activeLayerId,
    };
    state.addObject(card);
    // Fetch OG metadata in background
    fetchOGMetadata(url).then((og) => {
      if (!og.title && !og.description && !og.image) return;
      useCanvasStore.setState((s) => ({
        objects: s.objects.map((o) =>
          o.id === cardId && o.type === 'link'
            ? { ...o, title: og.title || o.title, description: og.description || o.description, thumbnailUrl: og.image || o.thumbnailUrl }
            : o
        ) as typeof s.objects,
        dirtyObjectIds: new Set(s.dirtyObjectIds).add(cardId),
      }));
    });
  }, []);

  const toggleArrowMode = useCallback(() => {
    const state = useCanvasStore.getState();
    state.setToolMode(state.toolMode === 'arrow' ? 'select' : 'arrow');
  }, []);

  const toggleDrawMode = useCallback(() => {
    const state = useCanvasStore.getState();
    state.setToolMode(state.toolMode === 'draw' ? 'select' : 'draw');
  }, []);

  const addNoteCard = useCallback(() => {
    const state = useCanvasStore.getState();
    if (!state.boardId) return;
    const cam = state.camera;
    const cx = (window.innerWidth / 2) / cam.zoom - cam.x;
    const cy = (window.innerHeight / 2) / cam.zoom - cam.y;
    state.addObject({
      id: crypto.randomUUID(), boardId: state.boardId, type: 'note',
      x: cx - 140, y: cy - 100, width: 280, height: 200,
      zIndex: state.getMaxZIndex() + 1, locked: false, colour: '#faf8f5',
      title: '', content: '', layerId: state.activeLayerId,
    });
    const newObj = state.objects[state.objects.length - 1];
    if (newObj) {
      state.select(newObj.id);
      state.setEditingObjectId(newObj.id);
    }
  }, []);

  const addGroup = useCallback(() => {
    const state = useCanvasStore.getState();
    if (!state.boardId) return;
    const cam = state.camera;
    const cx = (window.innerWidth / 2) / cam.zoom - cam.x;
    const cy = (window.innerHeight / 2) / cam.zoom - cam.y;
    state.addObject({
      id: crypto.randomUUID(), boardId: state.boardId, type: 'group',
      x: cx - 150, y: cy - 100, width: 300, height: 200,
      zIndex: state.getMinZIndex() - 1, locked: false, colour: '#e8e8e8',
      label: 'Group', backgroundColour: 'rgba(91, 123, 154, 0.06)', borderStyle: 'dashed',
      layerId: state.activeLayerId,
    });
  }, []);

  const tools = [
    { id: 'text', label: 'Text', shortcut: 'T', icon: textIcon, onClick: addTextCard, active: false },
    { id: 'image', label: 'Image', shortcut: '', icon: imageIcon, onClick: addImage, active: false },
    { id: 'link', label: 'Link', shortcut: '', icon: linkIcon, onClick: addLink, active: false },
    { id: 'note', label: 'Note', shortcut: 'N', icon: noteIcon, onClick: addNoteCard, active: false },
    { id: 'draw', label: 'Draw', shortcut: 'D', icon: drawIcon, onClick: toggleDrawMode, active: toolMode === 'draw' },
    { id: 'arrow', label: 'Arrow', shortcut: 'A', icon: arrowIcon, onClick: toggleArrowMode, active: toolMode === 'arrow' },
    { id: 'group', label: 'Group', shortcut: 'G', icon: groupIcon, onClick: addGroup, active: false },
  ];

  const container: React.CSSProperties = {
    position: 'absolute',
    left: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    zIndex: 1000,
    background: 'rgba(250, 248, 245, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 12,
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
    padding: 6,
  };

  const historyButtons = [
    { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: undoIcon, onClick: () => useCanvasStore.getState().undo(), disabled: !canUndo },
    { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', icon: redoIcon, onClick: () => useCanvasStore.getState().redo(), disabled: !canRedo },
  ];

  return (
    <div style={container}>
      {historyButtons.map((btn) => (
        <button
          key={btn.id}
          onClick={btn.onClick}
          title={`${btn.label} (${btn.shortcut})`}
          disabled={btn.disabled}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            color: btn.disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
            border: 'none',
            cursor: btn.disabled ? 'default' : 'pointer',
            transition: 'all 0.15s',
            opacity: btn.disabled ? 0.4 : 1,
          }}
          onMouseEnter={(e) => {
            if (!btn.disabled) {
              e.currentTarget.style.background = 'var(--accent-light)';
              e.currentTarget.style.color = 'var(--accent)';
            }
          }}
          onMouseLeave={(e) => {
            if (!btn.disabled) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#7A7268';
            }
          }}
        >
          {btn.icon}
        </button>
      ))}
      <div style={{ height: 1, background: 'var(--border-light)', margin: '2px 6px' }} />
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={tool.onClick}
          title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: tool.active ? 'var(--accent)' : 'transparent',
            color: tool.active ? '#faf8f5' : '#7A7268',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!tool.active) {
              e.currentTarget.style.background = 'var(--accent-light)';
              e.currentTarget.style.color = 'var(--accent)';
            }
          }}
          onMouseLeave={(e) => {
            if (!tool.active) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#7A7268';
            }
          }}
        >
          {tool.icon}
        </button>
      ))}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />
    </div>
  );
}

// SVG icons
const undoIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6" /><path d="M3 13a9 9 0 0 1 15.36-6.36L21 9" />
  </svg>
);
const redoIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 7v6h-6" /><path d="M21 13a9 9 0 0 0-15.36-6.36L3 9" />
  </svg>
);
const textIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7V4h16v3" /><line x1="12" y1="4" x2="12" y2="20" /><line x1="8" y1="20" x2="16" y2="20" />
  </svg>
);
const imageIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" />
  </svg>
);
const linkIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const arrowIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const drawIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);
const noteIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const groupIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="4 3" />
  </svg>
);
