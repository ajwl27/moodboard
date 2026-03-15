/** Returns { width, height } scaled to fit within maxCanvasWidth while preserving aspect ratio. */
export async function getImageDimensions(blob: Blob, maxCanvasWidth = 600): Promise<{ width: number; height: number }> {
  const img = await createImageBitmap(blob);
  const aspect = img.width / img.height;
  const w = Math.min(img.width, maxCanvasWidth);
  const h = Math.round(w / aspect);
  return { width: w, height: h };
}

export async function generateThumbnail(
  blob: Blob,
  maxWidth: number,
  maxHeight: number,
): Promise<Blob> {
  const img = await createImageBitmap(blob);
  const { width, height } = img;

  let newWidth = width;
  let newHeight = height;

  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  // Use OffscreenCanvas if available, otherwise fall back to regular canvas
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(newWidth, newHeight);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  }

  // Fallback
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, newWidth, newHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create thumbnail blob'))),
      'image/jpeg',
      0.8,
    );
  });
}
