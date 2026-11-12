import type { Fps } from './frames';

/**
 * Structural view of Project JSON v1 (backend `libs/contracts/src/project/schema.ts`) — only what timeline logic
 * needs. The generated `Schemas['Project']` type in apps/web is assignable to it.
 */
export type Transform = { x: number; y: number; scale: number; rotation: number };
export type CaptionWord = { text: string; startFrame: number; endFrame: number };

type Common = {
  id: string;
  trackId: string;
  startFrame: number;
  durationFrames: number;
  origin: 'ai' | 'user' | 'template';
  locked?: boolean;
};
type Media = { assetId: string; sourceInFrame: number; playbackRate: number; volume: number };

export type VideoEl = Common & Media & { type: 'video'; transform: Transform; fit: string };
export type AudioEl = Common & Media & { type: 'audio' };
export type ImageEl = Common & { type: 'image'; assetId: string; transform: Transform; fit: string };
export type TextEl = Common & { type: 'text'; content: string; transform: Transform; styleRef?: string };
export type CaptionEl = Common & {
  type: 'caption';
  words: CaptionWord[];
  lines: number[][];
  styleRef: string;
  transform: Transform;
};
export type ShapeEl = Common & { type: 'shape'; transform: Transform };
export type CtaEl = Common & { type: 'cta'; label: string; transform: Transform };
export type TimelineElement = VideoEl | AudioEl | ImageEl | TextEl | CaptionEl | ShapeEl | CtaEl;

export type TimelineTrack = {
  id: string;
  kind: 'video' | 'audio' | 'caption' | 'overlay';
  elementIds: string[];
};

export type TimelineDoc = {
  fps: Fps;
  durationFrames: number;
  tracks: TimelineTrack[];
  elements: Record<string, TimelineElement>;
};
