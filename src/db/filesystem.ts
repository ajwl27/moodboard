import { db } from './schema';
import { addFile, getFile } from './objects';
import { getBoard } from './boards';
import type { Board, CanvasObject, FileRecord } from '../types';

// Pick a directory via the File System Access API
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  return await window.showDirectoryPicker({ mode: 'readwrite' });
}

// Store a directory handle in IndexedDB (structured-cloneable)
export async function saveDirHandle(id: string, handle: FileSystemDirectoryHandle): Promise<void> {
  await db.dirHandles.put({ id, handle });
}

// Retrieve a stored handle and re-request permission. Returns null if denied or missing.
export async function getDirHandle(id: string): Promise<FileSystemDirectoryHandle | null> {
  const record = await db.dirHandles.get(id);
  if (!record) return null;
  const perm = await record.handle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') return null;
  return record.handle;
}

// Write board.json, objects.json, and files.json to the folder
export async function writeBoardToFolder(
  handle: FileSystemDirectoryHandle,
  board: Board,
  objects: CanvasObject[],
): Promise<void> {
  // Collect file metadata (without blobs) for files referenced by objects
  const fileIds = new Set<string>();
  for (const obj of objects) {
    if ((obj.type === 'image' || obj.type === 'file') && 'fileId' in obj) {
      fileIds.add(obj.fileId);
    }
  }
  const fileMetas: Record<string, { id: string; originalFilename: string; mimeType: string; size: number }> = {};
  for (const fid of fileIds) {
    const fr = await getFile(fid);
    if (fr) {
      fileMetas[fid] = {
        id: fr.id,
        originalFilename: fr.originalFilename,
        mimeType: fr.mimeType,
        size: fr.size,
      };
    }
  }

  // board.json — strip thumbnail blob
  const { thumbnail, ...boardData } = board;
  void thumbnail;
  await writeJsonFile(handle, 'board.json', boardData);

  // objects.json
  await writeJsonFile(handle, 'objects.json', objects);

  // files.json
  await writeJsonFile(handle, 'files.json', fileMetas);
}

// Write a single asset blob to assets/<fileId>.bin
export async function writeAssetToFolder(
  handle: FileSystemDirectoryHandle,
  fileRecord: FileRecord,
): Promise<void> {
  const assetsDir = await handle.getDirectoryHandle('assets', { create: true });
  const fileHandle = await assetsDir.getFileHandle(`${fileRecord.id}.bin`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(fileRecord.blob);
  await writable.close();

  // Also write thumbnail if present
  if (fileRecord.thumbnailBlob) {
    const thumbHandle = await assetsDir.getFileHandle(`${fileRecord.id}.thumb.bin`, { create: true });
    const tw = await thumbHandle.createWritable();
    await tw.write(fileRecord.thumbnailBlob);
    await tw.close();
  }
}

// Read a full board from a folder (for "Open from Folder")
export async function readBoardFromFolder(
  handle: FileSystemDirectoryHandle,
): Promise<{ board: Board; objects: CanvasObject[]; files: FileRecord[] }> {
  const boardData = await readJsonFile(handle, 'board.json') as Board;
  const objects = await readJsonFile(handle, 'objects.json') as CanvasObject[];

  let fileMetas: Record<string, { id: string; originalFilename: string; mimeType: string; size: number }> = {};
  try {
    fileMetas = await readJsonFile(handle, 'files.json') as typeof fileMetas;
  } catch {
    // files.json may not exist if no files were added
  }

  // Reconstruct FileRecords from assets/ directory
  const files: FileRecord[] = [];
  let assetsDir: FileSystemDirectoryHandle | null = null;
  try {
    assetsDir = await handle.getDirectoryHandle('assets');
  } catch {
    // No assets directory
  }

  if (assetsDir) {
    for (const [fileId, meta] of Object.entries(fileMetas)) {
      try {
        const fileHandle = await assetsDir.getFileHandle(`${fileId}.bin`);
        const file = await fileHandle.getFile();
        const blob = new Blob([await file.arrayBuffer()], { type: meta.mimeType });

        let thumbnailBlob: Blob | undefined;
        try {
          const thumbHandle = await assetsDir.getFileHandle(`${fileId}.thumb.bin`);
          const thumbFile = await thumbHandle.getFile();
          thumbnailBlob = new Blob([await thumbFile.arrayBuffer()], { type: meta.mimeType });
        } catch {
          // No thumbnail
        }

        files.push({
          id: fileId,
          blob,
          thumbnailBlob,
          originalFilename: meta.originalFilename,
          mimeType: meta.mimeType,
          size: meta.size,
        });
      } catch {
        // Skip missing assets
      }
    }
  }

  return { board: boardData, objects, files };
}

// Delete an asset from the folder
export async function deleteAssetFromFolder(
  handle: FileSystemDirectoryHandle,
  fileId: string,
): Promise<void> {
  try {
    const assetsDir = await handle.getDirectoryHandle('assets');
    try { await assetsDir.removeEntry(`${fileId}.bin`); } catch { /* */ }
    try { await assetsDir.removeEntry(`${fileId}.thumb.bin`); } catch { /* */ }
  } catch {
    // No assets directory
  }
}

// Helper: add file to IndexedDB and sync to folder if current board has one
export async function addFileWithFolderSync(fileRecord: FileRecord, boardId?: string | null): Promise<void> {
  await addFile(fileRecord);

  if (!boardId) return;

  const board = await getBoard(boardId);
  if (!board?.dirHandleId) return;

  const handle = await getDirHandle(board.dirHandleId);
  if (!handle) return;

  try {
    await writeAssetToFolder(handle, fileRecord);
  } catch {
    // Folder sync failed silently — IndexedDB save already succeeded
  }
}

// --- Internal helpers ---

async function writeJsonFile(handle: FileSystemDirectoryHandle, name: string, data: unknown): Promise<void> {
  const fileHandle = await handle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function readJsonFile(handle: FileSystemDirectoryHandle, name: string): Promise<unknown> {
  const fileHandle = await handle.getFileHandle(name);
  const file = await fileHandle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}
