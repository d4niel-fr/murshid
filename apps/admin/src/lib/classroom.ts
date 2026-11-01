'use client';

import { api, API_BASE } from './api';

/** Files in the portal: teacher attachments (slides, PDFs, worksheets) and photos sent in messages. */
export type FileKind = 'image' | 'pdf' | 'slides' | 'doc' | 'sheet' | 'text';
export interface FileRef { id: string; name: string; mime: string; kind: FileKind; size: number; url: string; preview?: string }
export const fileUrl = (f: Pick<FileRef, 'url'>) => `${API_BASE}${f.url}`;
export const MAX_UPLOAD = 3 * 1024 * 1024;
export const ACCEPT_ATTACH = 'image/*,application/pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt';
const KNOWN: Record<string, string> = {
  pdf: 'application/pdf', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};
export const sizeLabel = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^;,]*;base64,/, ''));
  r.onerror = () => reject(new Error('Could not read that file.'));
  r.readAsDataURL(blob);
});

/** Shrink photos (longest side 1800 px, JPEG); send other files as they are, up to 3 MB. Then upload. */
export async function uploadAs(file: File, as: 'staff' = 'staff'): Promise<FileRef> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  let mime = file.type || KNOWN[ext] || '';
  let blob: Blob = file; let name = file.name; let preview: string | undefined;
  if (mime.startsWith('image/') && mime !== 'image/gif') {
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
      const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.82));
      if (out) { blob = out; mime = 'image/jpeg'; name = file.name.replace(/\.[^.]+$/, '') + '.jpg'; }
    } catch { /* not decodable here: send as is */ }
  }
  if (!Object.values(KNOWN).includes(mime)) throw new Error(`${file.name}: use a PDF, PowerPoint, Word, Excel, text file or a photo.`);
  if (blob.size > MAX_UPLOAD) throw new Error(`${file.name} is ${(blob.size / 1048576).toFixed(1)} MB. Files can be up to 3 MB: try exporting the slides as a PDF.`);
  if (mime.startsWith('image/')) preview = URL.createObjectURL(blob);
  const ref = await api<FileRef>('/files', { method: 'POST', as, body: { name, mime, data: await toBase64(blob) }, timeoutMs: 60_000 });
  return { ...ref, preview };
}
