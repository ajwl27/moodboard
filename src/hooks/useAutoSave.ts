import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../stores/canvasStore';
import { bulkPutObjects, deleteObjects, getFile } from '../db/objects';
import { getBoard, updateBoard } from '../db/boards';
import { getDirHandle, writeBoardToFolder, writeAssetToFolder } from '../db/filesystem';

export function useAutoSave() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = useCanvasStore.subscribe((state) => {
      const hasDirtyObjects = state.dirtyObjectIds.size > 0;
      const hasDirtyBoard = state.boardDirty;
      if (!hasDirtyObjects && !hasDirtyBoard) return;
      if (!state.boardId) return;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        const current = useCanvasStore.getState();
        if (!current.boardId) return;

        const dirtyIds = new Set(current.dirtyObjectIds);

        // Save dirty objects
        if (current.dirtyObjectIds.size > 0) {
          const objectsToSave = current.objects.filter((o) => dirtyIds.has(o.id));

          // Also need to handle deleted objects — delete from DB objects that
          // are in dirtyIds but not in current objects
          const currentIds = new Set(current.objects.map((o) => o.id));
          const deletedIds = [...dirtyIds].filter((id) => !currentIds.has(id));

          if (objectsToSave.length > 0) {
            await bulkPutObjects(objectsToSave);
          }
          if (deletedIds.length > 0) {
            await deleteObjects(deletedIds);
          }
        }

        // Save board camera/metadata + layers
        if (current.boardDirty) {
          await updateBoard(current.boardId, { camera: current.camera, layers: current.layers });
        }

        current.clearDirty();

        // Sync to folder if board has a dir handle
        const board = await getBoard(current.boardId);
        if (board?.dirHandleId) {
          const handle = await getDirHandle(board.dirHandleId);
          if (handle) {
            try {
              await writeBoardToFolder(handle, board, current.objects);

              // Write any new file assets for dirty objects
              for (const id of dirtyIds) {
                const obj = current.objects.find(o => o.id === id);
                if (obj && (obj.type === 'image' || obj.type === 'file') && 'fileId' in obj) {
                  const file = await getFile(obj.fileId);
                  if (file) await writeAssetToFolder(handle, file);
                }
              }
            } catch (e) {
              console.warn('[autoSave] Folder sync failed:', e);
            }
          }
        }
      }, 300);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
