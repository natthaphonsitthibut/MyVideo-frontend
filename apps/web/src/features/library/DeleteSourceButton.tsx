import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { type SourceSummary, useDeleteSource, useSourceDependents } from '@/api/sources';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

/**
 * Delete a library video. The dialog first asks the server which projects use it and says so plainly; those
 * projects are deleted with it only because the merchant pressed the button after reading that.
 */
export function DeleteSourceButton({ source, onDeleted }: { source: SourceSummary; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const deps = useSourceDependents(source.id, open);
  const del = useDeleteSource();
  const projects = deps.data?.projects ?? [];

  return (
    <>
      <Button
        size="icon-sm"
        variant="secondary"
        className="bg-background/90 shadow-sm backdrop-blur"
        aria-label={`ลบวิดีโอ ${source.title}`}
        data-testid="delete-source"
        onClick={(e) => {
          e.preventDefault(); // the card itself is a link
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) del.reset();
        }}
        title="ลบวิดีโอนี้?"
        confirmLabel={projects.length ? `ลบวิดีโอ + ${projects.length} โปรเจกต์` : 'ลบวิดีโอ'}
        busy={del.isPending || deps.isPending}
        onConfirm={() =>
          del.mutate(
            { id: source.id, withProjects: projects.length > 0 },
            {
              onSuccess: () => {
                setOpen(false);
                onDeleted?.();
              },
            },
          )
        }
      >
        <p>“{source.title}” และไฟล์ที่ระบบสร้างจากวิดีโอนี้ (ตัวอย่างวิดีโอ ซับ ผลวิเคราะห์) จะถูกลบถาวร กู้คืนไม่ได้</p>
        {deps.isPending ? <p>กำลังตรวจว่ามีโปรเจกต์ใช้วิดีโอนี้อยู่ไหม…</p> : null}
        {projects.length > 0 ? (
          <div data-testid="delete-source-projects">
            <p className="font-medium text-foreground">โปรเจกต์ที่ใช้วิดีโอนี้จะถูกลบด้วย:</p>
            <ul className="mt-1 list-disc pl-5">
              {projects.slice(0, 5).map((p) => (
                <li key={p.id} className="truncate">
                  {p.title}
                </li>
              ))}
              {projects.length > 5 ? <li>และอีก {projects.length - 5} โปรเจกต์</li> : null}
            </ul>
          </div>
        ) : null}
        {deps.isError || del.isError ? (
          <p className="text-destructive" role="alert">
            ลบไม่สำเร็จ ลองใหม่อีกครั้ง
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
