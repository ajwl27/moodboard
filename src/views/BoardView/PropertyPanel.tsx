import { useCanvasStore } from '../../stores/canvasStore';
import { normalizeUrl } from '../../utils/opengraph';
import { hexToRgba } from '../../utils/colours';
import type { CanvasObject, GroupRegion } from '../../types';

export function PropertyPanel() {
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const objects = useCanvasStore((s) => s.objects);
  const layers = useCanvasStore((s) => s.layers);

  if (selectedIds.size === 0) return null;

  const selectedObjects = objects.filter((o) => selectedIds.has(o.id));
  const single = selectedObjects.length === 1 ? selectedObjects[0] : null;

  const updateProp = (id: string, changes: Partial<CanvasObject>) => {
    useCanvasStore.getState().updateObject(id, changes);
  };

  const panel: React.CSSProperties = {
    position: 'absolute',
    right: 12,
    top: 72,
    bottom: 12,
    width: 252,
    background: 'rgba(250, 248, 245, 0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 12,
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)',
    padding: '16px 14px',
    zIndex: 1000,
    overflowY: 'auto',
    fontSize: 13,
  };

  const heading: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-tertiary)',
    marginBottom: 10,
  };

  const section: React.CSSProperties = {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border-light)',
  };

  const typeName = single ? single.type.charAt(0).toUpperCase() + single.type.slice(1) : '';

  return (
    <div style={panel}>
      <h3 style={{ ...heading, fontSize: 13, color: 'var(--text)', marginBottom: 14 }}>
        {single ? `${typeName}` : `${selectedObjects.length} selected`}
      </h3>

      {/* Layer assignment */}
      {layers.length > 0 && (
        <div style={section}>
          <div style={heading}>Layer</div>
          <select
            value={single ? (single.layerId ?? '') : ''}
            onChange={(e) => {
              const layerId = e.target.value || null;
              useCanvasStore.getState().moveSelectedToLayer(layerId);
            }}
            style={{
              width: '100%', padding: '5px 8px', borderRadius: 8,
              border: '1.5px solid var(--border)', fontSize: 12,
              background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
            }}
          >
            <option value="">Default</option>
            {layers.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      )}

      {single && (
        <>
          {/* Position */}
          <div style={section}>
            <div style={heading}>Position</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Field label="X" value={Math.round(single.x)} onChange={(v) => updateProp(single.id, { x: v })} />
              <Field label="Y" value={Math.round(single.y)} onChange={(v) => updateProp(single.id, { y: v })} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <Field label="W" value={Math.round(single.width)} onChange={(v) => updateProp(single.id, { width: Math.max(50, v) })} />
              <Field label="H" value={Math.round(single.height)} onChange={(v) => updateProp(single.id, { height: Math.max(30, v) })} />
            </div>
          </div>

          {/* Appearance */}
          <div style={section}>
            <div style={heading}>Appearance</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 50 }}>Fill</span>
              {single.type === 'group' ? (
                <>
                  <input
                    type="color"
                    value={rgbaToHex((single as GroupRegion).backgroundColour)}
                    onChange={(e) => updateProp(single.id, { backgroundColour: hexToRgba(e.target.value, 0.15) } as any)}
                    style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: 8, padding: 0, cursor: 'pointer', background: 'none' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                    {rgbaToHex((single as GroupRegion).backgroundColour).toUpperCase()}
                  </span>
                </>
              ) : (
                <>
                  <input
                    type="color"
                    value={single.colour || '#ffffff'}
                    onChange={(e) => updateProp(single.id, { colour: e.target.value })}
                    style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: 8, padding: 0, cursor: 'pointer', background: 'none' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                    {(single.colour || '#ffffff').toUpperCase()}
                  </span>
                </>
              )}
            </div>

            {single.type === 'group' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 50 }}>Border</span>
                <input
                  type="color"
                  value={single.colour || '#cbd5e1'}
                  onChange={(e) => updateProp(single.id, { colour: e.target.value })}
                  style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: 8, padding: 0, cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                  {(single.colour || '#cbd5e1').toUpperCase()}
                </span>
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
              <div style={{
                width: 18, height: 18, borderRadius: 5,
                border: `2px solid ${single.locked ? 'var(--accent)' : 'var(--border)'}`,
                background: single.locked ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {single.locked && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <input type="checkbox" checked={single.locked} onChange={(e) => updateProp(single.id, { locked: e.target.checked })} style={{ display: 'none' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Locked</span>
            </label>
          </div>

          {/* Type-specific */}
          {(single.type === 'text' || single.type === 'note') && (
            <div style={section}>
              <div style={heading}>{single.type === 'note' ? 'Note' : 'Text'}</div>
              {single.type === 'note' && (
                <div style={{ marginBottom: 8 }}>
                  <Field label="Title" value={single.titleFontSize ?? 18} onChange={(v) => updateProp(single.id, { titleFontSize: Math.max(8, v) } as any)} />
                </div>
              )}
              <Field label="Size" value={single.type === 'text' ? single.fontSize : (single.fontSize ?? 14)} onChange={(v) => updateProp(single.id, { fontSize: Math.max(8, v) })} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 50 }}>Font</span>
                <input
                  type="color"
                  value={(single as any).fontColour || '#2C2825'}
                  onChange={(e) => updateProp(single.id, { fontColour: e.target.value } as any)}
                  style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: 8, padding: 0, cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                  {((single as any).fontColour || '#2C2825').toUpperCase()}
                </span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0', marginTop: 8 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5,
                  border: `2px solid ${(single as any).transparentBg ? 'var(--accent)' : 'var(--border)'}`,
                  background: (single as any).transparentBg ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {(single as any).transparentBg && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <input type="checkbox" checked={!!(single as any).transparentBg} onChange={(e) => updateProp(single.id, { transparentBg: e.target.checked } as any)} style={{ display: 'none' }} />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Transparent background</span>
              </label>
            </div>
          )}

          {single.type === 'image' && (
            <div style={section}>
              <div style={heading}>Image</div>
              <SelectField label="Fit" value={single.objectFit}
                options={[{ value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' }]}
                onChange={(v) => updateProp(single.id, { objectFit: v as 'cover' | 'contain' })}
              />
              <div style={{ marginTop: 8 }}>
                <InputField label="Caption" value={single.caption} onChange={(v) => updateProp(single.id, { caption: v })} />
              </div>
              <div style={{ marginTop: 8 }}>
                <InputField label="Link URL" value={single.linkUrl || ''} onChange={(v) => updateProp(single.id, { linkUrl: v || undefined } as any)} />
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => useCanvasStore.getState().setCropModalObjectId(single.id)}
                  style={{
                    padding: '5px 12px', borderRadius: 8, border: '1.5px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  Crop Image
                </button>
                {(single.cropX || single.cropY || (single.cropWidth != null && single.cropWidth < 1) || (single.cropHeight != null && single.cropHeight < 1)) && (
                  <button
                    onClick={() => updateProp(single.id, { cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 })}
                    style={{
                      padding: 0, border: 'none', background: 'none',
                      color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    Reset Crop
                  </button>
                )}
              </div>
            </div>
          )}

          {single.type === 'link' && (
            <div style={section}>
              <div style={heading}>Link</div>
              <InputField label="URL" value={single.url} onChange={(v) => updateProp(single.id, { url: normalizeUrl(v) })} />
              <div style={{ marginTop: 8 }}>
                <InputField label="Title" value={single.title} onChange={(v) => updateProp(single.id, { title: v })} />
              </div>
            </div>
          )}

          {single.type === 'arrow' && (
            <div style={section}>
              <div style={heading}>Arrow</div>
              <SelectField label="Style" value={single.lineStyle}
                options={[{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }]}
                onChange={(v) => updateProp(single.id, { lineStyle: v as any })}
              />
              <div style={{ marginTop: 8 }}>
                <SelectField label="Head" value={single.arrowHead}
                  options={[{ value: 'end', label: 'End' }, { value: 'both', label: 'Both' }, { value: 'none', label: 'None' }]}
                  onChange={(v) => updateProp(single.id, { arrowHead: v as any })}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <Field label="Width" value={single.strokeWidth} onChange={(v) => updateProp(single.id, { strokeWidth: Math.max(1, v) })} />
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Curve</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>{single.curvature.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="-1" max="1" step="0.1"
                  value={single.curvature}
                  onChange={(e) => updateProp(single.id, { curvature: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
            </div>
          )}

          {single.type === 'group' && (
            <div style={section}>
              <div style={heading}>Group</div>
              <InputField label="Label" value={single.label} onChange={(v) => updateProp(single.id, { label: v })} />
              <div style={{ marginTop: 8 }}>
                <SelectField label="Border" value={single.borderStyle}
                  options={[{ value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' }, { value: 'dotted', label: 'Dotted' }, { value: 'none', label: 'None' }]}
                  onChange={(v) => updateProp(single.id, { borderStyle: v as any })}
                />
              </div>
            </div>
          )}

          {single.type === 'drawing' && (
            <div style={section}>
              <div style={heading}>Drawing</div>
              <Field label="Width" value={single.strokeWidth} onChange={(v) => updateProp(single.id, { strokeWidth: Math.max(1, v) })} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 50 }}>Stroke</span>
                <input
                  type="color"
                  value={single.strokeColour || '#2C2825'}
                  onChange={(e) => updateProp(single.id, { strokeColour: e.target.value } as any)}
                  style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: 8, padding: 0, cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                  {(single.strokeColour || '#2C2825').toUpperCase()}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {!single && selectedObjects.length > 1 && (
        <div style={section}>
          <div style={heading}>Appearance</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 50 }}>Fill</span>
            <input
              type="color"
              value={selectedObjects[0].colour || '#ffffff'}
              onChange={(e) => { for (const o of selectedObjects) updateProp(o.id, { colour: e.target.value }); }}
              style={{ width: 28, height: 28, border: '2px solid var(--border)', borderRadius: 8, padding: 0, cursor: 'pointer', background: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <span style={{ width: 22, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        style={{
          flex: 1, width: 0, padding: '5px 8px', borderRadius: 8,
          border: '1.5px solid var(--border)', fontSize: 12, fontFamily: 'var(--mono)',
          background: 'var(--surface)', color: 'var(--text)',
        }}
      />
    </label>
  );
}

function InputField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
      <input
        type="text" value={value} onChange={(e) => onChange(e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)' }}
      />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 50, flexShrink: 0 }}>{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{ flex: 1, padding: '5px 8px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 12, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function rgbaToHex(rgba: string): string {
  if (rgba.startsWith('#')) return rgba;
  const match = rgba.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#ffffff';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}
