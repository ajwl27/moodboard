import { useState, useCallback, useRef, useEffect } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { hexToRgba, LAYER_COLOURS } from '../utils/colours';
import type { Layer } from '../types';

export function LayersPanel() {
  const layers = useCanvasStore((s) => s.layers);
  const activeLayerId = useCanvasStore((s) => s.activeLayerId);
  const objects = useCanvasStore((s) => s.objects);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColour, setNewColour] = useState(LAYER_COLOURS[6]); // indigo default
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuLayerId, setMenuLayerId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddForm) nameInputRef.current?.focus();
  }, [showAddForm]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const sortedLayers = [...layers].sort((a, b) => a.order - b.order);

  const handleAdd = useCallback(() => {
    const name = newName.trim() || `Layer ${layers.length + 1}`;
    useCanvasStore.getState().addLayer(name, newColour);
    setNewName('');
    setNewColour(LAYER_COLOURS[(layers.length + 1) % LAYER_COLOURS.length]);
    setShowAddForm(false);
  }, [newName, newColour, layers.length]);

  const handleDelete = useCallback((layerId: string) => {
    const count = objects.filter((o) => o.layerId === layerId).length;
    if (count > 0 && !confirm(`Move ${count} object${count > 1 ? 's' : ''} to Default layer and delete this layer?`)) return;
    useCanvasStore.getState().removeLayer(layerId);
    setMenuLayerId(null);
  }, [objects]);

  const startRename = useCallback((layer: Layer) => {
    setEditingId(layer.id);
    setEditName(layer.name);
    setMenuLayerId(null);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editName.trim()) {
      useCanvasStore.getState().updateLayer(editingId, { name: editName.trim() });
    }
    setEditingId(null);
  }, [editingId, editName]);

  const handleDragStart = useCallback((layerId: string) => {
    setDragId(layerId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    setDragOverId(layerId);
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const ordered = sortedLayers.map((l) => l.id);
    const fromIdx = ordered.indexOf(dragId);
    const toIdx = ordered.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, dragId);
    useCanvasStore.getState().reorderLayers(ordered);
    setDragId(null);
    setDragOverId(null);
  }, [dragId, sortedLayers]);

  const panel: React.CSSProperties = {
    position: 'absolute',
    right: 12,
    top: 72,
    width: 240,
    maxHeight: 'calc(100vh - 96px)',
    background: 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(16px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
    borderRadius: 14,
    border: '1px solid rgba(255, 255, 255, 0.6)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03)',
    zIndex: 1001,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const header: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px 8px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  };

  const iconBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 7,
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    transition: 'all 0.12s',
  };

  const getObjectCount = (layerId: string | null) =>
    objects.filter((o) => o.layerId === layerId).length;

  return (
    <div style={panel}>
      {/* Header */}
      <div style={header}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Layers
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            style={iconBtn}
            title="Add layer"
            onClick={() => setShowAddForm(!showAddForm)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-light)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            style={iconBtn}
            title="Close"
            onClick={() => useCanvasStore.getState().toggleLayersPanel()}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <input
            ref={nameInputRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={`Layer ${layers.length + 1}`}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddForm(false); }}
            style={{
              width: '100%', padding: '5px 8px', borderRadius: 7,
              border: '1.5px solid var(--border)', fontSize: 12,
              background: 'var(--surface)', marginBottom: 6,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
            {LAYER_COLOURS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColour(c)}
                style={{
                  width: 20, height: 20, borderRadius: 6, border: c === newColour ? '2px solid var(--text)' : '2px solid transparent',
                  background: c, cursor: 'pointer', padding: 0,
                }}
              />
            ))}
          </div>
          <button
            onClick={handleAdd}
            style={{
              width: '100%', padding: '5px 0', borderRadius: 7, border: 'none',
              background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add Layer
          </button>
        </div>
      )}

      {/* Layer list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {sortedLayers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isActive={activeLayerId === layer.id}
            isEditing={editingId === layer.id}
            editName={editName}
            objectCount={getObjectCount(layer.id)}
            isDragOver={dragOverId === layer.id}
            menuOpen={menuLayerId === layer.id}
            onSetActive={() => useCanvasStore.getState().setActiveLayerId(layer.id)}
            onToggleVisibility={() => useCanvasStore.getState().toggleLayerVisibility(layer.id)}
            onToggleLock={() => useCanvasStore.getState().toggleLayerLock(layer.id)}
            onStartRename={() => startRename(layer)}
            onEditNameChange={setEditName}
            onCommitRename={commitRename}
            onDelete={() => handleDelete(layer.id)}
            onDragStart={() => handleDragStart(layer.id)}
            onDragOver={(e) => handleDragOver(e, layer.id)}
            onDrop={() => handleDrop(layer.id)}
            onToggleMenu={() => setMenuLayerId(menuLayerId === layer.id ? null : layer.id)}
            onCloseMenu={() => setMenuLayerId(null)}
            editInputRef={layer.id === editingId ? editInputRef : undefined}
            onOpacityChange={(v) => useCanvasStore.getState().setLayerOpacity(layer.id, v)}
            onColourChange={(c) => useCanvasStore.getState().updateLayer(layer.id, { colour: c })}
          />
        ))}

        {/* Default layer (always last) */}
        <div
          onClick={() => useCanvasStore.getState().setActiveLayerId(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 10px',
            cursor: 'pointer',
            background: activeLayerId === null ? hexToRgba('#6366f1', 0.12) : 'transparent',
            borderLeft: activeLayerId === null ? '3px solid #6366f1' : '3px solid transparent',
            transition: 'all 0.12s',
          }}
          onMouseEnter={(e) => { if (activeLayerId !== null) e.currentTarget.style.background = hexToRgba('#6366f1', 0.06); }}
          onMouseLeave={(e) => { if (activeLayerId !== null) e.currentTarget.style.background = 'transparent'; }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 4, background: '#6366f1', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', flex: 1 }}>Default</span>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
            {getObjectCount(null)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface LayerRowProps {
  layer: Layer;
  isActive: boolean;
  isEditing: boolean;
  editName: string;
  objectCount: number;
  isDragOver: boolean;
  menuOpen: boolean;
  onSetActive: () => void;
  onToggleVisibility: () => void;
  onToggleLock: () => void;
  onStartRename: () => void;
  onEditNameChange: (v: string) => void;
  onCommitRename: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  editInputRef?: React.RefObject<HTMLInputElement | null>;
  onOpacityChange: (v: number) => void;
  onColourChange: (c: string) => void;
}

function LayerRow({
  layer, isActive, isEditing, editName, objectCount, isDragOver, menuOpen,
  onSetActive, onToggleVisibility, onToggleLock, onStartRename,
  onEditNameChange, onCommitRename, onDelete, onDragStart, onDragOver, onDrop,
  onToggleMenu, onCloseMenu, editInputRef, onOpacityChange, onColourChange,
}: LayerRowProps) {
  const tint = hexToRgba(layer.colour, isActive ? 0.12 : 0.06);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onCloseMenu();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen, onCloseMenu]);

  const tinyBtn: React.CSSProperties = {
    width: 22, height: 22, borderRadius: 5, border: 'none',
    background: 'transparent', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 0,
    color: 'var(--text-tertiary)', transition: 'all 0.12s', flexShrink: 0,
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSetActive}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '5px 10px',
        cursor: 'pointer',
        background: isDragOver ? hexToRgba(layer.colour, 0.18) : (isActive ? tint : 'transparent'),
        borderLeft: isActive ? `3px solid ${layer.colour}` : '3px solid transparent',
        opacity: layer.visible ? 1 : 0.5,
        transition: 'all 0.12s',
        position: 'relative',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = hexToRgba(layer.colour, 0.08); }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Visibility */}
      <button
        style={tinyBtn}
        title={layer.visible ? 'Hide' : 'Show'}
        onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        {layer.visible ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </button>

      {/* Lock */}
      <button
        style={tinyBtn}
        title={layer.locked ? 'Unlock' : 'Lock'}
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        {layer.locked ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
          </svg>
        )}
      </button>

      {/* Colour swatch */}
      <div style={{ width: 12, height: 12, borderRadius: 4, background: layer.colour, flexShrink: 0 }} />

      {/* Name */}
      {isEditing ? (
        <input
          ref={editInputRef}
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onBlur={onCommitRename}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommitRename(); if (e.key === 'Escape') onCommitRename(); }}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1, minWidth: 0, padding: '2px 5px', borderRadius: 5,
            border: `1.5px solid ${layer.colour}`, fontSize: 11, background: 'white',
            fontWeight: 500, outline: 'none',
          }}
        />
      ) : (
        <span
          onDoubleClick={(e) => { e.stopPropagation(); onStartRename(); }}
          style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {layer.name}
        </span>
      )}

      {/* Object count */}
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {objectCount}
      </span>

      {/* More menu */}
      <button
        style={{ ...tinyBtn, width: 18 }}
        onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 4,
            top: '100%',
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
            padding: 4,
            minWidth: 150,
            zIndex: 10,
            fontSize: 12,
          }}
        >
          <MenuButton label="Rename" onClick={() => { onStartRename(); }} />
          <MenuButton label="Select all on layer" onClick={() => {
            const store = useCanvasStore.getState();
            const ids = store.objects.filter((o) => o.layerId === layer.id).map((o) => o.id);
            store.setSelectedIds(new Set(ids));
            onCloseMenu();
          }} />
          <div style={{ padding: '0 6px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 3 }}>Opacity</div>
            <input
              type="range" min="0" max="1" step="0.05"
              value={layer.opacity}
              onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: layer.colour }}
            />
          </div>
          <div style={{ padding: '4px 6px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>Colour</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {LAYER_COLOURS.map((c) => (
                <button
                  key={c}
                  onClick={() => { onColourChange(c); }}
                  style={{
                    width: 16, height: 16, borderRadius: 4, border: c === layer.colour ? '2px solid var(--text)' : '1px solid rgba(0,0,0,0.1)',
                    background: c, cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 6px' }} />
          <MenuButton label="Delete layer" danger onClick={onDelete} />
        </div>
      )}
    </div>
  );
}

function MenuButton({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '6px 10px', border: 'none', background: 'none',
        fontSize: 12, fontWeight: 450, cursor: 'pointer', borderRadius: 6,
        color: danger ? '#ef4444' : 'var(--text)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.08)' : 'var(--accent-light)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
    >
      {label}
    </button>
  );
}
