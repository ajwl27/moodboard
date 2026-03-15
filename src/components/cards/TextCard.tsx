import { useRef, useEffect, useCallback } from 'react';
import { useCanvasStore } from '../../stores/canvasStore';
import type { TextCard as TextCardType } from '../../types';

interface Props {
  obj: TextCardType;
}

export function TextCard({ obj }: Props) {
  const editingObjectId = useCanvasStore((s) => s.editingObjectId);
  const isEditing = editingObjectId === obj.id;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useCanvasStore.getState().setEditingObjectId(obj.id);
  }, [obj.id]);

  const handleBlur = useCallback(() => {
    useCanvasStore.getState().setEditingObjectId(null);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    useCanvasStore.setState((s) => ({
      objects: s.objects.map((o) => o.id === obj.id ? { ...o, content: e.target.value } : o),
      dirtyObjectIds: new Set(s.dirtyObjectIds).add(obj.id),
    }));
  }, [obj.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') useCanvasStore.getState().setEditingObjectId(null);
  }, []);

  return (
    <div
      onDoubleClick={handleDoubleClick}
      style={{
        width: '100%',
        height: '100%',
        padding: 14,
        fontSize: obj.fontSize,
        lineHeight: 1.6,
        overflow: 'hidden',
        color: 'var(--text)',
      }}
    >
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={obj.content}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: obj.fontSize,
            lineHeight: 1.6,
            fontFamily: 'inherit',
            background: 'transparent',
            padding: 0,
            color: 'var(--text)',
          }}
        />
      ) : (
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {obj.content || (
            <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Double-click to edit...</span>
          )}
        </div>
      )}
    </div>
  );
}
