import { db } from './schema';
import type { CanvasObject, FileRecord } from '../types';

export async function getObjectsByBoard(boardId: string): Promise<CanvasObject[]> {
  return db.objects.where('boardId').equals(boardId).toArray();
}

export async function addObject(obj: CanvasObject): Promise<void> {
  await db.objects.add(obj);
}

export async function updateObject(id: string, changes: Partial<CanvasObject>): Promise<void> {
  await db.objects.update(id, changes);
}

export async function deleteObject(id: string): Promise<void> {
  await db.objects.delete(id);
}

export async function deleteObjects(ids: string[]): Promise<void> {
  await db.objects.bulkDelete(ids);
}

export async function bulkPutObjects(objects: CanvasObject[]): Promise<void> {
  await db.objects.bulkPut(objects);
}

// --- File operations ---

export async function addFile(file: FileRecord): Promise<void> {
  await db.files.add(file);
}

export async function getFile(id: string): Promise<FileRecord | undefined> {
  return db.files.get(id);
}

export async function deleteFile(id: string): Promise<void> {
  await db.files.delete(id);
}
