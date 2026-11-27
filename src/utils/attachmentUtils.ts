/**
 * Utility functions for safely handling, compressing, uploading, viewing, and downloading
 * file attachments and project deliverables across all browsers and iframes.
 */
import {
  uploadAttachmentToFirestoreCloud,
  fetchCloudAttachmentDataUrl,
  isCloudFileUrl
} from '../services/firebase';

export { isCloudFileUrl };

/**
 * Resolves any attachment URL (including `mps-cloud-file://<id>` cloud pointers) into a usable
 * data:/http:/blob: URL for rendering, downloading, or opening in a new tab.
 */
export async function resolveAttachmentUrl(url: string): Promise<string> {
  if (!url) return '';
  if (isCloudFileUrl(url)) {
    return fetchCloudAttachmentDataUrl(url);
  }
  return url;
}

/**
 * Compresses an image file in the browser using HTML5 Canvas.
 * Reduces 2MB-10MB photos and CAD renders to crisp JPEGs.
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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Prepares an uploaded file for reliable cloud persistence without ever bloating `jobs/{jobId}`:
 * - Images: compressed to crisp JPEG; if > 45 KB, uploaded to chunked cloud attachment storage.
 * - PDFs, CAD/DWGs, documents (up to 15 MB): uploaded directly to chunked `job_attachments`
 *   so the parent job document only stores a tiny `mps-cloud-file://<id>` pointer (~45 bytes).
 */
export async function processFileForAttachment(
  file: File,
  options?: { jobId?: string; uploadedBy?: string }
): Promise<{
  url: string;
  name: string;
  size: string;
  type: string;
}> {
  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(file.name);
  const formattedSize = file.size < 1024 * 1024
    ? `${Math.max(1, Math.round(file.size / 1024))} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  if (isImage) {
    try {
      const compressedUrl = await compressImageFile(file, 1600, 0.80);
      if (compressedUrl && compressedUrl.startsWith('data:image')) {
        const approxBytes = Math.round((compressedUrl.length * 3) / 4);
        const compFormattedSize = approxBytes < 1024 * 1024
          ? `${Math.max(1, Math.round(approxBytes / 1024))} KB`
          : `${(approxBytes / (1024 * 1024)).toFixed(1)} MB`;

        // Offload larger images to cloud attachment storage so job docs stay tiny
        let finalUrl = compressedUrl;
        if (compressedUrl.length > 45_000) {
          const cloudPointer = await uploadAttachmentToFirestoreCloud(compressedUrl, {
            name: file.name,
            mimeType: 'image/jpeg',
            sizeBytes: approxBytes,
            jobId: options?.jobId,
            uploadedBy: options?.uploadedBy
          });
          if (cloudPointer) {
            finalUrl = cloudPointer;
          }
        }

        return {
          url: finalUrl,
          name: file.name,
          size: compFormattedSize,
          type: 'image/jpeg'
        };
      }
    } catch (err) {
      console.warn('Canvas image compression failed, falling back to cloud upload:', err);
    }
  }

  // Non-image files (PDFs, CAD DWG, DOCX, TXT, etc.) or image fallback — up to 15 MB
  const MAX_CLOUD_FILE_BYTES = 15 * 1024 * 1024;
  if (file.size > MAX_CLOUD_FILE_BYTES) {
    console.warn(`File "${file.name}" (${formattedSize}) exceeds 15 MB cloud limit; saving metadata only.`);
    return {
      url: '',
      name: file.name,
      size: formattedSize,
      type: file.type || 'application/octet-stream'
    };
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  if (!rawDataUrl) {
    return {
      url: '',
      name: file.name,
      size: formattedSize,
      type: file.type || 'application/octet-stream'
    };
  }

  // Always offload PDFs / CAD / binary files to `job_attachments` so `jobs/{jobId}` NEVER hits 1 MiB
  const cloudPointer = await uploadAttachmentToFirestoreCloud(rawDataUrl, {
    name: file.name,
    mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream'),
    sizeBytes: file.size,
    jobId: options?.jobId,
    uploadedBy: options?.uploadedBy
  });

  if (cloudPointer) {
    return {
      url: cloudPointer,
      name: file.name,
      size: formattedSize,
      type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')
    };
  }

  // Fallback only for very small files (< 80 KB) if cloud upload was momentarily unreachable;
  // larger files omit inline data so task completion ALWAYS succeeds instead of failing a 1 MiB write!
  const safeInlineFallback = rawDataUrl.length <= 110_000 ? rawDataUrl : '';
  return {
    url: safeInlineFallback,
    name: file.name,
    size: formattedSize,
    type: file.type || 'application/octet-stream'
  };
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

function triggerResolvedDownload(resolvedUrl: string, safeName: string): void {
  if (!resolvedUrl) {
    console.warn('No resolved URL available for download');
    return;
  }

  // 1. Data URL: convert to Blob URL first so browser download manager treats it cleanly
  if (resolvedUrl.startsWith('data:')) {
    try {
      const blobRes = createBlobUrlFromDataUrl(resolvedUrl);
      if (blobRes) {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = blobRes.blobUrl;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          try {
            document.body.removeChild(a);
            blobRes.revoke();
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

  // 2. Local relative URLs or HTTP URLs: fetch blob first to ensure correct download filename
  if (resolvedUrl.startsWith('/') || resolvedUrl.startsWith('http://') || resolvedUrl.startsWith('https://')) {
    fetch(resolvedUrl)
      .then(res => res.blob())
      .then(blob => {
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
      })
      .catch(() => {
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = resolvedUrl;
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
      });
    return;
  }

  // 3. Standard Blob or direct URL fallback
  try {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = resolvedUrl;
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
 * Reliably downloads a file from any URL (mps-cloud-file://, data:, blob:, http:) across all browsers
 * and iframe environments without triggering security blocks.
 */
export function downloadFileFromUrl(url: string, filename: string): void {
  if (!url) {
    console.warn('No URL provided for download');
    return;
  }

  const safeName = filename || 'downloaded-file';

  if (isCloudFileUrl(url)) {
    resolveAttachmentUrl(url)
      .then((resolved) => {
        if (resolved) {
          triggerResolvedDownload(resolved, safeName);
        }
      })
      .catch(err => console.warn('Failed to resolve cloud file for download:', err));
    return;
  }

  triggerResolvedDownload(url, safeName);
}

/**
 * Reliably opens a file in a new browser tab.
 * Resolves `mps-cloud-file://` pointers and converts `data:` URLs to Blob URLs first.
 */
export function openFileInNewTab(url: string, _filename?: string): void {
  if (!url) return;

  const openResolved = (resolved: string) => {
    if (!resolved) return;
    if (resolved.startsWith('data:')) {
      const blobRes = createBlobUrlFromDataUrl(resolved);
      if (blobRes) {
        const a = document.createElement('a');
        a.href = blobRes.blobUrl;
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
        }, 500);
        setTimeout(() => blobRes.revoke(), 180000);
        return;
      }
    }

    const a = document.createElement('a');
    a.href = resolved;
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
    }, 500);
  };

  if (isCloudFileUrl(url)) {
    resolveAttachmentUrl(url)
      .then(openResolved)
      .catch(err => console.warn('Failed to resolve cloud file for new tab:', err));
    return;
  }

  openResolved(url);
}
