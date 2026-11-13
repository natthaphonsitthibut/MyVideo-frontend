import type { TimelineDoc, TimelineElement } from '@myvideo/timeline-core';

/** Extra presentation fields the stage reads (Project JSON v1, backend `project/schema.ts`). */
export type Keyframe = {
  frame: number;
  value: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'hold';
};
export type TextStyle = {
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  color: string;
  background?: string;
  align: 'left' | 'center' | 'right';
};
export type Crop = { left: number; top: number; right: number; bottom: number };
export type Animation = { presetId: string; durationFrames: number };

export type StageElement = TimelineElement & {
  keyframes?: Record<string, Keyframe[]>;
  crop?: Crop;
  opacity?: number;
  style?: TextStyle;
  animationIn?: Animation;
  animationOut?: Animation;
  shape?: 'rect' | 'ellipse';
  width?: number;
  height?: number;
  fill?: string;
  radius?: number;
};

export type StageAsset = {
  /** A merchant source; library sounds have `libraryId` instead (exactly one is set). */
  sourceId?: string;
  libraryId?: string;
  musicId?: string;
  /** The merchant's brand kit logo (resolved to the current logo, E08-F08). */
  brandLogo?: true;
  kind: 'video' | 'audio' | 'image';
  durationFrames: number;
  hasAudio: boolean;
  width?: number;
  height?: number;
};

export type StageProject = Omit<TimelineDoc, 'elements'> & {
  width: number;
  height: number;
  assets: Record<string, StageAsset>;
  elements: Record<string, StageElement>;
};

/** Where a media asset's file is (proxy for preview, original for render). */
export type AssetResolver = (assetId: string, asset: StageAsset) => string;
