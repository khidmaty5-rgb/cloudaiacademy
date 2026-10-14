export const MAX_COURSE_IMAGE_LENGTH = 128 * 1024;
export function isCourseImageData(value: string): boolean {
  return value.length <= MAX_COURSE_IMAGE_LENGTH && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

// Small covers are saved atomically with the course, without a Storage/Blaze dependency.
export async function prepareCourseImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)
    throw new Error('INVALID_IMAGE');
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) throw new Error('INVALID_IMAGE');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('INVALID_IMAGE');
    for (const edge of [960, 720, 480]) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.65, 0.45]) {
        const value = canvas.toDataURL('image/jpeg', quality);
        if (isCourseImageData(value)) return value;
      }
    }
    throw new Error('IMAGE_TOO_LARGE');
  } finally { bitmap.close(); }
}
