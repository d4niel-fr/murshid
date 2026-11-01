'use client';

/**
 * Getting files ready to upload: photos are shrunk (longest side 1800 px, JPEG) so a phone photo of a notebook page
 * becomes a few hundred KB instead of several MB; other files are sent as they are, up to the 3 MB limit.
 */
export const MAX_UPLOAD = 3 * 1024 * 1024;
export const ACCEPT_HANDIN = 'image/*,application/pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt';
const KNOWN: Record<string, string> = {
  pdf: 'application/pdf', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};

export interface Prepared { name: string; mime: string; data: string; size: number; preview?: string }
export class UploadError extends Error {}

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^;,]*;base64,/, ''));
  r.onerror = () => reject(new UploadError('Could not read that file.'));
  r.readAsDataURL(blob);
});

/** A canvas (e.g. a notebook page) as a JPEG ready to upload. */
export async function fromCanvas(c: HTMLCanvasElement, name: string, quality = 0.86): Promise<Prepared> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new UploadError('Could not render that page.');
  return { name, mime: 'image/jpeg', data: await toBase64(blob), size: blob.size, preview: URL.createObjectURL(blob) };
}

export async function prepareFile(file: File): Promise<Prepared> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mime = file.type || KNOWN[ext] || '';
  if (mime.startsWith('image/') && mime !== 'image/gif') {
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      const out = await fromCanvas(c, file.name.replace(/\.[^.]+$/, '') + '.jpg', 0.82);
      if (out.size > MAX_UPLOAD) throw new UploadError(`${file.name} is still too big after shrinking.`);
      return out;
    } catch (e) {
      if (e instanceof UploadError) throw e;
      // the browser could not decode it (e.g. HEIC on desktop): send it as it is if the server accepts the type
    }
  }
  if (!Object.values(KNOWN).includes(mime)) throw new UploadError(`${file.name}: use a photo, PDF, PowerPoint, Word, Excel or text file.`);
  if (file.size > MAX_UPLOAD) throw new UploadError(`${file.name} is ${(file.size / 1048576).toFixed(1)} MB. Files can be up to 3 MB.`);
  return { name: file.name, mime, data: await toBase64(file), size: file.size, preview: mime.startsWith('image/') ? URL.createObjectURL(file) : undefined };
}

export const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
