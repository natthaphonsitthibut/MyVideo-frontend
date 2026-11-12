import { buildCaptions, captionMaxWidth, glueWords, type Measure, type TimedWord } from '@myvideo/stage';
import type { Fps } from '@myvideo/timeline-core';
import { msToFrame } from '@myvideo/timeline-core';
import type { Schemas } from '@/api/client';

export type ProjectDraft = Schemas['ProjectDraft'];
type Element = Schemas['ProjectElement'];

/** What a clip is cut from: a probed source (its project fps and length in those frames). */
export type ClipSource = { id: string; fps: Fps; durationFrames: number; hasAudio: boolean };
/** Transcript words in source milliseconds (as the transcript API returns them). */
export type ClipWord = { text: string; startMs: number; endMs: number };

/** Air around the selected words so the first and last syllables are not cut. */
export const CLIP_PAD_MS = { before: 150, after: 300 };
/** Short vertical clips only; a longer selection is almost certainly a mistake. */
export const MAX_CLIP_SECONDS = 180;
const WIDTH = 1080;
const HEIGHT = 1920;
/** Caption box position: the lower safe area (same as the stage specs). */
const CAPTION_Y = 520;
const CAPTION_STYLE = 'bold-highlight' as const;
const PAUSE_FRAMES = 15;
const TITLE_MAX = 40;

const floorFrame = (ms: number, fps: Fps) => Math.floor((ms * fps.num) / (1000 * fps.den));
const ceilFrame = (ms: number, fps: Fps) => Math.ceil((ms * fps.num) / (1000 * fps.den));

/** Source frames the clip covers: first word start − pad … last word end + pad, clamped to the source. */
export function clipRange(source: ClipSource, words: readonly ClipWord[]) {
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) throw new Error('เลือกคำในคำถอดเสียงก่อน แล้วค่อยกดสร้างคลิป');
  const sourceInFrame = Math.max(0, floorFrame(first.startMs - CLIP_PAD_MS.before, source.fps));
  const end = Math.min(source.durationFrames, ceilFrame(last.endMs + CLIP_PAD_MS.after, source.fps));
  return { sourceInFrame, durationFrames: Math.max(1, end - sourceInFrame) };
}

const isThai = (ch: string | undefined) => !!ch && ch >= '฀' && ch <= '๿';

/** A readable title from the words: Thai joined without spaces, a space next to numbers/Latin; ≤ 40 chars. */
export function clipTitle(words: readonly { text: string }[]): string {
  const glued = glueWords(words.map((w) => ({ text: w.text, startFrame: 0, endFrame: 0 })));
  let out = '';
  for (const w of glued) {
    const sep = out && !(isThai(out.at(-1)) && isThai(w.text[0])) ? ' ' : '';
    const next = `${out}${sep}${w.text}`;
    if (next.length > TITLE_MAX) return `${out}…`;
    out = next;
  }
  return out || 'คลิปใหม่';
}

/**
 * Selected transcript words → a new 9:16 clip project: the source segment as one `cover` video element and the
 * words as caption pages (stage caption builder, measured with the caption font). The server validates it.
 */
export function buildClipDoc({
  source,
  words,
  measure,
  newId,
}: {
  source: ClipSource;
  words: readonly ClipWord[];
  measure: Measure;
  newId: () => string;
}): ProjectDraft {
  const { sourceInFrame, durationFrames } = clipRange(source, words);
  if (durationFrames > MAX_CLIP_SECONDS * (source.fps.num / source.fps.den))
    throw new Error(`คลิปยาวเกิน ${MAX_CLIP_SECONDS / 60} นาที เลือกคำให้น้อยลง`);

  const timed: TimedWord[] = words
    .map((w) => ({
      text: w.text,
      startFrame: Math.max(0, msToFrame(w.startMs, source.fps) - sourceInFrame),
      endFrame: Math.min(durationFrames, msToFrame(w.endMs, source.fps) - sourceInFrame),
    }))
    .filter((w) => w.endFrame > w.startFrame);
  const pages = buildCaptions(timed, {
    measure,
    maxWidth: captionMaxWidth(WIDTH),
    maxLines: 2,
    pauseFrames: PAUSE_FRAMES,
  });

  const assetId = newId();
  const videoTrack = newId();
  const captionTrack = newId();
  const transform = (y: number) => ({ x: 0, y, scale: 1, rotation: 0 });
  const videoId = newId();
  const elements: Record<string, Element> = {
    [videoId]: {
      type: 'video',
      id: videoId,
      trackId: videoTrack,
      startFrame: 0,
      durationFrames,
      origin: 'user',
      assetId,
      sourceInFrame,
      playbackRate: 1,
      volume: 1,
      transform: transform(0),
      fit: 'cover',
    },
  };
  const captionIds = pages.map((p) => {
    const id = newId();
    elements[id] = {
      type: 'caption',
      id,
      trackId: captionTrack,
      startFrame: p.startFrame,
      durationFrames: Math.min(p.durationFrames, durationFrames - p.startFrame),
      origin: 'user',
      words: p.words,
      lines: p.lines,
      styleRef: CAPTION_STYLE,
      transform: transform(CAPTION_Y),
    };
    return id;
  });

  return {
    schemaVersion: 1,
    fps: { num: source.fps.num, den: source.fps.den },
    width: WIDTH,
    height: HEIGHT,
    durationFrames,
    assets: {
      [assetId]: {
        sourceId: source.id,
        kind: 'video',
        durationFrames: source.durationFrames,
        hasAudio: source.hasAudio,
      },
    },
    tracks: [
      { id: videoTrack, kind: 'video', elementIds: [videoId] },
      { id: captionTrack, kind: 'caption', elementIds: captionIds },
    ],
    elements,
    meta: { createdBy: 'user', title: clipTitle(words) },
  };
}

export const CLIP_CAPTION_STYLE = CAPTION_STYLE;
