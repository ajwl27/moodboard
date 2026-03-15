// ============================================================
// Data Model Types
// ============================================================

export interface Board {
  id: string;
  title: string;
  createdAt: number;
  modifiedAt: number;
  camera: Camera;
  thumbnail?: Blob;
  layers: Layer[];
  folderName?: string;
  dirHandleId?: string;
}

export interface Layer {
  id: string;
  boardId: string;
  name: string;
  colour: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

// --- Base canvas object fields ---

export interface CanvasObjectBase {
  id: string;
  boardId: string;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  locked: boolean;
  colour: string;
  layerId: string | null;
}

export type CanvasObjectType = 'image' | 'text' | 'link' | 'file' | 'group' | 'arrow';

// --- Concrete object types ---

export interface ImageCard extends CanvasObjectBase {
  type: 'image';
  fileId: string;
  originalFilename: string;
  caption: string;
  objectFit: 'cover' | 'contain';
  cropX?: number;      // 0–1 normalized, default 0
  cropY?: number;      // 0–1 normalized, default 0
  cropWidth?: number;   // 0–1 normalized, default 1
  cropHeight?: number;  // 0–1 normalized, default 1
}

export interface TextCard extends CanvasObjectBase {
  type: 'text';
  content: string;
  fontSize: number;
}

export interface LinkCard extends CanvasObjectBase {
  type: 'link';
  url: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  targetBoardId: string | null;
}

export interface FileCard extends CanvasObjectBase {
  type: 'file';
  fileId: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}

export interface GroupRegion extends CanvasObjectBase {
  type: 'group';
  label: string;
  backgroundColour: string;
  borderStyle: 'solid' | 'dashed' | 'dotted' | 'none';
}

export interface Arrow extends CanvasObjectBase {
  type: 'arrow';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startObjectId: string | null;
  endObjectId: string | null;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  arrowHead: 'none' | 'end' | 'both';
  curvature: number;
  strokeWidth: number;
}

export type CanvasObject = ImageCard | TextCard | LinkCard | FileCard | GroupRegion | Arrow;

// --- File storage ---

export interface FileRecord {
  id: string;
  blob: Blob;
  thumbnailBlob?: Blob;
  originalFilename: string;
  mimeType: string;
  size: number;
}

// --- Utility types ---

export type ToolMode = 'select' | 'arrow' | 'text' | 'group';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}
