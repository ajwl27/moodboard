/** Returns { width, height } scaled to fit within maxCanvasWidth while preserving aspect ratio. */
export async function getImageDimensions(blob: Blob, maxCanvasWidth = 350): Promise<{ width: number; height: number }> {
  const img = await loadImage(blob);
  const w = 'width' in img ? img.width : (img as HTMLImageElement).naturalWidth;
  const h = 'height' in img ? img.height : (img as HTMLImageElement).naturalHeight;
  const aspect = w / h;
  const fitW = Math.min(w, maxCanvasWidth);
  const fitH = Math.round(fitW / aspect);
  return { width: fitW, height: fitH };
}

export async function generateThumbnail(
  blob: Blob,
  maxWidth: number,
  maxHeight: number,
): Promise<Blob> {
  const img = await loadImage(blob);
  const width = 'width' in img ? img.width : (img as HTMLImageElement).naturalWidth;
  const height = 'height' in img ? img.height : (img as HTMLImageElement).naturalHeight;

  let newWidth = width;
  let newHeight = height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  // Use OffscreenCanvas if available, otherwise fall back to regular canvas
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(newWidth, newHeight);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img as ImageBitmap, 0, 0, newWidth, newHeight);
      return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    } catch {
      // OffscreenCanvas.convertToBlob may not be supported in some WebKit builds
    }
  }

  // Fallback: regular canvas
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img as CanvasImageSource, 0, 0, newWidth, newHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create thumbnail blob'))),
      'image/jpeg',
      0.8,
    );
  });
}

/** Load an image from a Blob, using createImageBitmap if available, falling back to Image element */
async function loadImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap !== 'undefined') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fall through to HTMLImageElement
    }
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}
