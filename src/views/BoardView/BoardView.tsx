import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCanvasStore } from '../../stores/canvasStore';
import { getBoard, updateBoard } from '../../db/boards';
import { getObjectsByBoard, updateFile } from '../../db/objects';
import { getDirHandle, syncBoardFromFolder } from '../../db/filesystem';
import { generateBoardThumbnail } from '../../utils/exportCanvas';
import { useCamera } from '../../hooks/useCamera';
import { useSelection } from '../../hooks/useSelection';
import { useDragMove } from '../../hooks/useDragMove';
import { useResize } from '../../hooks/useResize';
import { useDropzone } from '../../hooks/useDropzone';
import { useClipboard } from '../../hooks/useClipboard';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useViewportCulling } from '../../hooks/useViewportCulling';
import { useArrowDrawing } from '../../hooks/useArrowDrawing';
import { useDrawing } from '../../hooks/useDrawing';
import { CanvasObject } from '../../components/canvas/CanvasObject';
import { SelectionHandles } from '../../components/canvas/SelectionHandles';
import { SelectionRect } from '../../components/canvas/SelectionRect';
import { ArrowLayer } from '../../components/canvas/ArrowLayer';
import { AlignmentGuides } from '../../components/canvas/AlignmentGuides';
import { ContextMenu } from '../../components/ContextMenu';
import { Toolbar } from './Toolbar';
import { DrawToolBar } from './DrawToolBar';
import { TopBar } from './TopBar';
import { PropertyPanel } from './PropertyPanel';
import { Lightbox } from '../../components/Lightbox';
import { CropModal } from '../../components/CropModal';
import { QuickAddBar } from '../../components/QuickAddBar';
import { LayersPanel } from '../../components/LayersPanel';
import { useContextMenu } from '../../hooks/useContextMenu';
import styles from './BoardView.module.css';

export function BoardView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [folderSyncInactive, setFolderSyncInactive] = useState(false);

  const {
    boardId, objects, camera, selectedIds, toolMode,
    gridEnabled, gridSize, layers, layersPanelOpen, loadBoard, unloadBoard,
  } = useCanvasStore();

  // Load board data — for folder-backed boards, re-read from the folder
  // every time so the folder is always the source of truth.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      let board = await getBoard(id);
      if (cancelled || !board) {
        if (!board) navigate('/');
        return;
      }

      // If the board is backed by a folder, sync from it first
      if (board.dirHandleId) {
        const handle = await getDirHandle(board.dirHandleId);
        if (handle) {
          const synced = await syncBoardFromFolder(id, handle);
          if (synced) {
            board = synced.board;
          }
        } else {
          setFolderSyncInactive(true);
          setTimeout(() => setFolderSyncInactive(false), 5000);
        }
      }

      if (cancelled) return;
      const objs = await getObjectsByBoard(id);
      loadBoard(id, objs, board.camera, board.layers);
    })();
    return () => {
      cancelled = true;
      // Generate thumbnail before unloading (fire-and-forget)
      const boardId = useCanvasStore.getState().boardId;
      if (boardId) {
        generateBoardThumbnail(boardId).then((blob) => {
          if (blob) updateBoard(boardId, { thumbnail: blob });
        }).catch(() => {});
      }
      unloadBoard();
    };
  }, [id, navigate, loadBoard, unloadBoard]);

  // Hooks
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();

  // Right-click without drag → show context menu
  const handleStaticRightClick = useCallback(
    (x: number, y: number, target: HTMLElement) => {
      const objectEl = target.closest('[data-object-id]');
      const objectId = objectEl?.getAttribute('data-object-id');
      if (objectId) {
        const store = useCanvasStore.getState();
        if (!store.selectedIds.has(objectId)) {
          store.select(objectId);
        }
      }
      showContextMenu(x, y, target);
    },
    [showContextMenu],
  );

  useCamera(containerRef, canvasRef, svgRef, boardId, handleStaticRightClick);
  const { marquee, onPointerDown: selectionPointerDown } = useSelection(containerRef);
  const { onPointerDown: dragPointerDown, dragging } = useDragMove(containerRef);
  const { onPointerDown: resizePointerDown, resizing } = useResize(containerRef);
  useDropzone(containerRef);
  useClipboard();
  useKeyboardShortcuts(navigate);
  useAutoSave();
  const visibleObjectIds = useViewportCulling(containerRef);
  const { drawState, handleCanvasClick: arrowClick, handleMouseMove: arrowMove } = useArrowDrawing(containerRef);
  const { drawState: freeDrawState, handlePointerDown: drawPointerDown, handlePointerMove: drawPointerMove, handlePointerUp: drawPointerUp } = useDrawing(containerRef);

  // Object pointer down — select + start drag
  const handleObjectPointerDown = useCallback(
    (e: React.PointerEvent, objId: string) => {
      if (e.button !== 0) return;
      const store = useCanvasStore.getState();

      const obj = store.objects.find((o) => o.id === objId);
      const objLayer = obj?.layerId ? store.layers.find((l) => l.id === obj.layerId) : null;
      if (!obj || obj.locked || objLayer?.locked) {
        if (obj && !store.selectedIds.has(objId)) {
          if (e.shiftKey) store.toggleSelect(objId);
          else store.select(objId);
        }
        return;
      }

      if (e.shiftKey) {
        store.toggleSelect(objId);
      } else if (!store.selectedIds.has(objId)) {
        store.select(objId);
      }
      dragPointerDown(e);
    },
    [dragPointerDown],
  );

  // Canvas pointer down — marquee selection on empty space, or draw mode
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 0 && toolMode === 'draw') {
        drawPointerDown(e);
        return;
      }
      if (e.button === 0 && e.target === containerRef.current) {
        selectionPointerDown(e);
      }
    },
    [selectionPointerDown, toolMode, drawPointerDown],
  );

  // Suppress native context menu — our custom menu is shown via handleStaticRightClick
  const handleContextMenuEvent = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
    },
    [],
  );

  // Double-click empty canvas → create text card
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== containerRef.current) return;
      const store = useCanvasStore.getState();
      const { camera } = store;
      const rect = containerRef.current!.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) / camera.zoom - camera.x;
      const canvasY = (e.clientY - rect.top) / camera.zoom - camera.y;

      const textCard = {
        id: crypto.randomUUID(),
        boardId: store.boardId!,
        type: 'text' as const,
        x: canvasX,
        y: canvasY,
        width: 200,
        height: 100,
        zIndex: store.getMaxZIndex() + 1,
        locked: false,
        colour: '#ffffff',
        content: '',
        fontSize: 14,
        layerId: store.activeLayerId,
      };
      store.addObject(textCard);
      store.select(textCard.id);
      store.setEditingObjectId(textCard.id);
    },
    [],
  );

  // Handle clicks for arrow drawing mode
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (toolMode === 'arrow') {
        arrowClick(e);
      }
    },
    [toolMode, arrowClick],
  );

  const translate = `translate(${camera.x}px, ${camera.y}px)`;
  const svgTransform = `scale(${camera.zoom}) ${translate}`;

  // Filter objects for rendering — exclude hidden layers
  const hiddenLayerIds = new Set(
    layers.filter((l) => !l.visible).map((l) => l.id)
  );
  // Check if the default layer (null) is hidden via a special convention:
  // default layer visibility is not tracked in layers array — it's always visible

  const layerFiltered = objects.filter((o) => {
    if (o.layerId && hiddenLayerIds.has(o.layerId)) return false;
    return true;
  });

  const visibleObjects = visibleObjectIds
    ? layerFiltered.filter((o) => visibleObjectIds.has(o.id))
    : layerFiltered;

  const nonArrows = visibleObjects.filter((o) => o.type !== 'arrow');
  const arrows = layerFiltered.filter((o) => o.type === 'arrow');

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${toolMode === 'arrow' ? styles.arrowMode : ''} ${toolMode === 'draw' ? styles.drawMode : ''}`}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={toolMode === 'draw' ? drawPointerMove : undefined}
      onPointerUp={toolMode === 'draw' ? drawPointerUp : undefined}
      onContextMenu={handleContextMenuEvent}
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      onMouseMove={toolMode === 'arrow' && drawState.startPoint ? arrowMove : undefined}
    >
      {!boardId ? (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-tertiary)', fontSize: 14,
        }}>
          Loading...
        </div>
      ) : (
        <>
          <div ref={canvasRef} className={styles.canvasLayer} style={{ zoom: camera.zoom, transform: translate }}>
            {gridEnabled && (
              <div
                ref={gridRef}
                className={`${styles.gridBackground} ${styles.gridDots}`}
                style={{
                  position: 'absolute',
                  top: -5000,
                  left: -5000,
                  width: 10000,
                  height: 10000,
                  backgroundSize: `${gridSize}px ${gridSize}px`,
                }}
              />
            )}
            {nonArrows
              .slice()
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((obj) => (
                <CanvasObject
                  key={obj.id}
                  obj={obj}
                  selected={selectedIds.has(obj.id)}
                  interacting={dragging || resizing}
                  onPointerDown={handleObjectPointerDown}
                  onResizePointerDown={resizePointerDown}
                />
              ))}
            <AlignmentGuides />
          </div>

          <svg
            ref={svgRef}
            className={styles.svgOverlay}
            style={{ transform: svgTransform }}
            width="1"
            height="1"
          >
            <ArrowLayer arrows={arrows} />
            {/* Freehand drawing preview (brush mode only) */}
            {freeDrawState.isDrawing && freeDrawState.points.length > 1 && !useCanvasStore.getState().drawIsEraser && (
              <polyline
                points={freeDrawState.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={useCanvasStore.getState().drawBrushColour}
                strokeWidth={useCanvasStore.getState().drawBrushSize}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            )}
            {/* Arrow drawing preview */}
            {drawState.startPoint && drawState.previewEnd && (
              <line
                x1={drawState.startPoint.x}
                y1={drawState.startPoint.y}
                x2={drawState.previewEnd.x}
                y2={drawState.previewEnd.y}
                stroke="#5B7B9A"
                strokeWidth={2}
                strokeDasharray="6 3"
                pointerEvents="none"
              />
            )}
          </svg>

          <SelectionHandles containerRef={containerRef} />
          {marquee && <SelectionRect rect={marquee} />}

          <TopBar navigate={navigate} />
          <Toolbar />
          {toolMode === 'draw' && <DrawToolBar />}
          <QuickAddBar />
          <PropertyPanel />
          {layersPanelOpen && <LayersPanel />}
          <Lightbox />
          <CropModalWrapper />


          {folderSyncInactive && (
            <div style={{
              position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
              zIndex: 1001, background: 'rgba(245, 158, 11, 0.95)', color: '#fff',
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}>
              Folder sync inactive — permission denied or folder unavailable
            </div>
          )}

          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              targetElement={contextMenu.targetElement}
              onClose={hideContextMenu}
            />
          )}
        </>
      )}
    </div>
  );
}

function CropModalWrapper() {
  const cropModalObjectId = useCanvasStore((s) => s.cropModalObjectId);
  const objects = useCanvasStore((s) => s.objects);

  if (!cropModalObjectId) return null;

  const obj = objects.find((o) => o.id === cropModalObjectId);
  if (!obj || obj.type !== 'image') return null;

  return (
    <CropModal
      fileId={obj.fileId}
      initialCropX={obj.cropX ?? 0}
      initialCropY={obj.cropY ?? 0}
      initialCropWidth={obj.cropWidth ?? 1}
      initialCropHeight={obj.cropHeight ?? 1}
      onConfirm={async (crop, rotatedBlob) => {
        if (rotatedBlob) {
          await updateFile(obj.fileId, { blob: rotatedBlob, size: rotatedBlob.size });
        }
        useCanvasStore.getState().updateObject(cropModalObjectId, crop);
        useCanvasStore.getState().setCropModalObjectId(null);
      }}
      onCancel={() => useCanvasStore.getState().setCropModalObjectId(null)}
    />
  );
}
