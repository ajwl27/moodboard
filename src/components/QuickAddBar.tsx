import { useState, useRef, useCallback } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { addFileWithFolderSync } from '../db/filesystem';
import { generateThumbnail, getImageDimensions } from '../utils/thumbnails';
import { normalizeUrl, fetchOGMetadata, URL_REGEX } from '../utils/opengraph';
import type { ImageCard, TextCard, LinkCard, FileRecord } from '../types';

export function QuickAddBar() {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const getViewportCenter = () => {
    const cam = useCanvasStore.getState().camera;
    return {
      x: (window.innerWidth / 2) / cam.zoom - cam.x,
      y: (window.innerHeight / 2) / cam.zoom - cam.y,
    };
  };

  const handleSubmit = useCallback(() => {
    const text = value.trim();
    if (!text) return;

    const state = useCanvasStore.getState();
    if (!state.boardId) return;

    const { x: vcx, y: vcy } = getViewportCenter();

    if (URL_REGEX.test(text)) {
      const url = normalizeUrl(text);
      const cardId = crypto.randomUUID();
      const card: LinkCard = {
        id: cardId,
        boardId: state.boardId,
        type: 'link',
        x: vcx - 120,
        y: vcy - 80,
        width: 240,
        height: 160,
        zIndex: state.getMaxZIndex() + 1,
        locked: false,
        colour: '#ffffff',
        url,
        title: '',
        description: '',
        thumbnailUrl: '',
        targetBoardId: null,
        layerId: state.activeLayerId,
      };
      state.addObject(card);
      state.select(card.id);
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
    } else {
      const card: TextCard = {
        id: crypto.randomUUID(),
        boardId: state.boardId,
        type: 'text',
        x: vcx - 100,
        y: vcy - 50,
        width: 200,
        height: 100,
        zIndex: state.getMaxZIndex() + 1,
        locked: false,
        colour: '#ffffff',
        content: text,
        fontSize: 14,
        layerId: state.activeLayerId,
      };
      state.addObject(card);
      state.select(card.id);
    }

    setValue('');
    setExpanded(false);
  }, [value]);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) continue;

        const state = useCanvasStore.getState();
        if (!state.boardId) return;

        const fileId = crypto.randomUUID();
        let thumbnailBlob: Blob | undefined;
        try {
          thumbnailBlob = await generateThumbnail(blob, 800, 800);
        } catch { /* skip */ }

        const fileRecord: FileRecord = {
          id: fileId,
          blob,
          thumbnailBlob,
          originalFilename: `pasted-image-${Date.now()}.png`,
          mimeType: blob.type,
          size: blob.size,
        };
        await addFileWithFolderSync(fileRecord, state.boardId);

        let imgW = 200, imgH = 200;
        try {
          const dims = await getImageDimensions(blob);
          imgW = dims.width;
          imgH = dims.height;
        } catch { /* fallback */ }

        const { x: vcx, y: vcy } = getViewportCenter();
        const card: ImageCard = {
          id: crypto.randomUUID(),
          boardId: state.boardId,
          type: 'image',
          x: vcx - imgW / 2,
          y: vcy - imgH / 2,
          width: imgW,
          height: imgH,
          zIndex: state.getMaxZIndex() + 1,
          locked: false,
          colour: '#ffffff',
          fileId,
          originalFilename: fileRecord.originalFilename,
          caption: '',
          objectFit: 'cover',
          layerId: state.activeLayerId,
        };
        state.addObject(card);
        state.select(card.id);

        setValue('');
        setExpanded(false);
        return;
      }
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setValue('');
      setExpanded(false);
      inputRef.current?.blur();
    }
  }, [handleSubmit]);

  const handleBlur = useCallback(() => {
    if (!value.trim()) {
      setExpanded(false);
    }
  }, [value]);

  const pill: React.CSSProperties = {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(250, 248, 245, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
    borderRadius: expanded ? 14 : 24,
    padding: expanded ? '6px 12px' : '6px 14px',
    transition: 'all 0.2s ease',
    width: expanded ? 360 : 'auto',
    cursor: expanded ? 'default' : 'pointer',
  };

  if (!expanded) {
    return (
      <div
        style={pill}
        onClick={() => {
          setExpanded(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 6, fontWeight: 500, userSelect: 'none' }}>
          Quick Add
        </span>
      </div>
    );
  }

  return (
    <div style={pill}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onPaste={handlePaste}
        placeholder="Paste URL, text, or image..."
        style={{
          flex: 1,
          border: 'none',
          background: 'transparent',
          outline: 'none',
          fontSize: 13,
          color: 'var(--text)',
          padding: '4px 8px',
          fontFamily: 'inherit',
        }}
      />
      <button
        onClick={handleSubmit}
        style={{
          border: 'none',
          background: value.trim() ? 'var(--accent)' : 'var(--border)',
          color: value.trim() ? '#fff' : 'var(--text-tertiary)',
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: value.trim() ? 'pointer' : 'default',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
      >
        Add
      </button>
    </div>
  );
}
