import type { StageProject } from '@myvideo/stage';
import { Eye, History, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useProjectVersion, useProjectVersions, useRestoreVersion } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { PreviewPlayer } from '@/features/preview/PreviewPlayer';

const REASON: Record<string, string> = {
  create: 'สร้าง (AI/เทมเพลต)',
  save: 'คุณแก้',
  restore: 'กู้คืน',
  restyle: 'เปลี่ยนสไตล์',
  template: 'เปลี่ยนเทมเพลต',
};

/**
 * Version history (E09-F10): every save is a version; preview any of them, restore = a NEW version (history is never
 * rewritten, nothing is lost). `beforeRestore` saves pending edits first so the base version is current.
 */
export function VersionsPanel({
  projectId,
  baseVersion,
  beforeRestore,
  onRestored,
}: {
  projectId: string;
  baseVersion: () => number;
  beforeRestore: () => Promise<void>;
  onRestored: () => void;
}) {
  const versions = useProjectVersions(projectId);
  const [preview, setPreview] = useState<number | null>(null);
  const doc = useProjectVersion(projectId, preview);
  const restore = useRestoreVersion(projectId);
  return (
    <div className="space-y-3" data-testid="versions-panel">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <History className="size-4" aria-hidden />
        ประวัติการแก้ไข
      </p>
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {(versions.data ?? []).map((v) => (
          <li key={v.version} className="flex items-center gap-2 text-xs" data-testid="version-row">
            <span className="w-10 tabular-nums">v{v.version}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">
              {REASON[v.reason] ?? v.reason}
              {v.restoredFrom ? ` จาก v${v.restoredFrom}` : ''} ·{' '}
              {new Date(v.createdAt).toLocaleString('th-TH')}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label={`ดู v${v.version}`}
              onClick={() => setPreview(v.version)}
            >
              <Eye className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label={`กู้คืน v${v.version}`}
              disabled={restore.isPending}
              onClick={async () => {
                await beforeRestore();
                restore.mutate({ version: v.version, baseVersion: baseVersion() }, { onSuccess: onRestored });
              }}
              data-testid="version-restore"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      {restore.isError ? (
        <p className="text-xs text-destructive" role="alert">
          กู้คืนไม่สำเร็จ (อาจมีการแก้จากอีกแท็บ) ลองรีเฟรชหน้า
        </p>
      ) : null}
      {preview !== null && doc.data ? (
        <div className="space-y-2 rounded-lg border p-2" data-testid="version-preview">
          <p className="text-xs text-muted-foreground">ตัวอย่าง v{preview} (ยังไม่ได้กู้คืน)</p>
          <PreviewPlayer project={doc.data.doc as unknown as StageProject} frameClassName="h-64" />
          <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
            ปิดตัวอย่าง
          </Button>
        </div>
      ) : null}
    </div>
  );
}
