import * as tus from 'tus-js-client';
import { API_BASE_URL, api, type Schemas } from '@/api/client';

export type UploadConfig = Schemas['UploadConfig'];
export type UploadStatus = 'uploading' | 'paused' | 'retrying' | 'finishing' | 'done' | 'error';

export type UploadItem = {
  id: string;
  name: string;
  size: number;
  sent: number;
  status: UploadStatus;
  /** Merchant-readable (Thai). */
  error?: string;
  sourceId?: string;
  startedAt: number;
};

/** A resumable upload left over from an earlier visit (the file must be picked again to continue). */
export type UnfinishedUpload = { key: string; name: string; size: number; sent?: number; createdAt: string };

const RETRY_DELAYS = [0, 1000, 3000, 5000, 10_000, 20_000, 30_000];

export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Client-side checks with the server's limits (the server checks again). Returns a Thai message or null. */
export function validateFile(file: { name: string; size: number }, cfg: UploadConfig): string | null {
  const ext = /\.([A-Za-z0-9]{1,8})$/.exec(file.name)?.[1]?.toLowerCase() ?? '';
  if (!cfg.extensions.includes(ext))
    return `ไฟล์ “${file.name}” ไม่ใช่วิดีโอที่รองรับ (รองรับ ${cfg.extensions.join(', ')})`;
  if (file.size === 0) return `ไฟล์ “${file.name}” ว่างเปล่า`;
  if (file.size > cfg.maxBytes)
    return `ไฟล์ “${file.name}” ใหญ่เกินไป (${formatBytes(file.size)} — สูงสุด ${formatBytes(cfg.maxBytes)})`;
  return null;
}

function messageFor(err: unknown): string {
  const status = (err as tus.DetailedError)?.originalResponse?.getStatus?.();
  const body = (err as tus.DetailedError)?.originalResponse?.getBody?.() ?? '';
  if (status === 413) return 'ไฟล์ใหญ่เกินกว่าที่ระบบรับได้';
  if (status === 415 || status === 400) {
    try {
      return (JSON.parse(body) as { message?: string }).message ?? 'ไฟล์นี้อัปโหลดไม่ได้';
    } catch {
      return 'ไฟล์นี้อัปโหลดไม่ได้';
    }
  }
  if (status === 401) return 'หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่แล้วกดอัปโหลดต่อ';
  return 'การเชื่อมต่อหลุด อัปโหลดหยุดไว้ก่อน กด “อัปโหลดต่อ” เมื่ออินเทอร์เน็ตกลับมา';
}

type Listener = () => void;

/**
 * Upload state lives outside React (editor-performance rules): progress events update this store, and the UI
 * reads a snapshot through useSyncExternalStore, throttled so fast uploads do not re-render on every chunk.
 * File reading is lazy Blob slicing by tus-js-client (no full-file read, nothing heavy on the main thread).
 */
export class UploadManager {
  private items = new Map<string, UploadItem>();
  private uploads = new Map<string, tus.Upload>();
  private listeners = new Set<Listener>();
  private snapshot: UploadItem[] = [];
  private notifyTimer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  constructor(
    private readonly onSourceReady: (sourceId: string) => void = () => {},
    private readonly throttleMs = 200,
  ) {}

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): UploadItem[] => this.snapshot;

  private emit(immediate = false): void {
    const flush = () => {
      this.notifyTimer = undefined;
      this.snapshot = [...this.items.values()].reverse();
      for (const l of this.listeners) l();
    };
    if (immediate) {
      clearTimeout(this.notifyTimer);
      flush();
    } else if (!this.notifyTimer) {
      this.notifyTimer = setTimeout(flush, this.throttleMs);
    }
  }

  private patch(id: string, change: Partial<UploadItem>, immediate = true): void {
    const cur = this.items.get(id);
    if (!cur) return;
    this.items.set(id, { ...cur, ...change });
    this.emit(immediate);
  }

  /** Validates and starts (or resumes, if this file was partly uploaded before) an upload. */
  async add(file: File, cfg: UploadConfig): Promise<string> {
    const id = `u${++this.seq}-${Date.now()}`;
    const invalid = validateFile(file, cfg);
    this.items.set(id, {
      id,
      name: file.name,
      size: file.size,
      sent: 0,
      status: invalid ? 'error' : 'uploading',
      error: invalid ?? undefined,
      startedAt: Date.now(),
    });
    this.emit(true);
    if (invalid) return id;
    const upload = new tus.Upload(file, {
      endpoint: `${API_BASE_URL}${cfg.endpoint}`,
      chunkSize: cfg.chunkBytes,
      retryDelays: RETRY_DELAYS,
      removeFingerprintOnSuccess: true,
      metadata: { filename: file.name, filetype: file.type || 'video/mp4' },
      onProgress: (sent) => this.patch(id, { sent, status: 'uploading' }, false),
      onShouldRetry: (err) => {
        const status = (err as tus.DetailedError).originalResponse?.getStatus?.() ?? 0;
        const retry = status === 0 || status >= 500 || status === 423 || status === 409;
        if (retry) this.patch(id, { status: 'retrying' });
        return retry;
      },
      onError: (err) => this.patch(id, { status: 'error', error: messageFor(err) }),
      onSuccess: () => void this.finish(id, upload),
    });
    this.uploads.set(id, upload);
    const previous = await upload.findPreviousUploads();
    if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
    upload.start();
    return id;
  }

  private async finish(id: string, upload: tus.Upload): Promise<void> {
    this.patch(id, { status: 'finishing', sent: this.items.get(id)?.size ?? 0 });
    const uploadId = upload.url?.split('/').pop() ?? '';
    // the hand-over is idempotent server-side; retry a few times if the network blips here
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, response } = await api
        .GET('/sources/by-upload/{uploadId}', { params: { path: { uploadId } } })
        .catch(() => ({ data: undefined, response: { status: 0 } as Response }));
      if (data) {
        this.patch(id, { status: 'done', sourceId: data.id });
        this.onSourceReady(data.id);
        return;
      }
      if (response.status === 404) break;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
    this.patch(id, { status: 'error', error: 'อัปโหลดเสร็จแล้วแต่เปิดงานประมวลผลไม่ได้ ลองรีเฟรชหน้า' });
  }

  pause(id: string): void {
    void this.uploads.get(id)?.abort(false);
    this.patch(id, { status: 'paused' });
  }

  resume(id: string): void {
    const u = this.uploads.get(id);
    if (!u) return;
    this.patch(id, { status: 'uploading', error: undefined });
    u.start();
  }

  /** Stops and forgets an upload (the partial file on the server is deleted). */
  remove(id: string): void {
    const u = this.uploads.get(id);
    const item = this.items.get(id);
    if (u && item && item.status !== 'done') void u.abort(true).catch(() => undefined);
    this.uploads.delete(id);
    this.items.delete(id);
    this.emit(true);
  }

  /** Uploads started in an earlier visit and not finished (from tus' URL storage). */
  static async unfinished(): Promise<UnfinishedUpload[]> {
    if (!tus.canStoreURLs) return [];
    const all = await tus.defaultOptions.urlStorage.findAllUploads();
    return all.map((u) => ({
      key: u.urlStorageKey,
      name: u.metadata.filename ?? 'วิดีโอ',
      size: u.size ?? 0,
      createdAt: u.creationTime,
    }));
  }

  static async forget(key: string): Promise<void> {
    await tus.defaultOptions.urlStorage.removeUpload(key);
  }
}
