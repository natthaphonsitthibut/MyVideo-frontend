import {
  buildCaptions,
  canvasMeasure,
  captionFont,
  captionMaxWidth,
  loadCaptionFont,
  mountStage,
  type StageProject,
} from '@myvideo/stage';
import { useEffect, useRef, useState } from 'react';
import type { FolderPlan } from '@/api/folders';
import { spriteSheetUrl, useSource } from '@/api/sources';
import { spriteCoverStyle } from '@/features/library/sprite';

type Preview = NonNullable<FolderPlan['proposals'][number]['preview']>;
/** Still thumbnail + our real stage for type/captions: no video decoder and no AI/render request. */
export default function StylePreview({ preview }: { preview: Preview }) {
  const source = useSource(preview.sourceId);
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let stage: ReturnType<typeof mountStage> | undefined;
    const draw = async () => {
      const font = captionFont(preview.captionStyle);
      await loadCaptionFont(font);
      if (cancelled || !host.current) return;
      const first = preview.words[0]?.startMs ?? 0;
      const words = preview.words
        .map((w) => ({
          text: w.text,
          startFrame: Math.max(0, Math.round((w.startMs - first) * 0.03)),
          endFrame: Math.max(1, Math.round((w.endMs - first) * 0.03)),
        }))
        .filter((w) => w.endFrame > w.startFrame);
      const pages = buildCaptions(words, {
        measure: canvasMeasure(font),
        maxWidth: captionMaxWidth(1080, preview.captionStyle),
        maxLines: preview.maxLines,
        pauseFrames: 15,
        ...(preview.maxWords ? { maxWords: preview.maxWords } : {}),
      });
      const page = pages[0];
      const project: StageProject = {
        fps: { num: 30, den: 1 },
        width: 1080,
        height: 1920,
        durationFrames: Math.max(90, page ? page.startFrame + page.durationFrames : 90),
        assets: {},
        tracks: [
          { id: 'captions', kind: 'caption', elementIds: page ? ['caption'] : [] },
          { id: 'text', kind: 'overlay', elementIds: preview.productName ? ['name'] : [] },
        ],
        elements: {},
      };
      if (page)
        project.elements.caption = {
          ...page,
          id: 'caption',
          trackId: 'captions',
          type: 'caption',
          origin: 'ai',
          styleRef: preview.captionStyle,
          transform: { x: 0, y: preview.captionY, scale: 1, rotation: 0 },
        };
      if (preview.productName)
        project.elements.name = {
          id: 'name',
          trackId: 'text',
          type: 'text',
          origin: 'user',
          content: preview.productName,
          startFrame: 0,
          durationFrames: project.durationFrames,
          transform: { x: 0, y: preview.hookY, scale: 1, rotation: 0 },
          style: {
            fontFamily: 'Noto Sans Thai',
            fontWeight: preview.hookWeight,
            fontSize: 56,
            color: preview.hookColor,
            ...(preview.hookBackground ? { background: preview.hookBackground } : {}),
            align: 'center',
          },
        };
      stage = mountStage(host.current, project, () => '');
      stage.root.style.background = 'transparent';
      stage.draw(page?.startFrame ?? 0);
    };
    void draw().catch(() => {
      if (!cancelled) setError(true);
    });
    return () => {
      cancelled = true;
      stage?.destroy();
    };
  }, [preview]);
  const sprites = source.data?.sprites;
  const width = 180;
  const height = 320;
  return (
    <div
      role="img"
      className="relative mx-auto h-80 w-45 overflow-hidden rounded-md bg-black"
      aria-label="ภาพตัวอย่างสไตล์จากฟุตเทจของคุณ"
      style={
        sprites
          ? spriteCoverStyle(
              (sheet) => spriteSheetUrl(preview.sourceId, sheet),
              sprites,
              preview.timeMs / 1000,
              width,
              height,
            )
          : undefined
      }
    >
      <div
        ref={host}
        className="pointer-events-none absolute top-0 left-0 h-[1920px] w-[1080px] origin-top-left"
        style={{ transform: `scale(${width / 1080})` }}
      />
      {!sprites ? (
        <p className="absolute inset-x-2 bottom-2 text-center text-xs text-white">กำลังเตรียมภาพตัวอย่าง</p>
      ) : null}
      {error ? (
        <p className="absolute inset-x-2 bottom-2 text-center text-xs text-white">โหลดตัวอย่างซับไม่สำเร็จ</p>
      ) : null}
    </div>
  );
}
