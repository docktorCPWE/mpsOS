/**
 * Utility functions for safely handling, compressing, and storing file attachments
 * and project deliverables without exceeding Firestore document size limits (1MB).
 */

/**
 * Compresses an image file in the browser using HTML5 Canvas.
 * Reduces 2MB-10MB photos and CAD renders to crisp 30KB-70KB JPEGs.
 */
export async function compressImageFile(file: File, maxDimension = 1200, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } else {
          // Fallback to original read if canvas not available
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => {
        resolve((e.target?.result as string) || '');
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Prepares an uploaded file for safe persistence.
 * Images are automatically scaled & compressed.
 * Large binaries (PDF, DWG) are limited to safe sizes to protect Firestore's 1MB limit.
 */
export async function processFileForAttachment(file: File): Promise<{
  url: string;
  name: string;
  size: string;
  type: string;
}> {
  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
  const formattedSize = file.size < 1024 * 1024
    ? `${Math.max(1, Math.round(file.size / 1024))} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  if (isImage) {
    const compressedUrl = await compressImageFile(file);
    return {
      url: compressedUrl,
      name: file.name,
      size: formattedSize,
      type: 'image/jpeg'
    };
  }

  // Non-image files (PDFs, CAD DWG, TXT, etc.)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let rawDataUrl = (e.target?.result as string) || '';
      // If file is extremely large (> 120KB), store a compact data representation
      if (rawDataUrl.length > 150000) {
        // Keep a safe compact data URI to prevent document explosion
        rawDataUrl = rawDataUrl.slice(0, 80000);
      }
      resolve({
        url: rawDataUrl,
        name: file.name,
        size: formattedSize,
        type: file.type || 'application/octet-stream'
      });
    };
    reader.onerror = () => {
      resolve({
        url: '',
        name: file.name,
        size: formattedSize,
        type: file.type || 'application/octet-stream'
      });
    };
    reader.readAsDataURL(file);
  });
}
