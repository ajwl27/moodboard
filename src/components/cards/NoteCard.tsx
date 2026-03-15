import { useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { NoteCard as NoteCardType } from '../../types';

interface Props {
  obj: NoteCardType;
}

export function NoteCard({ obj }: Props) {
  const editingObjectId = useCanvasStore((s) => s.editingObjectId);
  const isEditing = editingObjectId === obj.id;
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useCanvasStore.getState().setEditingObjectId(obj.id);
  }, [obj.id]);

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Don't exit editing if focus moves between title and content fields
    const related = e.relatedTarget as HTMLElement | null;
    if (related && (related === titleRef.current || related === contentRef.current)) return;
    useCanvasStore.getState().setEditingObjectId(null);
  }, []);

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    useCanvasStore.setState((s) => ({
      objects: s.objects.map((o) => o.id === obj.id ? { ...o, title: e.target.value } : o),
      dirtyObjectIds: new Set(s.dirtyObjectIds).add(obj.id),
    }));
  }, [obj.id]);

  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    useCanvasStore.setState((s) => ({
      objects: s.objects.map((o) => o.id === obj.id ? { ...o, content: e.target.value } : o),
      dirtyObjectIds: new Set(s.dirtyObjectIds).add(obj.id),
    }));
  }, [obj.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') useCanvasStore.getState().setEditingObjectId(null);
  }, []);

  const fontSize = obj.fontSize ?? 14;
  const titleFontSize = obj.titleFontSize ?? 18;
  const fontColour = obj.fontColour || '#2C2825';

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 6,
        color: fontColour,
      }}
    >
      {/* Title */}
      <div style={{ padding: '8px 10px 0', flexShrink: 0 }}>
        {isEditing ? (
          <input
            ref={titleRef}
            value={obj.title}
            onChange={handleTitleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: titleFontSize,
              fontWeight: 700,
              fontFamily: 'inherit',
              background: 'transparent',
              padding: 0,
              textAlign: 'center',
              color: fontColour,
            }}
          />
        ) : (
          <div style={{
            fontSize: titleFontSize,
            fontWeight: 700,
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {obj.title || (
              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic', fontWeight: 400 }}>Untitled</span>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{
        height: 1,
        background: 'var(--border-light, rgba(0,0,0,0.08))',
        margin: '6px 10px',
        flexShrink: 0,
      }} />

      {/* Content */}
      <div style={{ flex: 1, padding: '0 10px 8px', overflow: 'hidden' }}>
        {isEditing ? (
          <textarea
            ref={contentRef}
            value={obj.content}
            onChange={handleContentChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize,
              lineHeight: 1.6,
              fontFamily: 'inherit',
              background: 'transparent',
              padding: 0,
              color: fontColour,
            }}
          />
        ) : (
          <div style={{
            fontSize,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {obj.content || (
              <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Double-click to edit...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
