import type { Fps } from './frames';

/**
 * Structural view of Project JSON v1 (backend `libs/contracts/src/project/schema.ts`) — only what timeline logic
 * needs. The generated `Schemas['Project']` type in apps/web is assignable to it.
 */
export type Transform = { x: number; y: number; scale: number; rotation: number };
export type CaptionWord = {
  text: string;
  startFrame: number;
  endFrame: number;
  /** The page's key word (price, product, strong benefit): drawn in the style's emphasis colour, slightly larger. */
  emphasis?: true;
};

type Common = {
  id: string;
  trackId: string;
  startFrame: number;
  durationFrames: number;
  origin: 'ai' | 'user' | 'template';
  locked?: boolean;
  motion?: {
    component: string;
    energy: 'calm' | 'gentle' | 'normal' | 'lively' | 'hype';
    evidence?: {
      kind: 'merchant' | 'transcript' | 'chat';
      quote: string;
      sourceId?: string;
      sourceFrame?: number;
    };
  };
  transition?: { kind: string; motivation: string };
  /** Animated numeric properties, frames relative to the element start (advanced mode). */
  keyframes?: Record<string, Keyframe[]>;
  animationIn?: Animation;
  animationOut?: Animation;
  opacity?: number;
};
export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';
export type Keyframe = { frame: number; value: number; easing: Easing };
export type Animation = { presetId: string; durationFrames: number };
type Media = { assetId: string; sourceInFrame: number; playbackRate: number; volume: number };

export type VideoEl = Common & Media & { type: 'video'; transform: Transform; fit: string };
export type AudioEl = Common & Media & { type: 'audio' };
export type ImageEl = Common & {
  type: 'image';
  assetId: string;
  transform: Transform;
  fit: string;
  presentation?: 'plain' | 'showcase';
};
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
  /** Locked: its elements cannot be edited. Muted: its audio is silent in preview and render. */
  locked?: boolean;
  muted?: boolean;
};

export type TimelineDoc = {
  fps: Fps;
  durationFrames: number;
  tracks: TimelineTrack[];
  elements: Record<string, TimelineElement>;
  /** Asset lengths (project frames): media cannot be trimmed or slowed past the end of its source. */
  assets?: Record<string, { durationFrames: number }>;
};
