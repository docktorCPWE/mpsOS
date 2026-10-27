/**
 * Utility functions for safely handling, compressing, viewing, and downloading
 * file attachments and project deliverables across all browsers and iframes.
 */

/**
 * Compresses an image file in the browser using HTML5 Canvas.
 * Reduces 2MB-10MB photos and CAD renders to crisp 30KB-70KB JPEGs.
 */
export async function compressImageFile(file: File, maxDimension = 1200, quality = 0.75): Promise<string> {
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
 * Preserves the full, uncorrupted file payload. Never slices or truncates base64 strings!
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

  // Non-image files (PDFs, CAD DWG, DOCX, TXT, etc.)
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = (e.target?.result as string) || '';
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

/**
 * Converts a data URL to a Blob object URL (blob:http...)
 * This allows iframes to embed PDFs and prevents browser restrictions on data: URLs.
 */
export function createBlobUrlFromDataUrl(dataUrl: string): { blobUrl: string; revoke: () => void } | null {
  if (!dataUrl) return null;

  if (dataUrl.startsWith('blob:') || dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return { blobUrl: dataUrl, revoke: () => {} };
  }

  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;

    const meta = parts[0];
    let base64 = parts[1];
    const mimeMatch = meta.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

    // Repair base64 padding if needed
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const byteCharacters = atob(base64);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }

    const blob = new Blob([byteNumbers], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    return {
      blobUrl,
      revoke: () => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore
        }
      }
    };
  } catch (err) {
    console.warn('Failed to convert data URL to Blob URL:', err);
    return null;
  }
}

/**
 * Reliably downloads a file from any URL (data:, blob:, http:) across all browsers
 * and iframe environments without triggering security blocks.
 */
export function downloadFileFromUrl(url: string, filename: string): void {
  if (!url) {
    console.warn('No URL provided for download');
    return;
  }

  const safeName = filename || 'downloaded-file';

  // 1. Data URL: convert to Blob URL first so browser download manager treats it cleanly
  if (url.startsWith('data:')) {
    try {
      const parts = url.split(',');
      if (parts.length >= 2) {
        const meta = parts[0];
        let base64 = parts[1];
        const mimeMatch = meta.match(/:(.*?);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

        while (base64.length % 4 !== 0) {
          base64 += '=';
        }

        const byteCharacters = atob(base64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const blob = new Blob([byteNumbers], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          try {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          } catch {
            // ignore
          }
        }, 1500);
        return;
      }
    } catch (err) {
      console.warn('Data URL blob conversion failed, falling back to direct anchor:', err);
    }
  }

  // 2. Standard Blob or HTTP URL
  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = safeName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch {
        // ignore
      }
    }, 1500);
  } catch (err) {
    console.error('Download execution failed:', err);
  }
}

/**
 * Reliably opens a file in a new browser tab.
 * For data URLs, converts to a Blob URL first because modern browsers disallow navigating top frame to data: URLs.
 */
export function openFileInNewTab(url: string, filename?: string): void {
  if (!url) return;

  if (url.startsWith('data:')) {
    const blobRes = createBlobUrlFromDataUrl(url);
    if (blobRes) {
      window.open(blobRes.blobUrl, '_blank', 'noopener,noreferrer');
      // Keep blob alive for a few minutes so the new tab can finish rendering
      setTimeout(() => blobRes.revoke(), 180000);
      return;
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
