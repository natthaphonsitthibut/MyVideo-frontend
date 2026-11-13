import { type Energy, type GraphicKind, motionFrames } from './motion';
import type { StageElement, StageProject } from './types';

export type GraphicInput = {
  component: GraphicKind;
  energy: Energy;
  text: string;
  evidence: {
    kind: 'merchant' | 'transcript' | 'chat';
    quote: string;
    sourceId?: string;
    sourceFrame?: number;
  };
  assetId?: string;
  afterAssetId?: string;
  point?: { x: number; y: number };
};
export const GRAPHIC_LABELS: Record<GraphicKind, string> = {
  'hook-title': 'หัวคลิป',
  'price-tag': 'ป้ายราคา',
  'promo-badge': 'ป้ายโปรโมชัน',
  'stat-counter': 'ตัวเลขสำคัญ',
  'review-card': 'รีวิวจริง',
  'feature-callout': 'ชี้จุดสินค้า',
  'step-list': 'ขั้นตอน',
  'before-after': 'ภาพก่อน–หลัง',
  'lower-third': 'แนะนำสินค้า',
  'cta-card': 'ปิดท้ายชวนสั่ง',
  'logo-sting': 'โลโก้',
  'live-comment': 'ความคิดเห็นจากไลฟ์',
  'sticker-pop': 'สติกเกอร์ข้อความ',
};
/** Compile to ordinary editable layers. Images must already belong to the project; no external URLs/assets. */
export function graphicLayers(p: StageProject, input: GraphicInput, at: number, newId: () => string) {
  const media = input.component === 'before-after' || input.component === 'logo-sting';
  if (!media && (!input.text.trim() || input.text.length > 500))
    throw new Error('กรอกข้อความจริงไม่เกิน 500 ตัวอักษร');
  if (!media && !input.evidence.quote.includes(input.text)) throw new Error('ข้อความต้องตรงกับข้อมูลที่ระบุ');
  if (input.component === 'live-comment' && input.evidence.kind !== 'chat')
    throw new Error('ความคิดเห็นต้องมาจากบันทึกแชทจริง');
  if (['price-tag', 'stat-counter'].includes(input.component) && !/[0-9๐-๙]/u.test(input.text))
    throw new Error('กรอกตัวเลขจากข้อมูลจริง');
  if (
    input.component === 'feature-callout' &&
    (!input.point || Object.values(input.point).some((v) => !Number.isFinite(v) || v < 0 || v > 1))
  )
    throw new Error('ระบุจุดบนสินค้าระหว่าง 0 ถึง 1');
  const img = (id: string | undefined) => id && p.assets[id]?.kind === 'image';
  if (media && !img(input.assetId)) throw new Error('เลือกรูปที่อยู่ในโปรเจกต์');
  if (
    input.component === 'before-after' &&
    (!img(input.afterAssetId) || input.assetId === input.afterAssetId)
  )
    throw new Error('เลือกภาพก่อนและหลังคนละภาพ');
  const words = Math.max(
    1,
    Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(input.text)).filter(
      (s) => s.isWordLike,
    ).length,
  );
  const token = motionFrames(input.energy, words, p.fps),
    startFrame = Math.max(0, Math.round(at));
  const durationFrames = token.enter + token.hold + token.exit;
  if (startFrame + durationFrames > p.durationFrames)
    throw new Error('ช่วงที่เหลือสั้นเกินกว่าจะอ่านข้อความครบ เลื่อนตำแหน่งให้เร็วขึ้น');
  const elements: StageElement[] = [],
    tracks: { id: string; kind: 'overlay'; elementIds: string[] }[] = [];
  const make = (assetId?: string, after = false) => {
    const id = newId(),
      trackId = newId();
    const transform = {
      x: input.point ? Math.round((input.point.x - 0.5) * p.width) : 0,
      y: input.point
        ? Math.round((input.point.y - 0.5) * p.height)
        : input.component === 'lower-third'
          ? p.height * 0.2
          : -p.height * 0.2,
      scale: 1,
      rotation: 0,
    };
    const common = {
      id,
      trackId,
      startFrame,
      durationFrames,
      origin: 'user' as const,
      motion: { component: input.component, energy: input.energy, evidence: input.evidence },
      transform,
      animationIn: { presetId: input.energy === 'calm' ? 'fade' : 'pop', durationFrames: token.enter },
      animationOut: { presetId: 'fade', durationFrames: token.exit },
    };
    const e: StageElement = assetId
      ? {
          ...common,
          type: 'image',
          assetId,
          fit: 'contain',
          transform: { ...transform, y: 0 },
          ...(after
            ? {
                keyframes: {
                  reveal: [
                    { frame: 0, value: 0, easing: 'hold' as const },
                    { frame: token.enter, value: 0, easing: 'ease-in-out' as const },
                    { frame: token.enter + token.move, value: 1, easing: 'hold' as const },
                  ],
                },
              }
            : {}),
        }
      : {
          ...common,
          type: 'text',
          content: input.text,
          style: {
            fontFamily: 'Noto Sans Thai Variable',
            fontSize: Math.round(Math.min(p.width, p.height) * 0.06),
            fontWeight: 800,
            color: '#ffffff',
            background: '#111827ee',
            align: 'center',
          },
        };
    elements.push(e);
    tracks.push({ id: trackId, kind: 'overlay', elementIds: [id] });
  };
  if (media) {
    make(input.assetId);
    if (input.component === 'before-after') make(input.afterAssetId, true);
  } else make();
  return { elements, tracks };
}
