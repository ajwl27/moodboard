import { getObjectsByBoard, getFile } from '../db/objects';
import { boundingRect, nearestEdgePoint } from './geometry';
import type { CanvasObject, Arrow, ImageCard, TextCard, LinkCard, FileCard, GroupRegion, NoteCard, DrawingCard } from '../types';
import { jsPDF } from 'jspdf';

const PADDING = 40;

export type ExportQuality = 'normal' | 'high' | 'ultra' | 'uncompressed';

const QUALITY_PRESETS: Record<ExportQuality, { dpr: number; jpgQuality: number }> = {
  normal:       { dpr: 1,   jpgQuality: 0.8 },
  high:         { dpr: 2,   jpgQuality: 0.9 },
  ultra:        { dpr: 2,   jpgQuality: 0.95 },
  uncompressed: { dpr: 3,   jpgQuality: 1.0 },
};

export async function exportCanvas(
  boardId: string,
  format: 'png' | 'jpg' | 'pdf',
  boardTitle: string,
  quality: ExportQuality = 'high',
): Promise<void> {
  const objects = await getObjectsByBoard(boardId);
  if (objects.length === 0) return;

  const rects = objects.map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
  const bounds = boundingRect(rects);
  if (!bounds) return;

  const preset = QUALITY_PRESETS[quality];
  const DPR = preset.dpr;

  const canvasWidth = bounds.width + PADDING * 2;
  const canvasHeight = bounds.height + PADDING * 2;
  const pixelWidth = canvasWidth * DPR;
  const pixelHeight = canvasHeight * DPR;

  const canvas = document.createElement('canvas');
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d')!;

  ctx.scale(DPR, DPR);
  ctx.translate(-bounds.x + PADDING, -bounds.y + PADDING);

  // Background
  ctx.fillStyle = '#f2ede6';
  ctx.fillRect(bounds.x - PADDING, bounds.y - PADDING, canvasWidth, canvasHeight);

  // Sort by zIndex and render
  const sorted = objects.slice().sort((a, b) => a.zIndex - b.zIndex);
  for (const obj of sorted) {
    await renderObject(ctx, obj, objects);
  }

  // Export
  const filename = `${boardTitle || 'canvas'}.${format === 'jpg' ? 'jpg' : format === 'pdf' ? 'pdf' : 'png'}`;

  if (format === 'pdf') {
    const orientation = canvasWidth > canvasHeight ? 'landscape' : 'portrait';
    const doc = new jsPDF({ orientation, unit: 'px', format: [canvasWidth, canvasHeight] });
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, canvasWidth, canvasHeight);
    doc.save(filename);
  } else {
    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const jpgQ = format === 'jpg' ? preset.jpgQuality : undefined;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, jpgQ));
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

async function renderObject(ctx: CanvasRenderingContext2D, obj: CanvasObject, allObjects: CanvasObject[]) {
  switch (obj.type) {
    case 'group':
      renderGroup(ctx, obj);
      break;
    case 'text':
      renderText(ctx, obj);
      break;
    case 'image':
      await renderImage(ctx, obj);
      break;
    case 'link':
      renderLink(ctx, obj);
      break;
    case 'file':
      renderFile(ctx, obj);
      break;
    case 'arrow':
      renderArrow(ctx, obj, allObjects);
      break;
    case 'note':
      renderNote(ctx, obj);
      break;
    case 'drawing':
      renderDrawing(ctx, obj);
      break;
  }
}

function renderGroup(ctx: CanvasRenderingContext2D, obj: GroupRegion) {
  const { x, y, width, height } = obj;

  // Background fill
  ctx.fillStyle = obj.backgroundColour || 'rgba(99, 102, 241, 0.06)';
  roundRect(ctx, x, y, width, height, 12);
  ctx.fill();

  // Border
  const borderColour = obj.colour || '#cbd5e1';
  ctx.strokeStyle = borderColour;
  ctx.lineWidth = 2;
  if (obj.borderStyle === 'dashed') {
    ctx.setLineDash([8, 4]);
  } else if (obj.borderStyle === 'dotted') {
    ctx.setLineDash([3, 5]);
  } else if (obj.borderStyle !== 'none') {
    ctx.setLineDash([]);
  }
  if (obj.borderStyle !== 'none') {
    roundRect(ctx, x, y, width, height, 12);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Label
  if (obj.label) {
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textBaseline = 'top';
    ctx.fillText(obj.label.toUpperCase(), x + 10, y + 10);
  }
}

function renderText(ctx: CanvasRenderingContext2D, obj: TextCard) {
  const { x, y, width, height } = obj;

  // Card background + shadow (skip when transparent)
  if (!obj.transparentBg) {
    drawCardBackground(ctx, x, y, width, height, obj.colour || '#ffffff');
  }

  // Text content
  if (obj.content) {
    ctx.fillStyle = obj.fontColour || '#0f172a';
    ctx.font = `${obj.fontSize || 14}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'top';
    wrapText(ctx, obj.content, x + 14, y + 14, width - 28, (obj.fontSize || 14) * 1.6);
  }
}

async function renderImage(ctx: CanvasRenderingContext2D, obj: ImageCard) {
  const { x, y, width, height } = obj;

  // Card background
  drawCardBackground(ctx, x, y, width, height, '#ffffff');

  // Try to load the image
  try {
    const fileRecord = await getFile(obj.fileId);
    if (!fileRecord) return;
    const blob = fileRecord.blob;
    const bitmap = await createImageBitmap(blob);

    const imgHeight = obj.caption ? height - 28 : height;

    ctx.save();
    roundRect(ctx, x, y, width, imgHeight, 10);
    ctx.clip();

    // Apply crop
    const cropX = (obj.cropX ?? 0) * bitmap.width;
    const cropY = (obj.cropY ?? 0) * bitmap.height;
    const cropW = (obj.cropWidth ?? 1) * bitmap.width;
    const cropH = (obj.cropHeight ?? 1) * bitmap.height;

    if (obj.objectFit === 'contain') {
      const scale = Math.min(width / cropW, imgHeight / cropH);
      const drawW = cropW * scale;
      const drawH = cropH * scale;
      const drawX = x + (width - drawW) / 2;
      const drawY = y + (imgHeight - drawH) / 2;
      ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, drawX, drawY, drawW, drawH);
    } else {
      // cover
      const scale = Math.max(width / cropW, imgHeight / cropH);
      const drawW = cropW * scale;
      const drawH = cropH * scale;
      const drawX = x + (width - drawW) / 2;
      const drawY = y + (imgHeight - drawH) / 2;
      ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, drawX, drawY, drawW, drawH);
    }
    ctx.restore();

    // Caption
    if (obj.caption) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textBaseline = 'top';
      const text = truncateText(ctx, obj.caption, width - 20);
      ctx.fillText(text, x + 10, y + imgHeight + 6);
    }
  } catch {
    // Placeholder
    ctx.fillStyle = '#f8f9fb';
    roundRect(ctx, x, y, width, height, 10);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image', x + width / 2, y + height / 2);
    ctx.textAlign = 'left';
  }
}

function renderLink(ctx: CanvasRenderingContext2D, obj: LinkCard) {
  const { x, y, width, height } = obj;

  drawCardBackground(ctx, x, y, width, height, obj.colour || '#ffffff');

  const innerX = x + 8;
  const innerY = y + 8;
  const innerW = width - 16;
  const innerH = height - 16;

  // Inner card border
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 1;
  roundRect(ctx, innerX, innerY, innerW, innerH, 6);
  ctx.stroke();
  ctx.fillStyle = '#f8f9fb';
  roundRect(ctx, innerX, innerY, innerW, innerH, 6);
  ctx.fill();

  let textY = innerY + 8;

  // Title
  if (obj.title) {
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'top';
    const title = truncateText(ctx, obj.title, innerW - 16);
    ctx.fillText(title, innerX + 8, textY);
    textY += 20;
  }

  // Description
  if (obj.description) {
    ctx.fillStyle = '#64748b';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'top';
    const desc = truncateText(ctx, obj.description, innerW - 16);
    ctx.fillText(desc, innerX + 8, textY);
    textY += 16;
  }

  // URL domain
  if (obj.url) {
    try {
      const domain = new URL(obj.url).hostname;
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(domain, innerX + 8, textY);
    } catch { /* invalid url */ }
  }
}

function renderFile(ctx: CanvasRenderingContext2D, obj: FileCard) {
  const { x, y, width, height } = obj;

  drawCardBackground(ctx, x, y, width, height, obj.colour || '#ffffff');

  // Icon area
  const iconX = x + 14;
  const iconY = y + (height - 40) / 2;
  ctx.fillStyle = '#f1f5f9';
  roundRect(ctx, iconX, iconY, 40, 40, 10);
  ctx.fill();

  // File icon text
  ctx.fillStyle = '#64748b';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(getFileEmoji(obj.mimeType), iconX + 20, iconY + 20);
  ctx.textAlign = 'left';

  // Filename
  const textX = iconX + 52;
  const maxTextW = width - 80;
  ctx.fillStyle = '#0f172a';
  ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'top';
  const name = truncateText(ctx, obj.originalFilename, maxTextW);
  ctx.fillText(name, textX, y + height / 2 - 12);

  // File size
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(formatFileSize(obj.fileSize), textX, y + height / 2 + 4);
}

function renderArrow(ctx: CanvasRenderingContext2D, arrow: Arrow, allObjects: CanvasObject[]) {
  let sx = arrow.startX;
  let sy = arrow.startY;
  let ex = arrow.endX;
  let ey = arrow.endY;

  if (arrow.startObjectId) {
    const obj = allObjects.find((o) => o.id === arrow.startObjectId);
    if (obj) {
      const endObj = arrow.endObjectId ? allObjects.find((o) => o.id === arrow.endObjectId) : null;
      const target = endObj
        ? { x: endObj.x + endObj.width / 2, y: endObj.y + endObj.height / 2 }
        : { x: ex, y: ey };
      const pt = nearestEdgePoint({ x: obj.x, y: obj.y, width: obj.width, height: obj.height }, target);
      sx = pt.x;
      sy = pt.y;
    }
  }

  if (arrow.endObjectId) {
    const obj = allObjects.find((o) => o.id === arrow.endObjectId);
    if (obj) {
      const pt = nearestEdgePoint({ x: obj.x, y: obj.y, width: obj.width, height: obj.height }, { x: sx, y: sy });
      ex = pt.x;
      ey = pt.y;
    }
  }

  const colour = arrow.colour || '#64748b';
  ctx.strokeStyle = colour;
  ctx.lineWidth = arrow.strokeWidth || 2;
  ctx.lineCap = 'round';

  if (arrow.lineStyle === 'dashed') {
    ctx.setLineDash([8, 4]);
  } else if (arrow.lineStyle === 'dotted') {
    ctx.setLineDash([3, 5]);
  } else {
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  if (arrow.curvature === 0) {
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
  } else {
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    const dx = ex - sx;
    const dy = ey - sy;
    const cx = mx - dy * arrow.curvature * 0.5;
    const cy = my + dx * arrow.curvature * 0.5;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowheads
  if (arrow.arrowHead === 'end' || arrow.arrowHead === 'both') {
    drawArrowhead(ctx, sx, sy, ex, ey, arrow.curvature, colour);
  }
  if (arrow.arrowHead === 'both') {
    drawArrowhead(ctx, ex, ey, sx, sy, -arrow.curvature, colour);
  }
}

function renderNote(ctx: CanvasRenderingContext2D, obj: NoteCard) {
  const { x, y, width, height } = obj;

  if (!obj.transparentBg) {
    drawCardBackground(ctx, x, y, width, height, obj.colour || '#faf8f5');
  }

  const fontColour = obj.fontColour || '#2C2825';
  const fontSize = obj.fontSize ?? 14;

  // Title (centered, 18px bold)
  if (obj.title) {
    ctx.fillStyle = fontColour;
    ctx.font = `700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    const title = truncateText(ctx, obj.title, width - 20);
    ctx.fillText(title, x + width / 2, y + 10);
    ctx.textAlign = 'left';
  }

  // Divider line
  const dividerY = y + 34;
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, dividerY);
  ctx.lineTo(x + width - 10, dividerY);
  ctx.stroke();

  // Content
  if (obj.content) {
    ctx.fillStyle = fontColour;
    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'top';
    wrapText(ctx, obj.content, x + 10, dividerY + 8, width - 20, fontSize * 1.6);
  }
}

function renderDrawing(ctx: CanvasRenderingContext2D, obj: DrawingCard) {
  const { x, y, width, height, points } = obj;
  if (points.length < 2) return;

  ctx.strokeStyle = obj.strokeColour || '#2C2825';
  ctx.lineWidth = obj.strokeWidth || 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(x + points[0].x * width, y + points[0].y * height);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(x + points[i].x * width, y + points[i].y * height);
  }
  ctx.stroke();
}

// --- Helpers ---

function drawCardBackground(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string) {
  // Shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = colour;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.restore();

  // Border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const lines = text.split('\n');
  let drawY = y;
  for (const line of lines) {
    const words = line.split(' ');
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && currentLine) {
        ctx.fillText(currentLine, x, drawY);
        currentLine = word;
        drawY += lineHeight;
      } else {
        currentLine = test;
      }
    }
    if (currentLine) {
      ctx.fillText(currentLine, x, drawY);
      drawY += lineHeight;
    }
  }
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

function drawArrowhead(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, curvature: number, colour: string) {
  let angle: number;
  if (curvature === 0) {
    angle = Math.atan2(toY - fromY, toX - fromX);
  } else {
    // For curved arrows, compute the tangent angle at the end point
    const mx = (fromX + toX) / 2;
    const my = (fromY + toY) / 2;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const cx = mx - dy * curvature * 0.5;
    const cy = my + dx * curvature * 0.5;
    // Tangent at t=1 of quadratic bezier: 2*(1-t)*(cp-p0) + 2*t*(p1-cp) at t=1 = 2*(p1-cp)
    angle = Math.atan2(toY - cy, toX - cx);
  }

  const headLen = 12;
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function getFileEmoji(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip')) return '📦';
  if (mimeType.includes('text/') || mimeType.includes('json') || mimeType.includes('xml')) return '📝';
  return '📎';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Board thumbnail generation ---

const THUMB_MAX = 400;

export async function generateBoardThumbnail(boardId: string): Promise<Blob | null> {
  const objects = await getObjectsByBoard(boardId);
  if (objects.length === 0) return null;

  const rects = objects.map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height }));
  const bounds = boundingRect(rects);
  if (!bounds) return null;

  const pad = 20;
  const contentW = bounds.width + pad * 2;
  const contentH = bounds.height + pad * 2;
  const scale = Math.min(THUMB_MAX / contentW, THUMB_MAX / contentH, 1);
  const w = Math.ceil(contentW * scale);
  const h = Math.ceil(contentH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.scale(scale, scale);
  ctx.translate(-bounds.x + pad, -bounds.y + pad);

  ctx.fillStyle = '#f2ede6';
  ctx.fillRect(bounds.x - pad, bounds.y - pad, contentW, contentH);

  const sorted = objects.slice().sort((a, b) => a.zIndex - b.zIndex);
  for (const obj of sorted) {
    await renderObject(ctx, obj, objects);
  }

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
}
